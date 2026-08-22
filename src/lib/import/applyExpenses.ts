import { prisma } from "@/lib/prisma";
import type { ParsedExpensesWorkbook } from "@/lib/xlsx/parseExpensesWorkbook";

/**
 * Grava a planilha financeira já conferida. Reimportar o mesmo ano substitui
 * os lançamentos dos meses presentes no arquivo — a planilha é a fonte da
 * verdade e é editada o tempo todo, então acumular versões antigas só criaria
 * despesa duplicada.
 *
 * Meses futuros (com contas de previsão pré-lançadas no modelo) ficam de fora.
 */
export async function applyExpenses(parsed: ParsedExpensesWorkbook, year: number) {
  const meses = parsed.months.filter((m) => !m.isFuture && m.expenses.length > 0);

  let lancamentos = 0;
  for (const mes of meses) {
    const period = await prisma.period.upsert({
      where: { year_month: { year, month: mes.month } },
      update: {},
      create: { year, month: mes.month }
    });

    await prisma.expense.deleteMany({ where: { periodId: period.id } });
    if (mes.expenses.length > 0) {
      await prisma.expense.createMany({
        data: mes.expenses.map((e) => ({
          periodId: period.id,
          group: e.group,
          description: e.description,
          docType: e.docType,
          dueDate: e.dueDate ? new Date(`${e.dueDate}T00:00:00Z`) : null,
          amount: e.amount,
          paidAt: e.paidAt ? new Date(`${e.paidAt}T00:00:00Z`) : null,
          balance: e.balance,
          sourceRow: e.sourceRow
        }))
      });
      lancamentos += mes.expenses.length;
    }

    // O faturamento da planilha financeira é guardado à parte: quando o mês
    // também tiver a planilha de vendas importada, o painel usa a das vendas.
    if (mes.grossRevenue != null) {
      await prisma.financeMonth.upsert({
        where: { periodId: period.id },
        update: { grossRevenue: mes.grossRevenue },
        create: { periodId: period.id, grossRevenue: mes.grossRevenue }
      });
    }
  }

  return {
    year,
    mesesImportados: meses.map((m) => m.month),
    mesesIgnorados: parsed.months.filter((m) => m.isFuture && m.expenses.length > 0).map((m) => m.month),
    lancamentos
  };
}
