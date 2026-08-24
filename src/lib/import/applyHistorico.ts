import { prisma } from "@/lib/prisma";
import type { ParsedHistorico } from "@/lib/xlsx/parseHistorico";

/**
 * Grava o histórico da loja como resultado mensal consolidado.
 *
 * Só cria o que ainda não existe: um mês que já veio da planilha mensal de
 * vendas tem abertura por vendedora, metas e dia a dia, e não pode ser
 * substituído por um resumo de uma linha. O histórico serve para os anos que
 * o sistema não viveu.
 */
export async function applyHistorico(parsed: ParsedHistorico) {
  let criados = 0;
  const preservados: string[] = [];

  for (const mes of parsed.meses) {
    const period = await prisma.period.upsert({
      where: { year_month: { year: mes.year, month: mes.month } },
      update: {},
      create: { year: mes.year, month: mes.month }
    });

    const existente = await prisma.monthlyStats.findFirst({
      where: { periodId: period.id, scope: "STORE" }
    });

    if (existente) {
      preservados.push(`${String(mes.month).padStart(2, "0")}/${mes.year}`);
      continue;
    }

    await prisma.monthlyStats.create({
      data: {
        scope: "STORE",
        periodId: period.id,
        revenue: mes.revenue,
        salesCount: mes.salesCount == null ? 0 : Math.round(mes.salesCount),
        pieces: mes.pieces == null ? 0 : Math.round(mes.pieces),
        tkm: mes.tkm,
        pa: mes.pa,
        note: "Resultado consolidado, importado do histórico da loja."
      }
    });
    criados += 1;
  }

  return { criados, preservados, anos: parsed.anos };
}
