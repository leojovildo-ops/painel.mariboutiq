/**
 * Leitor da planilha de resultados históricos da loja ("RESULTADOS mariboutique").
 *
 * A aba "RESUMO" tem um bloco por ano lado a lado, cada um com o rótulo
 * "RESULTADOS 2022", "RESULTADOS 2023"... na linha 2. Dentro do bloco, uma
 * linha por mês e as colunas, a partir da coluna do mês:
 *
 *   +1 Valor Vendido | +2 Produtos | +3 Preço Médio | +4 (%) |
 *   +5 Qtdd Vendas   | +6 TKM      | +7 PA
 *
 * Os blocos são localizados pelo rótulo, e não por posição: se um ano novo for
 * acrescentado à direita, ele entra sozinho.
 */
import * as XLSX from "xlsx";
import { normalize } from "./parseMonthWorkbook";

export interface MesHistorico {
  year: number;
  month: number;
  revenue: number;
  pieces: number | null;
  salesCount: number | null;
  tkm: number | null;
  pa: number | null;
}

export interface ParsedHistorico {
  anos: number[];
  meses: MesHistorico[];
  warnings: string[];
}

const LINHA_CABECALHO = 2;
const PRIMEIRA_LINHA = 5;
const ULTIMA_LINHA = 16;

function num(ws: XLSX.WorkSheet, col: number, row: number): number | null {
  const cell = ws[XLSX.utils.encode_cell({ c: col, r: row - 1 })] as XLSX.CellObject | undefined;
  if (!cell || cell.t === "e" || typeof cell.v !== "number") return null;
  return Number.isFinite(cell.v) ? cell.v : null;
}

export function parseHistorico(buffer: Buffer): ParsedHistorico {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const nomeAba = wb.SheetNames.find((n) => normalize(n).startsWith("RESUMO"));
  if (!nomeAba) {
    return { anos: [], meses: [], warnings: ['A planilha não tem uma aba "RESUMO".'] };
  }

  const ws = wb.Sheets[nomeAba];
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  const warnings: string[] = [];
  const meses: MesHistorico[] = [];
  const anos: number[] = [];

  for (let col = range.s.c; col <= range.e.c; col++) {
    const cell = ws[XLSX.utils.encode_cell({ c: col, r: LINHA_CABECALHO - 1 })] as XLSX.CellObject | undefined;
    const rotulo = cell?.v ? normalize(String(cell.v)) : "";
    const match = rotulo.match(/^RESULTADOS\s+(20\d{2})$/);
    if (!match) continue;

    const ano = Number(match[1]);
    anos.push(ano);

    let mes = 0;
    for (let row = PRIMEIRA_LINHA; row <= ULTIMA_LINHA; row++) {
      mes += 1;
      const revenue = num(ws, col + 1, row);
      // Mês em branco = loja ainda não operava ou mês não fechado.
      if (revenue == null || revenue <= 0) continue;

      meses.push({
        year: ano,
        month: mes,
        revenue,
        pieces: num(ws, col + 2, row),
        salesCount: num(ws, col + 5, row),
        tkm: num(ws, col + 6, row),
        pa: num(ws, col + 7, row)
      });
    }
  }

  if (anos.length === 0) {
    warnings.push('Nenhum bloco "RESULTADOS <ano>" foi encontrado na linha 2 da aba RESUMO.');
  }

  return { anos: anos.sort((a, b) => a - b), meses, warnings };
}
