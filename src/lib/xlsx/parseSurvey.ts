/**
 * Leitor das respostas da pesquisa de satisfação (Google Forms).
 *
 * O arquivo exportado tem uma linha por resposta e o texto das perguntas como
 * cabeçalho. As colunas são achadas por palavra-chave, e não por posição ou
 * pelo texto exato, porque a pergunta pode ser reescrita no formulário sem que
 * ninguém lembre de avisar o sistema:
 *
 *   "Carimbo de data/hora"                        -> data da resposta
 *   "Quem foi a Consultora que te atendeu?"       -> vendedora
 *   "De 1 a 10, o quanto você indicaria..."       -> nota
 *
 * Serve tanto .csv quanto .xlsx: os dois são lidos pelo SheetJS.
 *
 * O e-mail e o contato do cliente NÃO são importados. O painel só precisa da
 * média por mês; guardar dado pessoal de cliente aumentaria o risco sem
 * nenhum ganho para as telas.
 */
import * as XLSX from "xlsx";
import { normalize } from "./parseMonthWorkbook";

export interface RespostaAgregada {
  year: number;
  month: number;
  /** Nome como veio no formulário ("Stefanny", "Outro"...). */
  nomeNoFormulario: string;
  respostas: number;
  media: number;
}

export interface ParsedSurvey {
  /** Uma linha por mês e por nome respondido. */
  porVendedora: RespostaAgregada[];
  /** Uma linha por mês, com todas as respostas do mês. */
  porMes: Array<{ year: number; month: number; respostas: number; media: number }>;
  totalRespostas: number;
  ignoradas: number;
  warnings: string[];
}

const SEM_NOME = "(não informado)";

function acharColuna(cabecalho: string[], termos: string[]): number {
  return cabecalho.findIndex((h) => {
    const n = normalize(h);
    return termos.some((termo) => n.includes(termo));
  });
}

/** Data em objeto, serial do Excel, texto dd/mm/aaaa ou ISO. */
function lerData(valor: unknown): { year: number; month: number } | null {
  if (valor == null || valor === "") return null;

  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return { year: valor.getFullYear(), month: valor.getMonth() + 1 };
  }

  if (typeof valor === "number" && valor > 20000 && valor < 80000) {
    const d = new Date(Math.round((valor - 25569) * 86400 * 1000));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
  }

  const texto = String(valor).trim();
  const br = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) {
    const a = Number(br[1]);
    const b = Number(br[2]);
    // O Google Forms em português exporta dd/mm/aaaa. Um número acima de 12 em
    // qualquer uma das posições tira a dúvida sozinho; no empate vale dd/mm,
    // senão "05/08" viraria maio em vez de 5 de agosto.
    const mes = a > 12 ? b : b > 12 ? a : b;
    return { year: Number(br[3]), month: mes };
  }

  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return { year: Number(iso[1]), month: Number(iso[2]) };

  const parsed = new Date(texto);
  if (!Number.isNaN(parsed.getTime())) {
    return { year: parsed.getFullYear(), month: parsed.getMonth() + 1 };
  }
  return null;
}

function lerNota(valor: unknown): number | null {
  if (valor == null || valor === "") return null;
  const n = typeof valor === "number" ? valor : Number(String(valor).replace(",", ".").trim());
  // A escala do formulário é de 1 a 10; qualquer coisa fora disso é lixo.
  return Number.isFinite(n) && n >= 0 && n <= 10 ? n : null;
}

export function parseSurvey(buffer: Buffer, fileName: string): ParsedSurvey {
  // CSV é lido como texto puro: deixar o SheetJS interpretar as datas faz ele
  // aplicar o formato americano e transformar 05/08 (5 de agosto) em maio.
  const ehCsv = /\.csv$/i.test(fileName);
  const workbook = ehCsv
    ? XLSX.read(buffer.toString("utf8"), { type: "string", raw: true })
    : XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const warnings: string[] = [];

  if (linhas.length === 0) {
    return { porVendedora: [], porMes: [], totalRespostas: 0, ignoradas: 0, warnings: [`"${fileName}" não tem nenhuma resposta.`] };
  }

  const cabecalho = Object.keys(linhas[0]);
  const iData = acharColuna(cabecalho, ["CARIMBO", "TIMESTAMP", "DATA"]);
  const iVendedora = acharColuna(cabecalho, ["CONSULTORA", "VENDEDORA", "ATENDEU"]);
  const iNota = acharColuna(cabecalho, ["INDICARIA", "DE 1 A 10", "RECOMEND", "NOTA"]);

  if (iData < 0) warnings.push('Não achei a coluna de data ("Carimbo de data/hora") — sem ela não dá para separar por mês.');
  if (iNota < 0) warnings.push('Não achei a coluna da nota ("De 1 a 10, o quanto você indicaria...").');
  if (iVendedora < 0) warnings.push('Não achei a coluna da consultora — as respostas vão contar só para a nota da loja.');
  if (iData < 0 || iNota < 0) {
    return { porVendedora: [], porMes: [], totalRespostas: 0, ignoradas: linhas.length, warnings };
  }

  const chave = (y: number, m: number, nome: string) => `${y}-${m}-${nome}`;
  const acumulado = new Map<string, { year: number; month: number; nome: string; soma: number; n: number }>();
  const mensal = new Map<string, { year: number; month: number; soma: number; n: number }>();
  let ignoradas = 0;

  for (const linha of linhas) {
    const data = lerData(linha[cabecalho[iData]]);
    const nota = lerNota(linha[cabecalho[iNota]]);
    if (!data || nota == null) {
      ignoradas += 1;
      continue;
    }

    const nome = iVendedora >= 0 ? String(linha[cabecalho[iVendedora]] ?? "").trim() || SEM_NOME : SEM_NOME;

    const k = chave(data.year, data.month, nome);
    const atual = acumulado.get(k) ?? { year: data.year, month: data.month, nome, soma: 0, n: 0 };
    atual.soma += nota;
    atual.n += 1;
    acumulado.set(k, atual);

    // A nota da loja usa TODAS as respostas do mês, inclusive as sem consultora
    // identificada — é a satisfação da loja, não a média das médias.
    const km = `${data.year}-${data.month}`;
    const mes = mensal.get(km) ?? { year: data.year, month: data.month, soma: 0, n: 0 };
    mes.soma += nota;
    mes.n += 1;
    mensal.set(km, mes);
  }

  if (ignoradas > 0) {
    warnings.push(`${ignoradas} resposta(s) sem data ou sem nota foram ignoradas.`);
  }

  return {
    porVendedora: Array.from(acumulado.values())
      .map((a) => ({
        year: a.year,
        month: a.month,
        nomeNoFormulario: a.nome,
        respostas: a.n,
        media: a.soma / a.n
      }))
      .sort((a, b) => a.year - b.year || a.month - b.month || b.respostas - a.respostas),
    porMes: Array.from(mensal.values())
      .map((m) => ({ year: m.year, month: m.month, respostas: m.n, media: m.soma / m.n }))
      .sort((a, b) => a.year - b.year || a.month - b.month),
    totalRespostas: linhas.length - ignoradas,
    ignoradas,
    warnings
  };
}
