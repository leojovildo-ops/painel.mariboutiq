/**
 * Leitor da planilha de DESPESAS (um arquivo por ano).
 *
 * Layout real (conferido contra "DESPESAS 2026 - TABELA MKUP.xlsx"):
 *
 *   abas JAN..DEZ  -> uma linha por lançamento, a partir da linha 2:
 *                     A GRUPO | B DESCRIÇÃO | C TIPO DOCUMENTO | D VENCIMENTO
 *                     E VALOR | F DATA PAGAMENTO | G SALDO
 *                     (as colunas H+ são um resumo lateral da própria planilha,
 *                      não são lançamentos e são ignoradas)
 *   "RESUMO DESPESAS ANO" -> linha "FATURAMENTO BRUTO", com um valor por mês
 *                     nas colunas B..M (janeiro..dezembro).
 *
 * As demais abas (MENU, TABELA MKUP, DESPESAS GERAL, DASH_DADOS, DASHBOARD)
 * são de apoio e não entram.
 */
import * as XLSX from "xlsx";
import { normalize } from "./parseMonthWorkbook";

export interface ParsedExpense {
  group: string;
  description: string;
  docType: string | null;
  dueDate: string | null;
  amount: number;
  paidAt: string | null;
  balance: number | null;
  sourceRow: number;
}

export interface ParsedExpenseMonth {
  month: number;
  sheetName: string;
  expenses: ParsedExpense[];
  total: number;
  grossRevenue: number | null;
  /**
   * Mês que ainda não aconteceu. As abas dos meses futuros já vêm com as
   * contas recorrentes pré-lançadas no modelo — são previsão, não despesa
   * realizada, e entrariam no painel inflando o resultado do ano.
   */
  isFuture: boolean;
}

export interface ParsedExpensesWorkbook {
  year: number | null;
  months: ParsedExpenseMonth[];
  ignoredSheets: string[];
  warnings: string[];
}

const ABAS_MES: Record<string, number> = {
  JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6,
  JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12
};

const COL = { GRUPO: 0, DESCRICAO: 1, TIPO: 2, VENCIMENTO: 3, VALOR: 4, PAGAMENTO: 5, SALDO: 6 };
const PRIMEIRA_LINHA = 2;
const MAX_LINHAS = 2000;

function cell(sheet: XLSX.WorkSheet, col: number, row: number): XLSX.CellObject | undefined {
  return sheet[XLSX.utils.encode_cell({ c: col, r: row - 1 })] as XLSX.CellObject | undefined;
}

function num(sheet: XLSX.WorkSheet, col: number, row: number): number | null {
  const c = cell(sheet, col, row);
  if (!c || c.t === "e" || c.v == null) return null;
  if (typeof c.v === "number") return Number.isFinite(c.v) ? c.v : null;
  if (typeof c.v === "string") {
    const limpo = c.v.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
    const n = Number(limpo);
    return limpo !== "" && Number.isFinite(n) ? n : null;
  }
  return null;
}

function text(sheet: XLSX.WorkSheet, col: number, row: number): string {
  const c = cell(sheet, col, row);
  if (!c || c.t === "e" || c.v == null) return "";
  return String(c.v).trim();
}

/** Serial do Excel -> ISO (só a data). Devolve null para vazio ou lixo. */
function serialParaISO(serial: number | null): string | null {
  if (serial == null || !Number.isFinite(serial) || serial < 20000 || serial > 80000) return null;
  return new Date(Math.round((serial - 25569) * 86400 * 1000)).toISOString().slice(0, 10);
}

/**
 * "DESPESAS FUNCIONÁRIOS" e "DESPESAS FUNCIONÁRIO" são o mesmo grupo em abas
 * diferentes; sem isto o painel mostraria duas fatias para a mesma coisa.
 */
export function normalizeGroup(raw: string): string {
  const n = normalize(raw);
  if (n.startsWith("DESPESAS FUNCION")) return "DESPESAS FUNCIONÁRIOS";
  if (n.startsWith("DESPESAS PESSOAL") || n.startsWith("DESP. SOCIO") || n.startsWith("DESPESAS SOCIO")) {
    return "DESPESAS PESSOAL DOS SÓCIOS";
  }
  if (n.startsWith("CUSTOS FIXO")) return "CUSTOS FIXOS";
  if (n.startsWith("CUSTOS VARIA")) return "CUSTOS VARIÁVEIS";
  if (n.startsWith("IMPOSTO")) return "IMPOSTOS";
  if (n.startsWith("FORNECEDOR")) return "FORNECEDOR";
  return raw.trim().toUpperCase();
}

function parseMonthSheet(sheet: XLSX.WorkSheet, sheetName: string, month: number): ParsedExpenseMonth {
  const expenses: ParsedExpense[] = [];
  let vazias = 0;

  for (let row = PRIMEIRA_LINHA; row <= MAX_LINHAS; row++) {
    const grupo = text(sheet, COL.GRUPO, row);
    const valor = num(sheet, COL.VALOR, row);

    if (!grupo && valor == null) {
      // Algumas abas têm buracos entre blocos; só para depois de uma sequência
      // longa de linhas vazias, para não perder lançamentos abaixo do buraco.
      if (++vazias > 25) break;
      continue;
    }
    vazias = 0;

    // Linha sem valor é subtotal/rascunho da planilha, não é lançamento.
    if (!grupo || valor == null) continue;

    expenses.push({
      group: normalizeGroup(grupo),
      description: text(sheet, COL.DESCRICAO, row) || "(sem descrição)",
      docType: text(sheet, COL.TIPO, row) || null,
      dueDate: serialParaISO(num(sheet, COL.VENCIMENTO, row)),
      amount: valor,
      paidAt: serialParaISO(num(sheet, COL.PAGAMENTO, row)),
      balance: num(sheet, COL.SALDO, row),
      sourceRow: row
    });
  }

  return {
    month,
    sheetName,
    expenses,
    total: expenses.reduce((acc, e) => acc + e.amount, 0),
    grossRevenue: null,
    isFuture: false
  };
}

/** Linha "FATURAMENTO BRUTO" da aba de resumo: um valor por mês, colunas B..M. */
function readGrossRevenue(sheet: XLSX.WorkSheet): Map<number, number> {
  const porMes = new Map<number, number>();
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1");

  for (let row = 1; row <= Math.min(range.e.r + 1, 60); row++) {
    if (!normalize(text(sheet, 0, row)).startsWith("FATURAMENTO BRUTO")) continue;
    for (let mes = 1; mes <= 12; mes++) {
      const valor = num(sheet, mes, row); // coluna B = 1 = janeiro
      if (valor != null && valor > 0) porMes.set(mes, valor);
    }
    break;
  }
  return porMes;
}

/** Ano pelo nome do arquivo ("DESPESAS 2026 ..."), com as datas como reserva. */
function yearFromName(fileName: string): number | null {
  const m = fileName.match(/(20\d{2})/);
  return m ? Number(m[1]) : null;
}

export function parseExpensesWorkbook(buffer: Buffer, fileName: string): ParsedExpensesWorkbook {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const warnings: string[] = [];
  const ignoredSheets: string[] = [];
  const months: ParsedExpenseMonth[] = [];

  const resumo = workbook.SheetNames.find((n) => normalize(n).startsWith("RESUMO DESPESAS"));
  const faturamento = resumo ? readGrossRevenue(workbook.Sheets[resumo]) : new Map<number, number>();
  if (!resumo) {
    warnings.push('A planilha não tem a aba "RESUMO DESPESAS ANO" — o faturamento de cada mês virá só das planilhas de vendas.');
  }

  for (const sheetName of workbook.SheetNames) {
    const mes = ABAS_MES[normalize(sheetName)];
    if (!mes) {
      ignoredSheets.push(sheetName);
      continue;
    }
    const parsed = parseMonthSheet(workbook.Sheets[sheetName], sheetName, mes);
    parsed.grossRevenue = faturamento.get(mes) ?? null;
    months.push(parsed);
  }

  // Marca os meses que ainda não aconteceram (do mês corrente em diante,
  // quando o arquivo é do ano corrente).
  const hoje = new Date();
  const anoArquivo = yearFromName(fileName);
  if (anoArquivo === hoje.getFullYear()) {
    const mesAtual = hoje.getMonth() + 1;
    for (const m of months) m.isFuture = m.month > mesAtual;
  } else if (anoArquivo != null && anoArquivo > hoje.getFullYear()) {
    for (const m of months) m.isFuture = true;
  }

  const futurosComLancamento = months.filter((m) => m.isFuture && m.expenses.length > 0);
  if (futurosComLancamento.length > 0) {
    const nomes = futurosComLancamento.map((m) => m.sheetName).join(", ");
    warnings.push(
      `As abas ${nomes} são de meses que ainda não aconteceram e já têm contas lançadas (previsão). Elas ficam de fora do painel para não inflar o resultado — quando o mês chegar, basta importar a planilha de novo.`
    );
  }

  const comLancamentos = months.filter((m) => m.expenses.length > 0);
  if (comLancamentos.length === 0) {
    warnings.push("Nenhum lançamento de despesa foi encontrado nas abas mensais.");
  }

  // Anos diferentes no mesmo arquivo indicam aba do ano anterior esquecida.
  const anosNasDatas = new Set<number>();
  for (const m of months) {
    for (const e of m.expenses) {
      const iso = e.dueDate ?? e.paidAt;
      if (iso) anosNasDatas.add(Number(iso.slice(0, 4)));
    }
  }
  const year = yearFromName(fileName) ?? (anosNasDatas.size === 1 ? Array.from(anosNasDatas)[0] : null);
  if (!year) {
    warnings.push(`Não deu para descobrir o ano pelo nome "${fileName}" — escolha o ano antes de confirmar.`);
  }

  return { year, months, ignoredSheets, warnings };
}
