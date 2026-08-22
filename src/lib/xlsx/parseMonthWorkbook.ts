/**
 * Leitor das planilhas mensais da Mari Boutique.
 *
 * Layout real de cada aba (uma aba por vendedora + uma aba "Mari Boutique"
 * com o consolidado da loja, no mesmo formato):
 *
 *   D2 "dias úteis"        E2 valor
 *   D3 "dias trabalhados"  E3 valor
 *   linha 7   cabeçalho a partir de D: Data | Faturamento | Vendas | SALÃO | ONLINE | Peças | PA | TM
 *             (SALÃO/ONLINE não existem nas planilhas antigas -> as colunas seguintes andam para trás,
 *              por isso o cabeçalho é lido de verdade em vez de assumir posições fixas)
 *   linha 8+  um dia por linha, até a linha de totais
 *   linha 19  totais do mês
 *   D23/E23   "Total Mês" + faturamento do mês
 *   D25       "Projeção"  + valor em E25
 *   I23:K25   metas: I = nível (Prata/Ouro/Diamante), J = meta em R$, K = % atingido
 *   K27       TKM do mês        K28  PA do mês
 *
 * Células com #DIV/0! (e demais erros do Excel) viram `null` = "sem dado",
 * nunca 0 e nunca o texto do erro.
 */
import * as XLSX from "xlsx";

export type GoalLevelName = "PRATA" | "OURO" | "DIAMANTE";

export interface ParsedGoal {
  level: GoalLevelName;
  target: number;
}

export interface ParsedDay {
  day: number;
  revenue: number | null;
  sales: number | null;
  salao: number | null;
  online: number | null;
  pieces: number | null;
}

export interface ParsedSheet {
  /** Nome da aba, normalizado em maiúsculas. */
  sheetName: string;
  scope: "STORE" | "SELLER";
  workingDays: number | null;
  workedDays: number | null;
  revenue: number;
  salesCount: number;
  pieces: number;
  pa: number | null;
  tkm: number | null;
  salao: number | null;
  online: number | null;
  projection: number | null;
  goals: ParsedGoal[];
  days: ParsedDay[];
  warnings: string[];
}

export interface ParsedWorkbook {
  /** Mês/ano detectados no nome do arquivo ou nas datas da planilha. */
  year: number | null;
  month: number | null;
  store: ParsedSheet | null;
  sellers: ParsedSheet[];
  ignoredSheets: string[];
  warnings: string[];
}

const MESES: Record<string, number> = {
  JANEIRO: 1, FEVEREIRO: 2, MARCO: 3, ABRIL: 4, MAIO: 5, JUNHO: 6,
  JULHO: 7, AGOSTO: 8, SETEMBRO: 9, OUTUBRO: 10, NOVEMBRO: 11, DEZEMBRO: 12
};

/** Remove acentos e caixa, para comparar rótulos/nomes de aba de forma tolerante. */
export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

/** Abas de modelo/rascunho: "LOJA", "VEND", "VEND 1", "vend 2"... */
export function isTemplateSheet(name: string): boolean {
  const n = normalize(name).replace(/\s+/g, " ");
  return n === "LOJA" || /^VEND(EDORA)?S?\.?( ?\d+)?$/.test(n);
}

export function isStoreSheet(name: string): boolean {
  const n = normalize(name);
  return n.includes("MARI") && n.includes("BOUTIQUE");
}

function cell(sheet: XLSX.WorkSheet, address: string): XLSX.CellObject | undefined {
  return sheet[address] as XLSX.CellObject | undefined;
}

/** Valor numérico da célula, ou null para vazio, erro (#DIV/0!) e texto não numérico. */
function num(sheet: XLSX.WorkSheet, address: string): number | null {
  const c = cell(sheet, address);
  if (!c || c.t === "e") return null;
  if (typeof c.v === "number") return Number.isFinite(c.v) ? c.v : null;
  if (typeof c.v === "string") {
    // Aceita "R$ 1.234,56" e "1234.56" digitados como texto.
    const cleaned = c.v.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
    const parsed = Number(cleaned);
    return cleaned !== "" && Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function text(sheet: XLSX.WorkSheet, address: string): string {
  const c = cell(sheet, address);
  if (!c || c.t === "e" || c.v == null) return "";
  return String(c.v).trim();
}

function intOrNull(value: number | null): number | null {
  return value == null ? null : Math.round(value);
}

const HEADER_ROW = 7;
const FIRST_DAY_ROW = 8;
const TOTALS_ROW_DEFAULT = 19;
const MAX_DAY_ROW = 60;

/** Mapeia rótulo do cabeçalho (linha 7) -> letra da coluna, a partir de D. */
function readHeader(sheet: XLSX.WorkSheet): Record<string, string> {
  const map: Record<string, string> = {};
  for (let col = 3; col <= 15; col++) {
    const letter = XLSX.utils.encode_col(col);
    const label = normalize(text(sheet, `${letter}${HEADER_ROW}`));
    if (label) map[label] = letter;
  }
  return map;
}

/** A linha de totais é a linha 19 na maioria das planilhas, mas é procurada
 *  de verdade (coluna D contendo "TOTAL") para aguentar meses com mais linhas. */
function findTotalsRow(sheet: XLSX.WorkSheet, dateCol: string): number {
  for (let row = FIRST_DAY_ROW; row <= MAX_DAY_ROW; row++) {
    if (normalize(text(sheet, `${dateCol}${row}`)).startsWith("TOTAL")) return row;
  }
  return TOTALS_ROW_DEFAULT;
}

function parseSheet(workbook: XLSX.WorkBook, sheetName: string): ParsedSheet {
  const sheet = workbook.Sheets[sheetName];
  const warnings: string[] = [];
  const header = readHeader(sheet);

  const colData = header["DATA"] ?? "D";
  const colRevenue = header["FATURAMENTO"];
  const colSales = header["VENDAS"];
  const colSalao = header["SALAO"];
  const colOnline = header["ONLINE"];
  const colPieces = header["PECAS"];

  if (!colRevenue || !colSales || !colPieces) {
    warnings.push(
      `Aba "${sheetName}": cabeçalho da linha ${HEADER_ROW} não traz Faturamento/Vendas/Peças; os totais foram lidos das linhas de resumo.`
    );
  }
  if (!colSalao || !colOnline) {
    warnings.push(`Aba "${sheetName}": sem colunas SALÃO/ONLINE (planilha antiga) — gravado como "sem dado".`);
  }

  const totalsRow = findTotalsRow(sheet, colData);
  const days: ParsedDay[] = [];
  for (let row = FIRST_DAY_ROW; row < totalsRow; row++) {
    const day: ParsedDay = {
      day: row - FIRST_DAY_ROW + 1,
      revenue: colRevenue ? num(sheet, `${colRevenue}${row}`) : null,
      sales: colSales ? intOrNull(num(sheet, `${colSales}${row}`)) : null,
      salao: colSalao ? num(sheet, `${colSalao}${row}`) : null,
      online: colOnline ? num(sheet, `${colOnline}${row}`) : null,
      pieces: colPieces ? intOrNull(num(sheet, `${colPieces}${row}`)) : null
    };
    days.push(day);
  }

  const sum = (pick: (d: ParsedDay) => number | null) =>
    days.reduce<number>((acc, d) => acc + (pick(d) ?? 0), 0);

  // Totais: a linha de totais manda; se estiver vazia, cai para a soma dos dias.
  const totalRevenueRow = colRevenue ? num(sheet, `${colRevenue}${totalsRow}`) : null;
  const totalSalesRow = colSales ? num(sheet, `${colSales}${totalsRow}`) : null;
  const totalPiecesRow = colPieces ? num(sheet, `${colPieces}${totalsRow}`) : null;

  const revenue = totalRevenueRow ?? sum((d) => d.revenue);
  const salesCount = Math.round(totalSalesRow ?? sum((d) => d.sales));
  const pieces = Math.round(totalPiecesRow ?? sum((d) => d.pieces));

  // E23 "Total Mês" deve bater com a linha de totais; divergência vira aviso,
  // não erro — quem decide é o Administrador na tela de conferência.
  const totalMes = num(sheet, "E23");
  if (totalMes != null && Math.abs(totalMes - revenue) > 0.5) {
    warnings.push(
      `Aba "${sheetName}": "Total Mês" (${totalMes.toFixed(2)}) não bate com a linha ${totalsRow} (${revenue.toFixed(2)}).`
    );
  }

  const salao = colSalao ? sum((d) => d.salao) || null : null;
  const online = colOnline ? sum((d) => d.online) || null : null;

  // TKM/PA vêm prontos em K27/K28; se a planilha traz #DIV/0!, recalcula.
  let tkm = num(sheet, "K27");
  let pa = num(sheet, "K28");
  if (tkm == null && salesCount > 0) tkm = revenue / salesCount;
  if (pa == null && salesCount > 0) pa = pieces / salesCount;

  const goals: ParsedGoal[] = [];
  for (let row = 23; row <= 25; row++) {
    const levelLabel = normalize(text(sheet, `I${row}`));
    const target = num(sheet, `J${row}`);
    const level = (["PRATA", "OURO", "DIAMANTE"] as const).find((l) => levelLabel.startsWith(l));
    if (level && target != null && target > 0) goals.push({ level, target });
  }

  return {
    sheetName: normalize(sheetName),
    scope: isStoreSheet(sheetName) ? "STORE" : "SELLER",
    workingDays: intOrNull(num(sheet, "E2")),
    workedDays: intOrNull(num(sheet, "E3")),
    revenue,
    salesCount,
    pieces,
    pa,
    tkm,
    salao,
    online,
    projection: num(sheet, "E25"),
    goals,
    days,
    warnings
  };
}

/** Mês/ano a partir do nome do arquivo: "JULHO_2026.xlsx", "AGOSTO_VENDAS_2026.xlsx". */
export function periodFromFileName(fileName: string): { year: number; month: number } | null {
  const n = normalize(fileName);
  const monthEntry = Object.entries(MESES).find(([nome]) => n.includes(nome));
  const yearMatch = n.match(/(20\d{2})/);
  if (!monthEntry || !yearMatch) return null;
  return { year: Number(yearMatch[1]), month: monthEntry[1] };
}

export function parseMonthWorkbook(buffer: Buffer, fileName: string): ParsedWorkbook {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const warnings: string[] = [];
  const ignoredSheets: string[] = [];
  const sellers: ParsedSheet[] = [];
  let store: ParsedSheet | null = null;

  for (const sheetName of workbook.SheetNames) {
    if (isTemplateSheet(sheetName)) {
      ignoredSheets.push(sheetName);
      continue;
    }
    const parsed = parseSheet(workbook, sheetName);
    warnings.push(...parsed.warnings);
    if (parsed.scope === "STORE") store = parsed;
    else sellers.push(parsed);
  }

  if (!store) warnings.push('A planilha não tem a aba "Mari Boutique" — a tela de Metas da Loja ficará sem dados neste mês.');
  if (sellers.length === 0) warnings.push("Nenhuma aba de vendedora encontrada na planilha.");

  const period = periodFromFileName(fileName);
  if (!period) {
    warnings.push(
      `Não deu para descobrir o mês pelo nome do arquivo ("${fileName}") — escolha o mês manualmente antes de confirmar.`
    );
  }

  sellers.sort((a, b) => b.revenue - a.revenue);

  return {
    year: period?.year ?? null,
    month: period?.month ?? null,
    store,
    sellers,
    ignoredSheets,
    warnings
  };
}
