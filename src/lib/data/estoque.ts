import { prisma } from "@/lib/prisma";

export interface ItemAnalisado {
  barcode: string;
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
  /** Os que mais giraram no período. */
  campeoes: ItemAnalisado[];
  porCategoria: Array<{ categoria: string; itens: number; unidades: number; valorEmCusto: number; vendidas: number }>;
  margemMedia: number | null;
}

/** Estoque parado a partir deste valor entra na lista de ação prioritária. */
const COBERTURA_ALTA_MESES = 6;

export async function getResumoEstoque(): Promise<ResumoEstoque> {
  const snapshot = await prisma.stockSnapshot.findFirst({ orderBy: { createdAt: "desc" } });
  const itens = await prisma.stockItem.findMany();

  if (!snapshot || itens.length === 0) {
    return {
      temDados: false, arquivo: null, periodo: null, itens: 0, unidades: 0,
      valorEmCusto: 0, valorEmVenda: 0, parados: [], baixaSaida: [], repor: [],
      campeoes: [], porCategoria: [], margemMedia: null
    };
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

    // Ritmo do período projetado para 30 dias.
    const porMes = dias && unidadesVendidas > 0 ? (unidadesVendidas / dias) * 30 : 0;

    return {
      barcode: item.barcode,
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

  const parados = analisados
    .filter((i) => i.quantity > 0 && i.unidadesVendidas === 0)
    .sort((a, b) => b.valorEmCusto - a.valorEmCusto);

  const baixaSaida = analisados
    .filter((i) => i.quantity > 0 && i.unidadesVendidas > 0 && (i.coberturaMeses ?? 0) > COBERTURA_ALTA_MESES)
    .sort((a, b) => b.valorEmCusto - a.valorEmCusto);

  const repor = analisados
    .filter((i) => i.quantity === 0 && i.unidadesVendidas > 0)
    .sort((a, b) => b.unidadesVendidas - a.unidadesVendidas);

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
