import { prisma } from "@/lib/prisma";

export type StatusDeCaixa = "POSITIVO" | "ATENCAO" | "NEGATIVO";

export interface MesDeCaixa {
  year: number;
  month: number;
  revenue: number | null;
  expenses: number | null;
  /** Resultado do mês em reais, não percentual. */
  margin: number | null;
  /** Margem sobre a receita, calculada aqui só para exibição. */
  margemPercentual: number | null;
  bancos: Array<{ nome: string; delta: number | null }>;
  cashDeltaTotal: number | null;
  status: StatusDeCaixa;
  note: string | null;
}

export interface ResumoDeCaixa {
  meses: MesDeCaixa[];
  /** Soma da variação de caixa no período. */
  variacaoAcumulada: number;
  porStatus: Record<StatusDeCaixa, number>;
  /** Banco que mais consumiu caixa no acumulado. */
  bancoQueMaisConsumiu: { nome: string; total: number } | null;
}

function n(valor: unknown): number | null {
  return valor == null ? null : Number(valor);
}

/**
 * Leitura de caixa mês a mês.
 *
 * Os números e o texto vêm prontos da tabela `cash_flow_insights`, preenchida
 * a partir dos extratos. Esta tela é a única do painel que não recalcula
 * nada: o valor dela está justamente na explicação escrita à mão — parcela de
 * empréstimo, retirada de sócio —, que nenhuma conta automática deduziria dos
 * totais.
 */
export async function getResumoDeCaixa(year: number): Promise<ResumoDeCaixa> {
  const linhas = await prisma.cashFlowInsight.findMany({
    where: { period: { year } },
    include: { period: true },
    orderBy: { period: { month: "asc" } }
  });

  const meses: MesDeCaixa[] = linhas.map((l) => {
    const revenue = n(l.revenue);
    const margin = n(l.margin);

    return {
      year: l.period.year,
      month: l.period.month,
      revenue,
      expenses: n(l.expenses),
      margin,
      margemPercentual: revenue && revenue > 0 && margin != null ? (margin / revenue) * 100 : null,
      bancos: [
        { nome: "Bradesco", delta: n(l.cashDeltaBradesco) },
        { nome: "Stone", delta: n(l.cashDeltaStone) },
        { nome: "Infinity", delta: n(l.cashDeltaInfinity) }
      ],
      cashDeltaTotal: n(l.cashDeltaTotal),
      status: (l.status as StatusDeCaixa) ?? "ATENCAO",
      note: l.note
    };
  });

  const porStatus: Record<StatusDeCaixa, number> = { POSITIVO: 0, ATENCAO: 0, NEGATIVO: 0 };
  for (const m of meses) porStatus[m.status] += 1;

  const acumuladoPorBanco = new Map<string, number>();
  for (const m of meses) {
    for (const b of m.bancos) {
      if (b.delta == null) continue;
      acumuladoPorBanco.set(b.nome, (acumuladoPorBanco.get(b.nome) ?? 0) + b.delta);
    }
  }
  const pior = Array.from(acumuladoPorBanco.entries()).sort((a, b) => a[1] - b[1])[0];

  return {
    meses,
    variacaoAcumulada: meses.reduce((acc, m) => acc + (m.cashDeltaTotal ?? 0), 0),
    porStatus,
    bancoQueMaisConsumiu: pior && pior[1] < 0 ? { nome: pior[0], total: pior[1] } : null
  };
}

/** Anos que já têm leitura de caixa registrada. */
export async function anosComCaixa(): Promise<number[]> {
  const linhas = await prisma.cashFlowInsight.findMany({
    include: { period: true }
  });
  return Array.from(new Set(linhas.map((l) => l.period.year))).sort((a, b) => b - a);
}
