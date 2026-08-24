/**
 * Leitor do "Relatório de Vendas por Vendedor" exportado pelo SISloja.
 *
 * Não é uma tabela: é um relatório impresso em Excel, agrupado por vendedora e
 * por pedido. A leitura acompanha o contexto linha a linha:
 *
 *   "Vendedor(a): LOJA"                      -> troca a vendedora corrente
 *   "Nº Pedido:424 | Data:06/04/2026 | ..."  -> abre um pedido
 *   675 | REGATA DUO COLOR | 1 | 13 | 35 | 35 -> item do pedido
 *   "Total: | ..."                            -> fecha o pedido
 *
 * As colunas do item são A código de barras, B descrição, C quantidade,
 * D custo, E unitário, F total.
 *
 * Quantidade negativa é devolução ou cancelamento, e é mantida: somada ao
 * resto, ela desfaz a venda, que é exatamente o que aconteceu na loja. Jogar
 * fora essas linhas inflaria o giro de quem teve venda devolvida.
 *
 * O nome da cliente não é importado.
 */
import * as XLSX from "xlsx";
import { normalize } from "./parseMonthWorkbook";
import type { VendaDeItem } from "./parseStock";

export interface ParsedRelatorio {
  vendas: VendaDeItem[];
  periodo: { de: string; ate: string } | null;
  pedidos: number;
  devolucoes: number;
  vendedoras: string[];
  warnings: string[];
}

function texto(ws: XLSX.WorkSheet, col: number, row: number): string {
  const cell = ws[XLSX.utils.encode_cell({ c: col, r: row })] as XLSX.CellObject | undefined;
  if (!cell || cell.v == null) return "";
  return String(cell.v).trim();
}

function numero(ws: XLSX.WorkSheet, col: number, row: number): number | null {
  const cell = ws[XLSX.utils.encode_cell({ c: col, r: row })] as XLSX.CellObject | undefined;
  if (!cell || cell.t === "e" || cell.v == null) return null;
  if (typeof cell.v === "number") return Number.isFinite(cell.v) ? cell.v : null;
  const n = Number(String(cell.v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** "Data:06/04/2026" -> "2026-04-06" */
function dataDoPedido(valor: string): string | null {
  const m = valor.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

export function parseRelatorioVendas(buffer: Buffer): ParsedRelatorio {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  const warnings: string[] = [];

  const vendas: VendaDeItem[] = [];
  const vendedoras = new Set<string>();
  let vendedoraAtual: string | null = null;
  let pedidoAtual: string | null = null;
  let dataAtual: string | null = null;
  let pedidos = 0;
  let devolucoes = 0;

  for (let row = range.s.r; row <= range.e.r; row++) {
    const a = texto(ws, 0, row);
    if (!a) continue;
    const na = normalize(a);

    if (na.startsWith("VENDEDOR")) {
      vendedoraAtual = a.split(":").slice(1).join(":").trim() || null;
      if (vendedoraAtual) vendedoras.add(vendedoraAtual);
      continue;
    }

    if (na.startsWith("N PEDIDO") || na.startsWith("Nº PEDIDO") || /^N.?\s*PEDIDO/.test(na)) {
      pedidoAtual = a.split(":").slice(1).join(":").trim().replace(/\./g, "") || null;
      dataAtual = dataDoPedido(texto(ws, 1, row));
      pedidos += 1;
      continue;
    }

    // "Total:" fecha o pedido; o rodapé do relatório também cai aqui.
    if (na.startsWith("TOTAL")) {
      pedidoAtual = null;
      continue;
    }

    // Fora de um pedido, a linha é cabeçalho, rodapé ou assinatura do sistema.
    if (!pedidoAtual || !dataAtual) continue;

    const quantidade = numero(ws, 2, row);
    const descricao = texto(ws, 1, row);
    if (quantidade == null || !descricao) continue;

    if (quantidade < 0) devolucoes += 1;

    vendas.push({
      date: dataAtual,
      orderNo: pedidoAtual,
      barcode: a,
      description: descricao,
      quantity: Math.round(quantidade),
      cost: numero(ws, 3, row),
      unitPrice: numero(ws, 4, row),
      total: numero(ws, 5, row),
      sellerName: vendedoraAtual
    });
  }

  if (vendas.length === 0) {
    warnings.push("Nenhum item de venda foi reconhecido neste relatório.");
  }

  const datas = vendas.map((v) => v.date).sort();
  return {
    vendas,
    periodo: datas.length > 0 ? { de: datas[0], ate: datas[datas.length - 1] } : null,
    pedidos,
    devolucoes,
    vendedoras: Array.from(vendedoras),
    warnings
  };
}
