import { prisma } from "@/lib/prisma";

export interface ItemAnalisado {
  barcode: string;
  /** Código interno do SISloja, que é como a equipe procura o produto. */
  code: string | null;
  description: string;
  category: string | null;
  supplier: string | null;
  quantity: number;
  cost: number | null;
  price: number | null;
  /** Valor parado na prateleira, a preço de custo. */
  valorEmCusto: number;
  unidadesVendidas: number;
  ultimaVenda: Date | null;
  diasSemVender: number | null;
  /** Quantos meses o estoque atual dura no ritmo de venda do período. */
  coberturaMeses: number | null;
  margemPercentual: number | null;
}

export interface ResumoEstoque {
  temDados: boolean;
  arquivo: string | null;
  periodo: { de: Date; ate: Date; dias: number } | null;
  itens: number;
  unidades: number;
  valorEmCusto: number;
  valorEmVenda: number;
  /** Itens com estoque que não venderam nenhuma unidade no período. */
  parados: ItemAnalisado[];
  /** Venderam, mas o estoque atual dura muito tempo no ritmo atual. */
  baixaSaida: ItemAnalisado[];
  /** Zerados que vinham vendendo — candidatos a reposição. */
  repor: ItemAnalisado[];
  /** Quantidade negativa no SISloja: saiu mais do que entrou no controle. */
  negativos: ItemAnalisado[];
  /** Os que mais giraram no período. */
  campeoes: ItemAnalisado[];
  porCategoria: Array<{ categoria: string; itens: number; unidades: number; valorEmCusto: number; vendidas: number }>;
  margemMedia: number | null;
}

/** Estoque parado a partir deste valor entra na lista de ação prioritária. */
const COBERTURA_ALTA_MESES = 6;

/**
 * Cruza a foto do estoque com as vendas do período e devolve todos os
 * produtos analisados. É a base tanto do resumo quanto da listagem completa,
 * para as duas telas nunca discordarem sobre o que é "parado".
 */
export async function analisarEstoque() {
  const snapshot = await prisma.stockSnapshot.findFirst({ orderBy: { createdAt: "desc" } });
  const itens = await prisma.stockItem.findMany({ orderBy: { description: "asc" } });

  if (!snapshot || itens.length === 0) {
    return { snapshot: null, dias: null as number | null, analisados: [] as ItemAnalisado[] };
  }

  const vendas = await prisma.stockSale.groupBy({
    by: ["barcode"],
    _sum: { quantity: true, total: true },
    _max: { date: true }
  });
  const porCodigo = new Map(vendas.map((v) => [v.barcode, v]));

  const dias =
    snapshot.salesFrom && snapshot.salesTo
      ? Math.max(1, Math.round((snapshot.salesTo.getTime() - snapshot.salesFrom.getTime()) / 86400000))
      : null;
  const hoje = snapshot.salesTo ?? new Date();

  const analisados: ItemAnalisado[] = itens.map((item) => {
    const venda = porCodigo.get(item.barcode);
    const unidadesVendidas = venda?._sum.quantity ?? 0;
    const ultimaVenda = venda?._max.date ?? null;
    const cost = item.cost == null ? null : Number(item.cost);
    const price = item.price == null ? null : Number(item.price);
    const porMes = dias && unidadesVendidas > 0 ? (unidadesVendidas / dias) * 30 : 0;

    return {
      barcode: item.barcode,
      code: item.code,
      description: item.description,
      category: item.category,
      supplier: item.supplier,
      quantity: item.quantity,
      cost,
      price,
      valorEmCusto: (cost ?? 0) * item.quantity,
      unidadesVendidas,
      ultimaVenda,
      diasSemVender: ultimaVenda
        ? Math.max(0, Math.round((hoje.getTime() - ultimaVenda.getTime()) / 86400000))
        : null,
      coberturaMeses: porMes > 0 ? item.quantity / porMes : null,
      margemPercentual: cost != null && price != null && price > 0 ? ((price - cost) / price) * 100 : null
    };
  });

  return { snapshot, dias, analisados };
}

export async function getResumoEstoque(): Promise<ResumoEstoque> {
  const { snapshot, dias, analisados } = await analisarEstoque();
  const itens = analisados;

  if (!snapshot || itens.length === 0) {
    return {
      temDados: false, arquivo: null, periodo: null, itens: 0, unidades: 0,
      valorEmCusto: 0, valorEmVenda: 0, parados: [], baixaSaida: [], repor: [],
      negativos: [], campeoes: [], porCategoria: [], margemMedia: null
    };
  }

  const parados = analisados
    .filter((i) => i.quantity > 0 && i.unidadesVendidas === 0)
    .sort((a, b) => b.valorEmCusto - a.valorEmCusto);

  const baixaSaida = analisados
    .filter((i) => i.quantity > 0 && i.unidadesVendidas > 0 && (i.coberturaMeses ?? 0) > COBERTURA_ALTA_MESES)
    .sort((a, b) => b.valorEmCusto - a.valorEmCusto);

  const repor = analisados
    .filter((i) => i.quantity === 0 && i.unidadesVendidas > 0)
    .sort((a, b) => b.unidadesVendidas - a.unidadesVendidas);

  // Estoque negativo é impossível na prateleira: significa venda lançada sem
  // a entrada correspondente, ou baixa feita duas vezes no SISloja.
  const negativos = analisados
    .filter((i) => i.quantity < 0)
    .sort((a, b) => a.quantity - b.quantity);

  const campeoes = [...analisados]
    .filter((i) => i.unidadesVendidas > 0)
    .sort((a, b) => b.unidadesVendidas - a.unidadesVendidas);

  const categorias = new Map<string, { itens: number; unidades: number; valorEmCusto: number; vendidas: number }>();
  for (const item of analisados) {
    const chave = item.category ?? "Sem categoria";
    const atual = categorias.get(chave) ?? { itens: 0, unidades: 0, valorEmCusto: 0, vendidas: 0 };
    atual.itens += 1;
    atual.unidades += item.quantity;
    atual.valorEmCusto += item.valorEmCusto;
    atual.vendidas += item.unidadesVendidas;
    categorias.set(chave, atual);
  }

  const comMargem = analisados.filter((i) => i.margemPercentual != null);

  return {
    temDados: true,
    arquivo: snapshot.fileName,
    periodo:
      snapshot.salesFrom && snapshot.salesTo && dias
        ? { de: snapshot.salesFrom, ate: snapshot.salesTo, dias }
        : null,
    itens: itens.length,
    unidades: analisados.reduce((s, i) => s + i.quantity, 0),
    valorEmCusto: analisados.reduce((s, i) => s + i.valorEmCusto, 0),
    valorEmVenda: analisados.reduce((s, i) => s + (i.price ?? 0) * i.quantity, 0),
    parados,
    baixaSaida,
    repor,
    negativos,
    campeoes,
    porCategoria: Array.from(categorias.entries())
      .map(([categoria, v]) => ({ categoria, ...v }))
      .sort((a, b) => b.valorEmCusto - a.valorEmCusto),
    margemMedia:
      comMargem.length > 0
        ? comMargem.reduce((s, i) => s + (i.margemPercentual ?? 0), 0) / comMargem.length
        : null
  };
}

export type FiltroDeProduto = "todos" | "parados" | "baixa-saida" | "repor" | "negativos" | "campeoes";

export interface PaginaDeProdutos {
  itens: ItemAnalisado[];
  total: number;
  pagina: number;
  paginas: number;
  porPagina: number;
}

export const FILTRO_LABEL: Record<FiltroDeProduto, string> = {
  todos: "Todos os produtos",
  parados: "Estoque parado",
  "baixa-saida": "Baixa saída",
  repor: "Repor",
  negativos: "Estoque negativo",
  campeoes: "Campeões de saída"
};

/** Situação do produto, para a coluna da listagem completa. */
export function situacaoDoItem(item: ItemAnalisado): { label: string; tom: "bom" | "atencao" | "ruim" | "neutro" } {
  if (item.quantity < 0) return { label: "Negativo", tom: "ruim" };
  if (item.quantity === 0 && item.unidadesVendidas > 0) return { label: "Repor", tom: "atencao" };
  if (item.quantity === 0) return { label: "Sem estoque", tom: "neutro" };
  if (item.unidadesVendidas === 0) return { label: "Parado", tom: "ruim" };
  if ((item.coberturaMeses ?? 0) > COBERTURA_ALTA_MESES) return { label: "Baixa saída", tom: "atencao" };
  return { label: "Girando", tom: "bom" };
}

/**
 * Listagem completa dos produtos, com filtro por situação e busca por nome ou
 * código. Paginada porque são mil produtos — a tela precisa abrir rápido no
 * celular, no meio da loja.
 */
export async function getProdutos(opcoes: {
  filtro?: FiltroDeProduto;
  busca?: string;
  pagina?: number;
  porPagina?: number;
}): Promise<PaginaDeProdutos> {
  const { analisados } = await analisarEstoque();
  const filtro = opcoes.filtro ?? "todos";
  const porPagina = opcoes.porPagina ?? 100;

  let itens = analisados;

  if (filtro === "parados") {
    itens = itens.filter((i) => i.quantity > 0 && i.unidadesVendidas === 0).sort((a, b) => b.valorEmCusto - a.valorEmCusto);
  } else if (filtro === "baixa-saida") {
    itens = itens
      .filter((i) => i.quantity > 0 && i.unidadesVendidas > 0 && (i.coberturaMeses ?? 0) > COBERTURA_ALTA_MESES)
      .sort((a, b) => b.valorEmCusto - a.valorEmCusto);
  } else if (filtro === "repor") {
    itens = itens.filter((i) => i.quantity === 0 && i.unidadesVendidas > 0).sort((a, b) => b.unidadesVendidas - a.unidadesVendidas);
  } else if (filtro === "negativos") {
    itens = itens.filter((i) => i.quantity < 0).sort((a, b) => a.quantity - b.quantity);
  } else if (filtro === "campeoes") {
    itens = itens.filter((i) => i.unidadesVendidas > 0).sort((a, b) => b.unidadesVendidas - a.unidadesVendidas);
  }

  const busca = opcoes.busca?.trim().toLowerCase();
  if (busca) {
    itens = itens.filter(
      (i) =>
        i.description.toLowerCase().includes(busca) ||
        (i.code ?? "").toLowerCase().includes(busca) ||
        i.barcode.toLowerCase().includes(busca) ||
        (i.category ?? "").toLowerCase().includes(busca)
    );
  }

  const total = itens.length;
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const pagina = Math.min(Math.max(1, opcoes.pagina ?? 1), paginas);

  return {
    itens: itens.slice((pagina - 1) * porPagina, pagina * porPagina),
    total,
    pagina,
    paginas,
    porPagina
  };
}
