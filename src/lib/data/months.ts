import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeLevel, type GoalLevelName, type LevelProgress } from "@/lib/levels";

/** Prisma devolve Decimal; as telas trabalham com number | null ("sem dado"). */
function toNumber(value: Prisma.Decimal | null): number | null {
  return value == null ? null : Number(value);
}

export interface PeriodOption {
  id: string;
  year: number;
  month: number;
  /** "2026-07", usado na URL (?mes=2026-07). */
  slug: string;
}

export interface SellerRow {
  sellerId: string;
  name: string;
  active: boolean;
  revenue: number;
  salesCount: number;
  pieces: number;
  pa: number | null;
  tkm: number | null;
  salao: number | null;
  online: number | null;
  /** Projeção de fechamento do mês (linha "Projeção" da aba da vendedora). */
  projection: number | null;
  editedAt: Date | null;
  level: LevelProgress;
  position: number;
}

export interface StoreRow {
  revenue: number;
  salesCount: number;
  pieces: number;
  pa: number | null;
  tkm: number | null;
  projection: number | null;
  workingDays: number | null;
  workedDays: number | null;
  level: LevelProgress;
}

export function periodSlug(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Meses já importados, do mais recente para o mais antigo. */
export async function listPeriods(): Promise<PeriodOption[]> {
  const periods = await prisma.period.findMany({
    where: { stats: { some: {} } },
    orderBy: [{ year: "desc" }, { month: "desc" }]
  });
  return periods.map((p) => ({ id: p.id, year: p.year, month: p.month, slug: periodSlug(p.year, p.month) }));
}

/** Mês pedido na URL; sem parâmetro (ou inválido), o mais recente importado. */
export function resolvePeriod(periods: PeriodOption[], slug?: string): PeriodOption | null {
  if (periods.length === 0) return null;
  return periods.find((p) => p.slug === slug) ?? periods[0];
}

export async function getSellerRanking(periodId: string): Promise<SellerRow[]> {
  const stats = await prisma.monthlyStats.findMany({
    where: { periodId, scope: "SELLER" },
    include: { seller: true, goals: true },
    orderBy: { revenue: "desc" }
  });

  return stats
    .filter((s) => s.seller != null)
    .map((s, index) => {
      const revenue = Number(s.revenue);
      return {
        sellerId: s.seller!.id,
        name: s.seller!.name,
        active: s.seller!.active,
        revenue,
        salesCount: s.salesCount,
        pieces: s.pieces,
        pa: toNumber(s.pa),
        tkm: toNumber(s.tkm),
        salao: toNumber(s.salao),
        online: toNumber(s.online),
        projection: toNumber(s.projection),
        editedAt: s.editedAt,
        level: computeLevel(
          revenue,
          s.goals.map((g) => ({ level: g.level, target: Number(g.target) }))
        ),
        position: index + 1
      };
    });
}

export async function getStoreMonth(periodId: string): Promise<StoreRow | null> {
  const stats = await prisma.monthlyStats.findFirst({
    where: { periodId, scope: "STORE" },
    include: { goals: true }
  });
  if (!stats) return null;

  const revenue = Number(stats.revenue);
  return {
    revenue,
    salesCount: stats.salesCount,
    pieces: stats.pieces,
    pa: toNumber(stats.pa),
    tkm: toNumber(stats.tkm),
    projection: toNumber(stats.projection),
    workingDays: stats.workingDays,
    workedDays: stats.workedDays,
    level: computeLevel(
      revenue,
      stats.goals.map((g) => ({ level: g.level, target: Number(g.target) }))
    )
  };
}

export interface MesDaVendedora {
  month: number;
  revenue: number;
  level: GoalLevelName | null;
}

export interface LinhaAnual {
  sellerId: string;
  name: string;
  active: boolean;
  /** Quantos meses ela bateu cada nível no ano. */
  prata: number;
  ouro: number;
  diamante: number;
  /** Meses em que bateu pelo menos a primeira meta. */
  mesesComMeta: number;
  /** Meses com dado importado (ela pode ter entrado no meio do ano). */
  mesesTrabalhados: number;
  revenue: number;
  meses: MesDaVendedora[];
  position: number;
}

/** Anos que já têm venda importada. */
export async function listSalesYears(): Promise<number[]> {
  const periods = await prisma.period.findMany({
    where: { stats: { some: {} } },
    select: { year: true },
    distinct: ["year"],
    orderBy: { year: "desc" }
  });
  return periods.map((p) => p.year);
}

/**
 * Ranking do ano por metas batidas. A ordem é Diamante, depois Ouro, depois
 * Prata e só então faturamento: premia consistência, e não um único mês
 * excepcional. Quem entrou no meio do ano não é penalizada por isso na
 * contagem — o número de meses trabalhados aparece ao lado para dar contexto.
 */
export async function getAnnualRanking(year: number): Promise<LinhaAnual[]> {
  const stats = await prisma.monthlyStats.findMany({
    where: { scope: "SELLER", period: { year } },
    include: { seller: true, goals: true, period: true }
  });

  const porVendedora = new Map<string, LinhaAnual>();

  for (const s of stats) {
    if (!s.seller) continue;

    const linha =
      porVendedora.get(s.seller.id) ??
      ({
        sellerId: s.seller.id,
        name: s.seller.name,
        active: s.seller.active,
        prata: 0,
        ouro: 0,
        diamante: 0,
        mesesComMeta: 0,
        mesesTrabalhados: 0,
        revenue: 0,
        meses: [],
        position: 0
      } as LinhaAnual);

    const revenue = Number(s.revenue);
    const nivel = computeLevel(
      revenue,
      s.goals.map((g) => ({ level: g.level, target: Number(g.target) }))
    ).current;

    // Os níveis são cumulativos: bater Diamante significa ter passado por
    // Prata e Ouro, e o placar do ano precisa refletir isso.
    if (nivel === "DIAMANTE") {
      linha.diamante += 1;
      linha.ouro += 1;
      linha.prata += 1;
    } else if (nivel === "OURO") {
      linha.ouro += 1;
      linha.prata += 1;
    } else if (nivel === "PRATA") {
      linha.prata += 1;
    }
    if (nivel) linha.mesesComMeta += 1;

    linha.mesesTrabalhados += 1;
    linha.revenue += revenue;
    linha.meses.push({ month: s.period.month, revenue, level: nivel });

    porVendedora.set(s.seller.id, linha);
  }

  const linhas = Array.from(porVendedora.values());
  for (const l of linhas) l.meses.sort((a, b) => a.month - b.month);

  linhas.sort(
    (a, b) =>
      b.diamante - a.diamante || b.ouro - a.ouro || b.prata - a.prata || b.revenue - a.revenue
  );
  linhas.forEach((l, i) => (l.position = i + 1));

  return linhas;
}
