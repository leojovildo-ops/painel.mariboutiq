import { prisma } from "@/lib/prisma";

export interface ResumoDeEspecie {
  /** Último saldo em espécie lançado (o cofre). */
  saldo: number | null;
  mesDoSaldo: number | null;
  /** Entrada média mensal em dinheiro, dos meses já informados. */
  entradaMedia: number | null;
  mesesInformados: number;
  /** Quanto uma viagem de compras costuma levar em espécie. */
  valorPorViagem: number | null;
  /** Quantas viagens o cofre paga hoje. */
  viagensNoCaixa: number | null;
  /** Meses de entrada em dinheiro para juntar mais uma viagem. */
  mesesPorViagem: number | null;
  entradas: Array<{ month: number; amount: number }>;
}

/**
 * Dinheiro em espécie: quanto tem, quanto entra e para quantas viagens dá.
 *
 * O saldo sozinho não decide nada. Quem compra precisa saber se dá para viajar
 * agora e, se não der, em quanto tempo dá — por isso o cofre é lido junto com
 * a entrada mensal em dinheiro e o custo médio de uma viagem.
 */
export async function getResumoDeEspecie(year: number): Promise<ResumoDeEspecie> {
  const [conta, entradasBrutas, parametro] = await Promise.all([
    prisma.account.findFirst({ where: { kind: "ESPECIE" } }),
    prisma.cashInflow.findMany({
      where: { period: { year } },
      include: { period: true },
      orderBy: { period: { month: "asc" } }
    }),
    prisma.storeSetting.findUnique({ where: { key: "viagem_compras_media" } })
  ]);

  const entradas = entradasBrutas.map((e) => ({ month: e.period.month, amount: Number(e.amount) }));

  let saldo: number | null = null;
  let mesDoSaldo: number | null = null;
  if (conta) {
    const ultimo = await prisma.accountBalance.findFirst({
      where: { accountId: conta.id, closing: { not: null }, period: { year } },
      include: { period: true },
      orderBy: { period: { month: "desc" } }
    });
    if (ultimo?.closing != null) {
      saldo = Number(ultimo.closing);
      mesDoSaldo = ultimo.period.month;
    }
  }

  const entradaMedia =
    entradas.length > 0 ? entradas.reduce((s, e) => s + e.amount, 0) / entradas.length : null;
  const valorPorViagem = parametro ? Number(parametro.value) : null;

  return {
    saldo,
    mesDoSaldo,
    entradaMedia,
    mesesInformados: entradas.length,
    valorPorViagem,
    viagensNoCaixa: saldo != null && valorPorViagem ? saldo / valorPorViagem : null,
    mesesPorViagem: entradaMedia && entradaMedia > 0 && valorPorViagem ? valorPorViagem / entradaMedia : null,
    entradas
  };
}
