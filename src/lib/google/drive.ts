/**
 * Leitura da pasta do Google Drive onde ficam as planilhas da loja.
 *
 * Só leitura: o escopo pedido é `drive.readonly`, então o sistema não tem como
 * alterar nem apagar nada no Drive, mesmo que alguém queira.
 */
import { obterAccessToken } from "./serviceAccount";

export type TipoDeArquivo =
  | "VENDAS"
  | "DESPESAS"
  | "PESQUISA"
  | "ESTOQUE"
  | "ESTOQUE_VENDAS"
  | "HISTORICO"
  | "DESCONHECIDO";

export interface ArquivoDoDrive {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  /** Palpite pelo nome do arquivo; quem confirma é quem clica. */
  tipo: TipoDeArquivo;
  /** Planilha nativa do Google precisa ser exportada em vez de baixada. */
  nativa: boolean;
}

const MIME_SHEET = "application/vnd.google-apps.spreadsheet";
const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const MESES = [
  "JANEIRO", "FEVEREIRO", "MARCO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
  "JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"
];

/** Palpite do tipo pelo nome, para a tela já vir com a opção certa marcada. */
export function adivinharTipo(nome: string): TipoDeArquivo {
  const n = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

  // "Exportacao_Excel_24_08_2026" e o relatorio de vendas item a item do SISloja.
  if (/EXPORTACAO/.test(n)) return "ESTOQUE_VENDAS";
  if (/ESTOQUE|SISLOJA|LEVANTAMENTO|^PRODUTOS/.test(n)) return "ESTOQUE";
  if (/RESULTADOS/.test(n)) return "HISTORICO";
  if (/DESPESA|MKUP|MARKUP|FINANCEIR/.test(n)) return "DESPESAS";
  if (/PESQUISA|SATISFA|RESPOSTA|FORMULARIO|NPS/.test(n)) return "PESQUISA";
  if (/VENDA/.test(n)) return "VENDAS";
  // "ABR 2026", "JULHO_2026": mês no nome, sem indício de despesa ou pesquisa.
  if (MESES.some((mes) => new RegExp(`\\b${mes}`).test(n)) && /20\d{2}/.test(n)) return "VENDAS";
  return "DESCONHECIDO";
}

export async function listarArquivos(): Promise<ArquivoDoDrive[]> {
  const pasta = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!pasta) throw new Error("A pasta do Drive não está configurada (GOOGLE_DRIVE_FOLDER_ID).");

  const token = await obterAccessToken();
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", `'${pasta}' in parents and trashed = false`);
  url.searchParams.set("fields", "files(id,name,mimeType,modifiedTime)");
  url.searchParams.set("orderBy", "name");
  url.searchParams.set("pageSize", "100");
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("includeItemsFromAllDrives", "true");

  const resposta = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  if (resposta.status === 404) {
    throw new Error("Pasta não encontrada. Confira o ID e se ela foi compartilhada com a conta de serviço.");
  }
  if (!resposta.ok) {
    const detalhe = await resposta.text();
    console.error("[drive] falha ao listar:", detalhe.slice(0, 300));
    throw new Error("Não foi possível ler a pasta do Drive.");
  }

  const dados = (await resposta.json()) as {
    files: Array<{ id: string; name: string; mimeType: string; modifiedTime: string }>;
  };

  return dados.files
    // Subpastas e outros arquivos (fotos, PDFs) não interessam aqui.
    .filter((f) => f.mimeType === MIME_SHEET || /sheet|excel|csv/i.test(f.mimeType))
    .map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      modifiedTime: f.modifiedTime,
      tipo: adivinharTipo(f.name),
      nativa: f.mimeType === MIME_SHEET
    }));
}

/** Planilha nativa do Google sai como .xlsx na exportacao. */
export function nomeParaImportar(nome: string, nativa: boolean): string {
  return nativa && !/\.xlsx?$/i.test(nome) ? `${nome}.xlsx` : nome;
}

/** Baixa o arquivo. Planilha nativa do Google sai exportada como .xlsx. */
export async function baixarArquivo(id: string, nativa: boolean): Promise<Buffer> {
  const token = await obterAccessToken();

  const url = nativa
    ? `https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=${encodeURIComponent(MIME_XLSX)}`
    : `https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`;

  const resposta = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resposta.ok) {
    const detalhe = await resposta.text();
    console.error("[drive] falha ao baixar:", detalhe.slice(0, 300));
    throw new Error("Não foi possível baixar o arquivo do Drive.");
  }

  return Buffer.from(await resposta.arrayBuffer());
}
