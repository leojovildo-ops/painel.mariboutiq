import { prisma } from "@/lib/prisma";
import type { ParsedSheet, ParsedWorkbook } from "@/lib/xlsx/parseMonthWorkbook";

/** Nome de exibição inicial a partir do nome da aba ("MAYARA" -> "Mayara"). */
function displayName(sheetName: string): string {
  return sheetName
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function upsertStats(periodId: string, sellerId: string | null, sheet: ParsedSheet) {
  const data = {
    revenue: sheet.revenue,
    salesCount: sheet.salesCount,
    pieces: sheet.pieces,
    pa: sheet.pa,
    tkm: sheet.tkm,
    salao: sheet.salao,
    online: sheet.online,
    workingDays: sheet.workingDays,
    workedDays: sheet.workedDays,
    projection: sheet.projection,
    // Reimportar o mês substitui os números da planilha, inclusive correções
    // manuais anteriores (a tela de confirmação avisa antes de salvar).
    editedAt: null,
    editedById: null
  };

  const existing = await prisma.monthlyStats.findFirst({
    where: { periodId, scope: sheet.scope, sellerId }
  });

  const stats = existing
    ? await prisma.monthlyStats.update({ where: { id: existing.id }, data })
    : await prisma.monthlyStats.create({ data: { ...data, periodId, sellerId, scope: sheet.scope } });

  await prisma.goal.deleteMany({ where: { statsId: stats.id } });
  if (sheet.goals.length > 0) {
    await prisma.goal.createMany({
      data: sheet.goals.map((goal) => ({ statsId: stats.id, level: goal.level, target: goal.target }))
    });
  }

  await prisma.dailyEntry.deleteMany({ where: { statsId: stats.id } });
  const days = sheet.days.filter(
    (d) => d.revenue != null || d.sales != null || d.pieces != null || d.salao != null || d.online != null
  );
  if (days.length > 0) {
    await prisma.dailyEntry.createMany({
      data: days.map((d) => ({
        statsId: stats.id,
        day: d.day,
        revenue: d.revenue,
        sales: d.sales,
        salao: d.salao,
        online: d.online,
        pieces: d.pieces
      }))
    });
  }

  return stats.id;
}

/**
 * Grava no banco o conteúdo já conferido de uma planilha mensal.
 * Vendedoras novas (abas que ainda não existiam) são criadas aqui — a equipe
 * muda de mês para mês e nada é fixo no código.
 */
export async function applyWorkbook(parsed: ParsedWorkbook, year: number, month: number) {
  const period = await prisma.period.upsert({
    where: { year_month: { year, month } },
    update: {},
    create: { year, month }
  });

  let created = 0;
  for (const sheet of parsed.sellers) {
    const seller = await prisma.seller.findUnique({ where: { sheetName: sheet.sheetName } });
    const target =
      seller ??
      (await prisma.seller.create({
        data: { sheetName: sheet.sheetName, name: displayName(sheet.sheetName) }
      }));
    if (!seller) created += 1;
    await upsertStats(period.id, target.id, sheet);
  }

  if (parsed.store) await upsertStats(period.id, null, parsed.store);

  return { periodId: period.id, sellersSaved: parsed.sellers.length, sellersCreated: created };
}
