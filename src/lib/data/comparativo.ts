import { prisma } from "@/lib/prisma";

export interface MesDoAno {
  month: number;
  revenue: number;
  salesCount: number;
  pieces: number;
}

export interface AnoComparado {
  year: number;
  meses: MesDoAno[];
  total: number;
  /** Meses com faturamento lançado — um ano parcial não pode ser lido como cheio. */
  mesesComDado: number;
  /** Variação do total contra o ano anterior, em %. */
  variacao: number | null;
  /**
   * Variação contra o ano anterior considerando só os meses que os dois anos
   * têm. Sem isso, comparar 2026 (7 meses) com 2025 (12) diria que a loja
   * despencou, quando o ano só não acabou.
   */
  variacaoComparavel: number | null;
  mesesComparados: number;
}

/** Faturamento da loja por ano e mês, de tudo que já foi importado. */
export async function getComparativoAnual(): Promise<AnoComparado[]> {
  const stats = await prisma.monthlyStats.findMany({
    where: { scope: "STORE" },
    include: { period: true },
    orderBy: [{ period: { year: "asc" } }, { period: { month: "asc" } }]
  });

  const porAno = new Map<number, MesDoAno[]>();
  for (const s of stats) {
    const revenue = Number(s.revenue);
    if (revenue <= 0) continue;
    const lista = porAno.get(s.period.year) ?? [];
    lista.push({
      month: s.period.month,
      revenue,
      salesCount: s.salesCount,
      pieces: s.pieces
    });
    porAno.set(s.period.year, lista);
  }

  const anos = Array.from(porAno.entries())
    .map(([year, meses]) => ({
      year,
      meses: meses.sort((a, b) => a.month - b.month),
      total: meses.reduce((acc, m) => acc + m.revenue, 0),
      mesesComDado: meses.length,
      variacao: null as number | null,
      variacaoComparavel: null as number | null,
      mesesComparados: 0
    }))
    .sort((a, b) => a.year - b.year);

  for (let i = 1; i < anos.length; i++) {
    const atual = anos[i];
    const anterior = anos[i - 1];

    if (anterior.total > 0) {
      atual.variacao = ((atual.total - anterior.total) / anterior.total) * 100;
    }

    // Mesma janela de meses nos dois anos.
    const mesesEmComum = atual.meses
      .map((m) => m.month)
      .filter((mes) => anterior.meses.some((m) => m.month === mes));

    if (mesesEmComum.length > 0) {
      const somaAtual = atual.meses
        .filter((m) => mesesEmComum.includes(m.month))
        .reduce((acc, m) => acc + m.revenue, 0);
      const somaAnterior = anterior.meses
        .filter((m) => mesesEmComum.includes(m.month))
        .reduce((acc, m) => acc + m.revenue, 0);

      atual.mesesComparados = mesesEmComum.length;
      if (somaAnterior > 0) {
        atual.variacaoComparavel = ((somaAtual - somaAnterior) / somaAnterior) * 100;
      }
    }
  }

  return anos.reverse();
}
