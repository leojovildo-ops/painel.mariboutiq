import { prisma } from "@/lib/prisma";

export interface GrupoTotal {
  group: string;
  total: number;
  /** Fatia do total de despesas do mês, em %. */
  share: number;
}

export interface MesFinanceiro {
  periodId: string;
  year: number;
  month: number;
  /** Faturamento do mês. Vem das vendas quando o mês foi importado; senão, da planilha financeira. */
  revenue: number | null;
  revenueSource: "VENDAS" | "FINANCEIRO" | null;
  expenses: number;
  /** Faturamento - despesas. Null quando não há faturamento conhecido. */
  profit: number | null;
  /** Lucro sobre faturamento, em %. */
  margin: number | null;
  groups: GrupoTotal[];
  /** Lançamentos sem data de pagamento no mês. */
  emAberto: number;
  emAbertoValor: number;
}

/** Anos que já têm despesa lançada. */
export async function listFinanceYears(): Promise<number[]> {
  const periods = await prisma.period.findMany({
    where: { expenses: { some: {} } },
    select: { year: true },
    distinct: ["year"],
    orderBy: { year: "desc" }
  });
  return periods.map((p) => p.year);
}

export async function getFinanceYear(year: number): Promise<MesFinanceiro[]> {
  const periods = await prisma.period.findMany({
    where: { year, expenses: { some: {} } },
    include: {
      expenses: true,
      finance: true,
      stats: { where: { scope: "STORE" } }
    },
    orderBy: { month: "asc" }
  });

  return periods.map((period) => {
    const expenses = period.expenses.reduce((acc, e) => acc + Number(e.amount), 0);

    const porGrupo = new Map<string, number>();
    for (const e of period.expenses) {
      porGrupo.set(e.group, (porGrupo.get(e.group) ?? 0) + Number(e.amount));
    }

    // Faturamento: a planilha de vendas é a fonte mais confiável, porque é
    // preenchida dia a dia na loja. A financeira entra quando o mês ainda não
    // teve a planilha de vendas importada.
    const vendas = period.stats[0] ? Number(period.stats[0].revenue) : null;
    const financeiro = period.finance?.grossRevenue != null ? Number(period.finance.grossRevenue) : null;
    const revenue = vendas && vendas > 0 ? vendas : financeiro;
    const revenueSource = vendas && vendas > 0 ? "VENDAS" : financeiro != null ? "FINANCEIRO" : null;

    const abertos = period.expenses.filter((e) => e.paidAt == null);

    return {
      periodId: period.id,
      year: period.year,
      month: period.month,
      revenue,
      revenueSource,
      expenses,
      profit: revenue == null ? null : revenue - expenses,
      margin: revenue == null || revenue === 0 ? null : ((revenue - expenses) / revenue) * 100,
      groups: Array.from(porGrupo.entries())
        .map(([group, total]) => ({
          group,
          total,
          share: expenses > 0 ? (total / expenses) * 100 : 0
        }))
        .sort((a, b) => b.total - a.total),
      emAberto: abertos.length,
      emAbertoValor: abertos.reduce((acc, e) => acc + Number(e.amount), 0)
    };
  });
}

/** Os maiores lançamentos do mês, para a tabela de detalhe do dashboard. */
export async function getMaioresLancamentos(periodId: string, limite = 12) {
  const expenses = await prisma.expense.findMany({
    where: { periodId },
    orderBy: { amount: "desc" },
    take: limite
  });
  return expenses.map((e) => ({
    id: e.id,
    group: e.group,
    description: e.description,
    amount: Number(e.amount),
    dueDate: e.dueDate,
    paidAt: e.paidAt
  }));
}
