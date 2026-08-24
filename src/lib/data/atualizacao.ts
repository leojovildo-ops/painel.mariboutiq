import { prisma } from "@/lib/prisma";

/**
 * Quando os dados do painel foram atualizados pela última vez.
 *
 * Não é a data de hoje nem a do último deploy: é a data da última importação
 * que valeu — planilha confirmada ou estoque carregado. Quem olha o painel
 * precisa saber se está vendo o movimento de ontem ou o da semana passada.
 */
export async function ultimaAtualizacao(): Promise<Date | null> {
  const [importacao, estoque] = await Promise.all([
    prisma.importBatch.findFirst({
      where: { status: "CONFIRMED" },
      orderBy: { confirmedAt: "desc" },
      select: { confirmedAt: true }
    }),
    prisma.stockSnapshot.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true }
    })
  ]);

  const datas = [importacao?.confirmedAt, estoque?.createdAt].filter((d): d is Date => d != null);
  if (datas.length === 0) return null;

  return datas.reduce((maior, atual) => (atual > maior ? atual : maior));
}
