import { prisma } from "@/lib/prisma";
import type { ParsedDay, ParsedSheet, ParsedWorkbook } from "@/lib/xlsx/parseMonthWorkbook";

/** Nome de exibição inicial a partir do nome da aba ("MAYARA" -> "Mayara"). */
function displayName(sheetName: string): string {
  return sheetName
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Junta as abas da mesma vendedora num mês só. A loja separa o período de
 * experiência ("RAFAELA TESTE") do período de carteira assinada ("RAFAELA"):
 * são a mesma pessoa, e o mês dela é a soma dos dois — senão ela apareceria
 * duas vezes no ranking, cada uma com metade do que vendeu.
 */
function combinarAbas(abas: ParsedSheet[]): { sheet: ParsedSheet; note: string } {
  const oficial = abas.find((a) => !a.isTrial) ?? abas[0];
  const soma = (pick: (s: ParsedSheet) => number | null) =>
    abas.reduce<number>((acc, s) => acc + (pick(s) ?? 0), 0);
  const somaOuNulo = (pick: (s: ParsedSheet) => number | null) =>
    abas.some((s) => pick(s) != null) ? soma(pick) : null;

  const revenue = soma((s) => s.revenue);
  const salesCount = Math.round(soma((s) => s.salesCount));
  const pieces = Math.round(soma((s) => s.pieces));

  // Os dias vêm de períodos diferentes do mesmo mês; se algum dia aparecer nos
  // dois, os valores se somam.
  const porDia = new Map<number, ParsedDay>();
  for (const aba of abas) {
    for (const dia of aba.days) {
      const atual = porDia.get(dia.day);
      if (!atual) {
        porDia.set(dia.day, { ...dia });
        continue;
      }
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
  }

  const nomes = abas
    .map((a) => `${a.sheetName}${a.isTrial ? " (experiência)" : ""}`)
    .join(" + ");

  return {
    sheet: {
      ...oficial,
      revenue,
      salesCount,
      pieces,
      // Recalculados sobre o total das duas abas: os valores prontos de cada
      // aba são médias parciais e não podem ser somados.
      pa: salesCount > 0 ? pieces / salesCount : null,
      tkm: salesCount > 0 ? revenue / salesCount : null,
      salao: somaOuNulo((s) => s.salao),
      online: somaOuNulo((s) => s.online),
      // Dias trabalhados somam (são períodos distintos); dias úteis do mês não.
      workedDays: abas.some((s) => s.workedDays != null) ? Math.round(soma((s) => s.workedDays)) : null,
      workingDays: oficial.workingDays,
      // Projeção é do mês inteiro: somar duas projeções contaria o mês duas vezes.
      projection: oficial.projection,
      goals: oficial.goals.length > 0 ? oficial.goals : (abas.find((a) => a.goals.length > 0)?.goals ?? []),
      days: Array.from(porDia.values()).sort((a, b) => a.day - b.day)
    },
    note: `Mês somado de ${abas.length} abas da planilha: ${nomes}.`
  };
}

async function upsertStats(
  periodId: string,
  sellerId: string | null,
  sheet: ParsedSheet,
  note: string | null = null
) {
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
    ? await prisma.monthlyStats.update({
        // Sem abas combinadas, a observação escrita à mão é preservada.
        where: { id: existing.id },
        data: note ? { ...data, note } : data
      })
    : await prisma.monthlyStats.create({
        data: { ...data, note, periodId, sellerId, scope: sheet.scope }
      });

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

  // Abas da mesma pessoa (experiência + carteira assinada) viram um registro só.
  const porVendedora = new Map<string, ParsedSheet[]>();
  for (const sheet of parsed.sellers) {
    const lista = porVendedora.get(sheet.sellerName) ?? [];
    lista.push(sheet);
    porVendedora.set(sheet.sellerName, lista);
  }

  let created = 0;
  let combinadas = 0;
  for (const [sellerName, abas] of Array.from(porVendedora.entries())) {
    const combinado = abas.length > 1 ? combinarAbas(abas) : { sheet: abas[0], note: null as string | null };
    if (abas.length > 1) combinadas += 1;

    const seller = await prisma.seller.findUnique({ where: { sheetName: sellerName } });
    const target =
      seller ??
      (await prisma.seller.create({
        data: { sheetName: sellerName, name: displayName(sellerName) }
      }));
    if (!seller) created += 1;

    await upsertStats(period.id, target.id, combinado.sheet, combinado.note);
  }

  if (parsed.store) await upsertStats(period.id, null, parsed.store);

  return {
    periodId: period.id,
    sellersSaved: porVendedora.size,
    sellersCreated: created,
    vendedorasComAbasCombinadas: combinadas
  };
}
