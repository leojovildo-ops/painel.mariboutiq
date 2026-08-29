/**
 * Lembrete de atualizar a planilha de estoque.
 *
 * O estoque gira todo dia, então a foto guardada envelhece rápido: passados
 * DIAS_DE_VALIDADE sem uma planilha nova, os números de "parado" e de margem
 * já não descrevem a loja de hoje, e o painel avisa em vez de deixar quem olha
 * confiar num dado velho sem perceber.
 */
import { prisma } from "@/lib/prisma";

export const DIAS_DE_VALIDADE = 10;

export interface AvisoDeEstoque {
  /** Dias desde a última planilha de estoque importada, ou null se nunca houve. */
  dias: number | null;
  vencido: boolean;
  fileName: string | null;
}

export async function avisoDeEstoque(): Promise<AvisoDeEstoque> {
  const ultimo = await prisma.stockSnapshot.findFirst({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, fileName: true }
  });

  if (!ultimo) return { dias: null, vencido: true, fileName: null };

  const dias = Math.floor((Date.now() - ultimo.createdAt.getTime()) / 86400000);
  return { dias, vencido: dias >= DIAS_DE_VALIDADE, fileName: ultimo.fileName };
}
