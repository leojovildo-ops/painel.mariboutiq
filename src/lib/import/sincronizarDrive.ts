/**
 * O robô que olha a pasta do Drive e importa sozinho o que mudou.
 *
 * A regra é o `modifiedTime` do próprio Drive: cada arquivo já importado fica
 * registrado em DriveSync com a data que ele tinha na hora, e só volta para a
 * fila quando alguém mexe na planilha de novo. Assim rodar o robô duas vezes
 * no mesmo dia não reimporta nada.
 */
import { prisma } from "@/lib/prisma";
import { baixarArquivo, listarArquivos, nomeParaImportar } from "@/lib/google/drive";
import { importarConteudo, type TipoImportavel } from "@/lib/import/importarConteudo";

export interface ResultadoDoArquivo {
  nome: string;
  tipo: string;
  situacao: "importado" | "aguardando" | "erro";
  detalhe: string;
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

  for (const arquivo of arquivos) {
    if (arquivo.tipo === "DESCONHECIDO") {
      resultado.ignorados.push(arquivo.name);
      continue;
    }

    const modificadoEm = new Date(arquivo.modifiedTime);
    const anterior = porId.get(arquivo.id);
    if (!forcar && anterior && anterior.modifiedTime.getTime() >= modificadoEm.getTime()) {
      resultado.semMudanca += 1;
      continue;
    }

    // Um arquivo que falha não pode derrubar a rodada: os outros continuam.
    let situacao: ResultadoDoArquivo["situacao"] = "importado";
    let detalhe: string;
    try {
      const buffer = await baixarArquivo(arquivo.id, arquivo.nativa);
      const importado = await importarConteudo(
        buffer,
        nomeParaImportar(arquivo.name, arquivo.nativa),
        arquivo.tipo as TipoImportavel,
        autor.id,
        { confirmarSozinho: true }
      );

      if (importado.erro) {
        situacao = "erro";
        detalhe = importado.erro;
      } else {
        situacao = importado.pendente ? "aguardando" : "importado";
        detalhe = importado.resumo ?? "Importado.";
      }
    } catch (error) {
      situacao = "erro";
      detalhe = error instanceof Error ? error.message : "Falha inesperada ao importar.";
      console.error(`[drive] falha em "${arquivo.name}":`, error);
    }

    // O registro é gravado mesmo no erro: senão o mesmo arquivo quebrado seria
    // baixado e reprocessado em toda rodada. Corrigir a planilha no Drive muda
    // o modifiedTime e devolve o arquivo para a fila.
    await prisma.driveSync.upsert({
      where: { fileId: arquivo.id },
      update: {
        fileName: arquivo.name,
        tipo: arquivo.tipo,
        modifiedTime: modificadoEm,
        ok: situacao !== "erro",
        detail: detalhe.slice(0, 500)
      },
      create: {
        fileId: arquivo.id,
        fileName: arquivo.name,
        tipo: arquivo.tipo,
        modifiedTime: modificadoEm,
        ok: situacao !== "erro",
        detail: detalhe.slice(0, 500)
      }
    });

    resultado.importados.push({ nome: arquivo.name, tipo: arquivo.tipo, situacao, detalhe });
  }

  return resultado;
}
