import { prisma } from "@/lib/prisma";

export interface ResumoDeEspecie {
  /** Último saldo em espécie lançado (o cofre). */
  saldo: number | null;
  mesDoSaldo: number | null;
  /** Entrada média mensal em dinheiro, dos meses já informados. */
  entradaMedia: number | null;
  /**
   * Entrada do mês típico (mediana). É ela que projeta a reposição: um único
   * mês fora da curva puxa a média e faria o painel prometer um dinheiro que
   * não costuma entrar.
   */
  entradaTipica: number | null;
  /** Meses muito acima do típico, que não devem ser lidos como rotina. */
  mesesAtipicos: Array<{ month: number; amount: number }>;
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

  const ordenadas = entradas.map((e) => e.amount).sort((a, b) => a - b);
  const entradaTipica =
    ordenadas.length === 0
      ? null
      : ordenadas.length % 2 === 1
        ? ordenadas[(ordenadas.length - 1) / 2]
        : (ordenadas[ordenadas.length / 2 - 1] + ordenadas[ordenadas.length / 2]) / 2;

  // O dobro do mês típico é o corte: acima disso o mês foi exceção, e o painel
  // diz isso em vez de embutir a exceção na projeção.
  const mesesAtipicos =
    entradaTipica != null ? entradas.filter((e) => e.amount > entradaTipica * 2) : [];

  const valorPorViagem = parametro ? Number(parametro.value) : null;

  return {
    saldo,
    mesDoSaldo,
    entradaMedia,
    entradaTipica,
    mesesAtipicos,
    mesesInformados: entradas.length,
    valorPorViagem,
    viagensNoCaixa: saldo != null && valorPorViagem ? saldo / valorPorViagem : null,
    mesesPorViagem:
      entradaTipica && entradaTipica > 0 && valorPorViagem ? valorPorViagem / entradaTipica : null,
    entradas
  };
}
