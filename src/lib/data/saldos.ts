import { prisma } from "@/lib/prisma";

export interface Conta {
  id: string;
  name: string;
  kind: "BANCO" | "MAQUININHA" | "ESPECIE";
  active: boolean;
}

export interface SaldoDaConta {
  accountId: string;
  opening: number | null;
  closing: number | null;
}

export interface MesDeSaldos {
  periodId: string;
  year: number;
  month: number;
  saldos: SaldoDaConta[];
  /** Soma das contas que têm valor; null quando nenhuma tem. */
  totalInicio: number | null;
  totalFim: number | null;
  /** Fim menos início, só quando os dois totais existem. */
  variacao: number | null;
  /** Contas cujo saldo inicial não bate com o final do mês anterior. */
  divergencias: Array<{ accountId: string; nome: string; anterior: number; informado: number }>;
  /** Contas sem nenhum dos dois valores preenchidos. */
  faltando: string[];
}

function n(valor: unknown): number | null {
  return valor == null ? null : Number(valor);
}

export async function listarContas(): Promise<Conta[]> {
  const contas = await prisma.account.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return contas.map((c) => ({ id: c.id, name: c.name, kind: c.kind, active: c.active }));
}

/** Anos que já têm mês registrado (de vendas, despesas ou saldos). */
export async function anosComPeriodo(): Promise<number[]> {
  const periods = await prisma.period.findMany({
    select: { year: true },
    distinct: ["year"],
    orderBy: { year: "desc" }
  });
  return periods.map((p) => p.year);
}

/**
 * Saldos do ano, mês a mês.
 *
 * O saldo inicial de um mês deveria ser o final do mês anterior. Quando não
 * for, o painel aponta a diferença em vez de escolher um dos dois: pode ser
 * erro de digitação, mas pode ser dinheiro que entrou ou saiu por fora, e
 * quem decide isso é quem conhece o extrato.
 */
export async function getSaldosDoAno(year: number, contas: Conta[]): Promise<MesDeSaldos[]> {
  const periods = await prisma.period.findMany({
    where: { year },
    include: { balances: true },
    orderBy: { month: "asc" }
  });

  const soma = (valores: Array<number | null>) => {
    const validos = valores.filter((v): v is number => v != null);
    return validos.length > 0 ? validos.reduce((a, b) => a + b, 0) : null;
  };

  const meses: MesDeSaldos[] = [];

  for (const period of periods) {
    const saldos: SaldoDaConta[] = contas.map((conta) => {
      const registro = period.balances.find((b) => b.accountId === conta.id);
      return {
        accountId: conta.id,
        opening: n(registro?.opening),
        closing: n(registro?.closing)
      };
    });

    const anterior = meses[meses.length - 1];
    const divergencias: MesDeSaldos["divergencias"] = [];
    if (anterior) {
      for (const conta of contas) {
        const fimAnterior = anterior.saldos.find((s) => s.accountId === conta.id)?.closing;
        const inicioAgora = saldos.find((s) => s.accountId === conta.id)?.opening;
        if (fimAnterior != null && inicioAgora != null && Math.abs(fimAnterior - inicioAgora) > 0.01) {
          divergencias.push({
            accountId: conta.id,
            nome: conta.name,
            anterior: fimAnterior,
            informado: inicioAgora
          });
        }
      }
    }

    const totalInicio = soma(saldos.map((s) => s.opening));
    const totalFim = soma(saldos.map((s) => s.closing));

    meses.push({
      periodId: period.id,
      year: period.year,
      month: period.month,
      saldos,
      totalInicio,
      totalFim,
      variacao: totalInicio != null && totalFim != null ? totalFim - totalInicio : null,
      divergencias,
      faltando: contas
        .filter((c) => {
          const s = saldos.find((x) => x.accountId === c.id);
          return s?.opening == null && s?.closing == null;
        })
        .map((c) => c.name)
    });
  }

  return meses;
}
