/**
 * O que deu errado na importação automática.
 *
 * Ninguém mais confere planilha antes de gravar — ela entra assim que muda no
 * Drive. O preço disso é que um erro passaria despercebido, então tudo que a
 * leitura estranhou fica pendurado aqui até alguém dar por visto.
 */
import { prisma } from "@/lib/prisma";

export interface AvisoDeImportacao {
  fileId: string;
  fileName: string;
  tipo: string;
  /** false = nada foi gravado deste arquivo. */
  ok: boolean;
  /** O erro que impediu a gravação, quando houve. */
  erro: string | null;
  /** Ressalvas de uma importação que mesmo assim valeu. */
  avisos: string[];
  quando: string;
}

function comoLista(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.filter((v): v is string => typeof v === "string") : [];
}

export async function avisosDeImportacao(): Promise<AvisoDeImportacao[]> {
  const registros = await prisma.driveSync.findMany({
    where: { seenAt: null, OR: [{ ok: false }, { NOT: { warnings: { equals: [] } } }] },
    orderBy: { syncedAt: "desc" }
  });

  return registros
    .map((r) => ({
      fileId: r.fileId,
      fileName: r.fileName,
      tipo: r.tipo,
      ok: r.ok,
      erro: r.ok ? null : r.detail,
      avisos: comoLista(r.warnings),
      quando: r.syncedAt.toISOString()
    }))
    // Um registro sem erro e sem ressalva não tem o que notificar, mesmo que o
    // banco guarde `warnings` como null em vez de lista vazia.
    .filter((a) => !a.ok || a.avisos.length > 0);
}

export async function contarAvisos(): Promise<number> {
  return (await avisosDeImportacao()).length;
}
