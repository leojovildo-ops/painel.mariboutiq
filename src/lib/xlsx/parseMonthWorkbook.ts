/**
 * Leitor das planilhas mensais da Mari Boutique.
 *
 * O layout real (conferido contra "AGOSTO VENDAS 2026.xlsx" e "ABR 2026.xlsx")
 * NÃO é uma tabela única: cada aba tem TRÊS BLOCOS DE DIAS LADO A LADO, de uns
 * dez dias cada, e a linha de totais (19) totaliza apenas o bloco em que está.
 * O total do mês é a soma dos três blocos — é isso que bate com "Total Mês".
 *
 *   bloco 1: datas em D, dados E..K      (totais em E19..K19)
 *   bloco 2: datas em M, dados N..T      (totais em N19..T19)
 *   bloco 3: datas em V, dados W..AC     (totais em W19..AC19)
 *
 * Em cada bloco o cabeçalho fica na linha 7: Faturamento | Vendas | SALÃO |
 * ONLINE | Peças | PA | TM. Por isso nada aqui é lido por posição fixa: os
 * blocos são localizados procurando "Faturamento" na linha 7, e os demais
 * valores (metas, TKM, PA, projeção, dias úteis) são achados pelo rótulo,
 * não pelo endereço da célula. Assim uma coluna a mais ou a menos numa
 * planilha antiga não desalinha a leitura inteira.
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
  /** Dia do mês, vindo da data da própria planilha (não da posição da linha). */
  day: number;
  revenue: number | null;
  sales: number | null;
  salao: number | null;
  online: number | null;
  pieces: number | null;
}

export interface ParsedSheet {
  sheetName: string;
  /** Nome da vendedora, já sem o sufixo de período de experiência. */
  sellerName: string;
  /** Aba do período de experiência, anterior à carteira assinada. */
  isTrial: boolean;
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

/** Abreviações usadas nos nomes de arquivo ("ABR 2026.xlsx"). */
const MESES_ABREV: Record<string, number> = {
  JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6,
  JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12
};

export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** Abas de modelo/rascunho: "LOJA", "VEND", "VEND 1", "vend 2"... */
export function isTemplateSheet(name: string): boolean {
  const n = normalize(name);
  // Atenção: "<NOME> TESTE" NÃO entra aqui. Não é rascunho — é o período de
  // experiência da vendedora, antes da carteira assinada, e os dias dela
  // contam. Quem trata disso é `baseSellerName`, logo abaixo.
  return (
    n === "LOJA" ||
    /^VEND(EDORA)?S?\.?( ?\d+)?$/.test(n) ||
    /^(PLANILHA|PLAN|SHEET|FOLHA)\s*\d*$/.test(n)
  );
}

/**
 * Nome da vendedora por trás do nome da aba. A loja usa uma aba separada para
 * o período de experiência ("RAFAELA TESTE") e outra para depois da carteira
 * assinada ("RAFAELA") — as duas são a mesma pessoa e o mês dela é a soma das
 * duas, com uma observação dizendo isso.
 */
export function baseSellerName(sheetName: string): string {
  return normalize(sheetName)
    .replace(/\s*[-–(]?\s*(TESTE|EXPERIENCIA|EXP)\.?\s*\)?$/, "")
    .trim();
}

export function isTrialSheet(sheetName: string): boolean {
  return /\s(TESTE|EXPERIENCIA|EXP)\.?\)?$/.test(normalize(sheetName));
}

export function isStoreSheet(name: string): boolean {
  const n = normalize(name);
  return n.includes("MARI") && n.includes("BOUTIQUE");
}

const MAX_ROW = 40;
const HEADER_ROW = 7;
const FIRST_DAY_ROW = 8;

function cellAt(sheet: XLSX.WorkSheet, col: number, row: number): XLSX.CellObject | undefined {
  return sheet[XLSX.utils.encode_cell({ c: col, r: row - 1 })] as XLSX.CellObject | undefined;
}

/** Número da célula; null para vazio, texto não numérico e erros do Excel. */
function num(sheet: XLSX.WorkSheet, col: number, row: number): number | null {
  const c = cellAt(sheet, col, row);
  if (!c || c.t === "e" || c.v == null) return null;
  if (typeof c.v === "number") return Number.isFinite(c.v) ? c.v : null;
  if (typeof c.v === "string") {
    const cleaned = c.v.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
    const parsed = Number(cleaned);
    return cleaned !== "" && Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function text(sheet: XLSX.WorkSheet, col: number, row: number): string {
  const c = cellAt(sheet, col, row);
  if (!c || c.t === "e" || c.v == null) return "";
  return String(c.v).trim();
}

/**
 * Acha um rótulo em qualquer lugar da aba e devolve o valor da célula ao lado.
 * É assim que metas, TKM, PA, projeção e dias úteis são lidos — os endereços
 * mudam de uma planilha para outra, os rótulos não.
 */
function valueByLabel(
  sheet: XLSX.WorkSheet,
  matches: (label: string) => boolean,
  lastCol: number,
  fromRow = 2,
  toRow = MAX_ROW
): number | null {
  for (let row = fromRow; row <= toRow; row++) {
    for (let col = 0; col <= lastCol; col++) {
      const label = normalize(text(sheet, col, row));
      if (label && matches(label)) {
        // O valor costuma estar na célula seguinte; algumas planilhas deixam
        // uma célula vazia no meio, então olha até duas à direita.
        const direto = num(sheet, col + 1, row);
        if (direto != null) return direto;
        const pulando = num(sheet, col + 2, row);
        if (pulando != null) return pulando;
        return null;
      }
    }
  }
  return null;
}

interface Bloco {
  colDate: number;
  cols: Record<string, number>;
}

/** Localiza os blocos de dias pela palavra "Faturamento" na linha do cabeçalho. */
function findBlocks(sheet: XLSX.WorkSheet, lastCol: number): Bloco[] {
  const inicios: number[] = [];
  for (let col = 0; col <= lastCol; col++) {
    if (normalize(text(sheet, col, HEADER_ROW)) === "FATURAMENTO") inicios.push(col);
  }

  return inicios.map((inicio, i) => {
    const fim = i + 1 < inicios.length ? inicios[i + 1] - 2 : lastCol;
    const cols: Record<string, number> = {};
    for (let col = inicio; col <= fim; col++) {
      // Algumas planilhas chamam o canal da loja física de "SALÃO" e outras de
      // "LOJA"; é a mesma coluna, e o painel trata as duas como uma só.
      const bruto = normalize(text(sheet, col, HEADER_ROW));
      const label = bruto === "LOJA" ? "SALAO" : bruto;
      if (label && !(label in cols)) cols[label] = col;
    }
    // A coluna da data é a que vem imediatamente antes de "Faturamento".
    return { colDate: inicio - 1, cols };
  });
}

/** Serial de data do Excel -> ano/mês/dia (sistema 1900, o padrão). */
function fromSerial(serial: number): { year: number; month: number; day: number } | null {
  if (!Number.isFinite(serial) || serial < 20000 || serial > 80000) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function parseSheet(
  workbook: XLSX.WorkBook,
  sheetName: string
): { sheet: ParsedSheet; datas: Array<{ year: number; month: number }> } {
  const sheet = workbook.Sheets[sheetName];
  const warnings: string[] = [];
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1");
  const lastCol = range.e.c;

  const blocos = findBlocks(sheet, lastCol);
  if (blocos.length === 0) {
    warnings.push(`Aba "${sheetName}": não achei o cabeçalho "Faturamento" na linha ${HEADER_ROW}.`);
  }

  const days: ParsedDay[] = [];
  const diasComMes: Array<{ year: number; month: number }> = [];
  const datas: Array<{ year: number; month: number }> = [];
  let temSalao = false;
  let temOnline = false;

  for (const bloco of blocos) {
    if (bloco.cols["SALAO"] != null) temSalao = true;
    if (bloco.cols["ONLINE"] != null) temOnline = true;

    const col = (label: string) => bloco.cols[label];
    const lerLinha = (row: number) => {
      const ler = (label: string) => (col(label) != null ? num(sheet, col(label), row) : null);
      const lerInt = (label: string) => {
        const v = ler(label);
        return v == null ? null : Math.round(v);
      };
      return {
        revenue: ler("FATURAMENTO"),
        sales: lerInt("VENDAS"),
        salao: ler("SALAO"),
        online: ler("ONLINE"),
        pieces: lerInt("PECAS")
      };
    };

    // Primeira passada: o que cada linha do bloco tem.
    const linhas = [];
    for (let row = FIRST_DAY_ROW; row <= MAX_ROW; row++) {
      const serial = num(sheet, bloco.colDate, row);
      const data = serial == null ? null : fromSerial(serial);
      const valores = lerLinha(row);
      const temValor =
        valores.revenue != null || valores.sales != null || valores.pieces != null ||
        valores.salao != null || valores.online != null;
      linhas.push({ row, data, valores, temValor });
    }

    const comData = linhas.filter((l) => l.data != null);
    const primeiraComData = comData[0]?.row ?? -1;
    const ultimaComData = comData[comData.length - 1]?.row ?? -1;

    for (const linha of linhas) {
      let dia: number | null = null;
      let ano = 0;
      let mesLinha = 0;
      let inferido = false;

      if (linha.data) {
        dia = linha.data.day;
        ano = linha.data.year;
        mesLinha = linha.data.month;
      } else if (
        // Dia com valores mas SEM data preenchida. Só é recuperado quando cai
        // no meio dos dias já datados do bloco: fora disso a linha seria o
        // total ou a média do bloco, e somá-la contaria o mês duas vezes.
        linha.temValor &&
        linha.row > primeiraComData &&
        linha.row < ultimaComData
      ) {
        const anterior = comData.filter((l) => l.row < linha.row).pop();
        if (anterior?.data) {
          dia = anterior.data.day + (linha.row - anterior.row);
          ano = anterior.data.year;
          mesLinha = anterior.data.month;
          inferido = true;
          warnings.push(
            `Aba "${sheetName}": a linha ${linha.row} tem valores mas está sem a data preenchida; foi contada como dia ${dia}. Confira na planilha.`
          );
        }
      }

      if (dia == null) continue;
      if (!inferido) datas.push({ year: ano, month: mesLinha });

      diasComMes.push({ year: ano, month: mesLinha });
      days.push({ day: dia, ...linha.valores });
    }
  }

  // O ultimo bloco costuma ter 31 casas mesmo em meses curtos, entao pode
  // trazer o dia 1 do mes seguinte. Sem este corte, esse dia colidiria com o
  // dia 1 do proprio mes e ainda entraria no total.
  const contagemMes = new Map<string, number>();
  for (const d of datas) {
    const chave = `${d.year}-${d.month}`;
    contagemMes.set(chave, (contagemMes.get(chave) ?? 0) + 1);
  }
  const dominante = Array.from(contagemMes.entries()).sort((a, b) => b[1] - a[1])[0];
  if (dominante) {
    const [anoDom, mesDom] = dominante[0].split("-").map(Number);
    const forasteiros = diasComMes.filter((d) => d.year !== anoDom || d.month !== mesDom);
    if (forasteiros.length > 0) {
      warnings.push(
        `Aba "${sheetName}": ${forasteiros.length} dia(s) de outro mes na planilha foram ignorados.`
      );
    }
    for (let i = diasComMes.length - 1; i >= 0; i--) {
      if (diasComMes[i].year !== anoDom || diasComMes[i].month !== mesDom) {
        diasComMes.splice(i, 1);
        days.splice(i, 1);
      }
    }
  }

  days.sort((a, b) => a.day - b.day);

  // Duas linhas com a mesma data acontecem quando alguem digita o dia errado
  // (em junho/2026 o dia 29 foi lancado como 26). Descartar uma delas perderia
  // a venda daquele dia em silencio, entao os valores sao somados e o aviso
  // aponta a data repetida para ser corrigida na origem.
  const porDia = new Map<number, ParsedDay>();
  const repetidos = new Set<number>();
  for (const dia of days) {
    const atual = porDia.get(dia.day);
    if (!atual) {
      porDia.set(dia.day, { ...dia });
      continue;
    }
    repetidos.add(dia.day);
    const juntar = (a: number | null, b: number | null) => (a == null && b == null ? null : (a ?? 0) + (b ?? 0));
    porDia.set(dia.day, {
      day: dia.day,
      revenue: juntar(atual.revenue, dia.revenue),
      sales: juntar(atual.sales, dia.sales),
      salao: juntar(atual.salao, dia.salao),
      online: juntar(atual.online, dia.online),
      pieces: juntar(atual.pieces, dia.pieces)
    });
  }

  days.length = 0;
  days.push(...Array.from(porDia.values()).sort((a, b) => a.day - b.day));

  for (const dia of Array.from(repetidos).sort((a, b) => a - b)) {
    warnings.push(
      `Aba "${sheetName}": o dia ${dia} aparece em mais de uma linha e os valores foram somados. Confira na planilha — normalmente é uma data digitada errada, e uma dessas linhas deveria ser outro dia.`
    );
  }

  // Os totais saem da soma dos dias de TODOS os blocos. Somar é mais confiável
  // que ler a linha 19, que totaliza só o bloco em que está.
  const soma = (pick: (d: ParsedDay) => number | null) =>
    days.reduce<number>((acc, d) => acc + (pick(d) ?? 0), 0);

  const revenue = soma((d) => d.revenue);
  const salesCount = Math.round(soma((d) => d.sales));
  const pieces = Math.round(soma((d) => d.pieces));
  const salao = temSalao ? soma((d) => d.salao) : null;
  const online = temOnline ? soma((d) => d.online) : null;

  // A ausência de SALÃO/ONLINE não é um problema a ser reportado: várias abas
  // simplesmente não separam os canais, e o faturamento delas vem inteiro da
  // coluna "Faturamento", que é o número que vale. Os canais ficam apenas como
  // não informados.

  // Conferência contra o "Total Mês" que a própria planilha calcula.
  const totalMes = valueByLabel(sheet, (l) => l.startsWith("TOTAL MES"), lastCol);
  if (totalMes != null && Math.abs(totalMes - revenue) > 1) {
    warnings.push(
      `Aba "${sheetName}": a soma dos dias (${revenue.toFixed(2)}) não bate com o "Total Mês" da planilha (${totalMes.toFixed(2)}). Confira antes de salvar.`
    );
  }

  // TKM e PA vêm prontos ao lado do rótulo; com #DIV/0! são recalculados.
  let tkm = valueByLabel(sheet, (l) => l === "TKM", lastCol, 20);
  let pa = valueByLabel(sheet, (l) => l === "PA", lastCol, 20);
  if (tkm == null && salesCount > 0) tkm = revenue / salesCount;
  if (pa == null && salesCount > 0) pa = pieces / salesCount;

  const goals: ParsedGoal[] = [];
  for (const level of ["PRATA", "OURO", "DIAMANTE"] as const) {
    const target = valueByLabel(sheet, (l) => l === level, lastCol, 20);
    if (target != null && target > 0) goals.push({ level, target });
  }

  return {
    sheet: {
      sheetName: normalize(sheetName),
      sellerName: baseSellerName(sheetName),
      isTrial: isTrialSheet(sheetName),
      scope: isStoreSheet(sheetName) ? "STORE" : "SELLER",
      workingDays: (() => {
        const v = valueByLabel(sheet, (l) => l.startsWith("DIAS UTEIS"), lastCol, 2, 6);
        return v == null ? null : Math.round(v);
      })(),
      workedDays: (() => {
        const v = valueByLabel(sheet, (l) => l.startsWith("DIAS TRABALHADOS"), lastCol, 2, 6);
        return v == null ? null : Math.round(v);
      })(),
      revenue,
      salesCount,
      pieces,
      pa,
      tkm,
      salao,
      online,
      projection: valueByLabel(sheet, (l) => l.startsWith("PROJECAO"), lastCol, 20),
      goals,
      days,
      warnings
    },
    datas
  };
}

/** Mês/ano pelo nome do arquivo: "JULHO_2026.xlsx", "AGOSTO VENDAS 2026", "ABR 2026". */
export function periodFromFileName(fileName: string): { year: number; month: number } | null {
  const n = normalize(fileName);
  const yearMatch = n.match(/(20\d{2})/);
  if (!yearMatch) return null;

  const completo = Object.entries(MESES).find(([nome]) => n.includes(nome));
  if (completo) return { year: Number(yearMatch[1]), month: completo[1] };

  const abrev = Object.entries(MESES_ABREV).find(([nome]) => new RegExp(`\\b${nome}`).test(n));
  return abrev ? { year: Number(yearMatch[1]), month: abrev[1] } : null;
}

export function parseMonthWorkbook(buffer: Buffer, fileName: string): ParsedWorkbook {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const warnings: string[] = [];
  const ignoredSheets: string[] = [];
  const sellers: ParsedSheet[] = [];
  const todasAsDatas: Array<{ year: number; month: number }> = [];
  let store: ParsedSheet | null = null;

  for (const sheetName of workbook.SheetNames) {
    if (isTemplateSheet(sheetName)) {
      ignoredSheets.push(sheetName);
      continue;
    }
    const { sheet: parsed, datas } = parseSheet(workbook, sheetName);
    warnings.push(...parsed.warnings);
    todasAsDatas.push(...datas);
    if (parsed.scope === "STORE") store = parsed;
    else sellers.push(parsed);
  }

  if (!store) warnings.push('A planilha não tem a aba "Mari Boutique" — a tela de Metas da Loja ficará sem dados neste mês.');
  if (sellers.length === 0) warnings.push("Nenhuma aba de vendedora encontrada na planilha.");

  // O mês vem das datas da própria planilha (mais confiável que o nome do
  // arquivo); o nome do arquivo só entra se não houver data nenhuma.
  const contagem = new Map<string, number>();
  for (const d of todasAsDatas) {
    const chave = `${d.year}-${d.month}`;
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
  }
  const maisFrequente = Array.from(contagem.entries()).sort((a, b) => b[1] - a[1])[0];
  const periodoPlanilha = maisFrequente
    ? { year: Number(maisFrequente[0].split("-")[0]), month: Number(maisFrequente[0].split("-")[1]) }
    : null;
  const periodo = periodoPlanilha ?? periodFromFileName(fileName);

  if (!periodo) {
    warnings.push(
      `Não deu para descobrir o mês (nem pelas datas da planilha, nem pelo nome "${fileName}") — escolha o mês antes de confirmar.`
    );
  }

  sellers.sort((a, b) => b.revenue - a.revenue);

  return {
    year: periodo?.year ?? null,
    month: periodo?.month ?? null,
    store,
    sellers,
    ignoredSheets,
    warnings
  };
}
