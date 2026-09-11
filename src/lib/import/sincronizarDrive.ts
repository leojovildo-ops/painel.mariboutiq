/**
 * O robô que olha a pasta do Drive e importa sozinho o que mudou.
 *
 * A regra é o `modifiedTime` do próprio Drive: cada arquivo já importado fica
 * registrado em DriveSync com a data que ele tinha na hora, e só volta para a
 * fila quando alguém mexe na planilha de novo. Assim rodar o robô duas vezes
 * no mesmo dia não reimporta nada.
 */
import { prisma } from "@/lib/prisma";
import { baixarArquivo, listarArquivos, nomeParaImportar, type ArquivoDoDrive } from "@/lib/google/drive";
import { importarConteudo, type TipoImportavel } from "@/lib/import/importarConteudo";

/**
 * Tipos em que a planilha nova substitui a tabela inteira, e não um mês dela.
 * Duas planilhas dessas na pasta se sobrescrevem, e quem valeria seria a
 * última da ordem alfabética — resultado que muda com o nome do arquivo. Só a
 * mais recente entra; a anterior é uma cópia velha do mesmo levantamento.
 */
const SUBSTITUEM_TUDO = new Set(["ESTOQUE", "ESTOQUE_VENDAS", "HISTORICO", "PESQUISA"]);

/** Qual planilha vale por tipo: a que foi alterada por último no Drive. */
function maisRecentePorTipo(arquivos: ArquivoDoDrive[]): Map<string, ArquivoDoDrive> {
  const vencedor = new Map<string, ArquivoDoDrive>();

  for (const arquivo of arquivos) {
    if (!SUBSTITUEM_TUDO.has(arquivo.tipo)) continue;
    const atual = vencedor.get(arquivo.tipo);
    if (!atual || new Date(arquivo.modifiedTime) > new Date(atual.modifiedTime)) {
      vencedor.set(arquivo.tipo, arquivo);
    }
  }

  return vencedor;
}

export interface ResultadoDoArquivo {
  nome: string;
  tipo: string;
  situacao: "importado" | "erro";
  detalhe: string;
  avisos: string[];
}

export interface ResultadoDaSincronizacao {
  verificados: number;
  importados: ResultadoDoArquivo[];
  /** Já estavam em dia: nada mudou no Drive desde a última importação. */
  semMudanca: number;
  /** Arquivos cujo tipo não foi reconhecido pelo nome. */
  ignorados: string[];
}

/**
 * `forcar` reimporta tudo mesmo sem mudança — serve para a primeira rodada e
 * para quando alguém quer refazer a carga na mão.
 */
export async function sincronizarDrive({
  forcar = false
}: { forcar?: boolean } = {}): Promise<ResultadoDaSincronizacao> {
  // As importações precisam de um autor. O robô assume o Administrador mais
  // antigo, que é o dono da conta que configurou o Drive.
  const autor = await prisma.user.findFirst({
    where: { role: "ADMIN", active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true }
  });
  if (!autor) throw new Error("Nenhum Administrador ativo para registrar a importação.");

  const arquivos = await listarArquivos();
  const registros = await prisma.driveSync.findMany();
  const porId = new Map(registros.map((r) => [r.fileId, r]));

  const resultado: ResultadoDaSincronizacao = {
    verificados: arquivos.length,
    importados: [],
    semMudanca: 0,
    ignorados: []
  };

  const valePorTipo = maisRecentePorTipo(arquivos);

  for (const arquivo of arquivos) {
    if (arquivo.tipo === "DESCONHECIDO") {
      resultado.ignorados.push(arquivo.name);
      continue;
    }

    const modificadoEm = new Date(arquivo.modifiedTime);

    // Cópia mais velha de um levantamento que já tem versão nova na pasta:
    // não entra, e vira aviso para alguém limpar a pasta.
    const vale = valePorTipo.get(arquivo.tipo);
    if (vale && vale.id !== arquivo.id) {
      await registrar(arquivo, modificadoEm, false, `Ignorado: "${vale.name}" é mais recente e substitui esta planilha inteira. Deixe só a mais nova na pasta do Drive.`, []);
      resultado.importados.push({
        nome: arquivo.name,
        tipo: arquivo.tipo,
        situacao: "erro",
        detalhe: `Ignorado: "${vale.name}" é mais recente.`,
        avisos: []
      });
      continue;
    }
    const anterior = porId.get(arquivo.id);
    if (!forcar && anterior && anterior.modifiedTime.getTime() >= modificadoEm.getTime()) {
      resultado.semMudanca += 1;
      continue;
    }

    // Um arquivo que falha não pode derrubar a rodada: os outros continuam.
    let situacao: ResultadoDoArquivo["situacao"] = "importado";
    let detalhe: string;
    let avisos: string[] = [];
    try {
      const buffer = await baixarArquivo(arquivo.id, arquivo.nativa);
      const importado = await importarConteudo(
        buffer,
        nomeParaImportar(arquivo.name, arquivo.nativa),
        arquivo.tipo as TipoImportavel,
        autor.id
      );

      avisos = importado.avisos;
      if (importado.erro) {
        situacao = "erro";
        detalhe = importado.erro;
      } else {
        detalhe = importado.resumo ?? "Importado.";
      }
    } catch (error) {
      situacao = "erro";
      detalhe = error instanceof Error ? error.message : "Falha inesperada ao importar.";
      console.error(`[drive] falha em "${arquivo.name}":`, error);
    }

    await registrar(arquivo, modificadoEm, situacao !== "erro", detalhe, avisos);

    resultado.importados.push({ nome: arquivo.name, tipo: arquivo.tipo, situacao, detalhe, avisos });
  }

  return resultado;
}

/**
 * Guarda o que aconteceu com o arquivo. Vale também no erro: senão a mesma
 * planilha quebrada seria baixada e reprocessada em toda rodada. Corrigir a
 * planilha no Drive muda o `modifiedTime` e devolve o arquivo para a fila.
 */
async function registrar(
  arquivo: ArquivoDoDrive,
  modificadoEm: Date,
  ok: boolean,
  detalhe: string,
  avisos: string[]
): Promise<void> {
  const dados = {
    fileName: arquivo.name,
    tipo: arquivo.tipo,
    modifiedTime: modificadoEm,
    ok,
    detail: detalhe.slice(0, 500),
    warnings: avisos
  };

  await prisma.driveSync.upsert({
    where: { fileId: arquivo.id },
    // Problema novo volta a pedir atenção, mesmo que o anterior já tivesse
    // sido dado por visto.
    update: { ...dados, seenAt: !ok || avisos.length > 0 ? null : new Date() },
    create: { fileId: arquivo.id, ...dados }
  });
}
