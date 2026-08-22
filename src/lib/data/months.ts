import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeLevel, type LevelProgress } from "@/lib/levels";

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
