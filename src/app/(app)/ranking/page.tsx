import type { Metadata } from "next";
import { requireUser } from "@/lib/rbac";
import { getSellerRanking, listPeriods, resolvePeriod } from "@/lib/data/months";
import { periodLabel } from "@/lib/format";
import { MonthSelector } from "@/components/ui/MonthSelector";
import { EmptyState } from "@/components/ui/EmptyState";
import { RankingList } from "@/components/vendas/RankingList";

export const metadata: Metadata = { title: "Ranking de Vendas · Painel Mariboutique 360" };
export const dynamic = "force-dynamic";

export default async function RankingPage({ searchParams }: { searchParams: { mes?: string } }) {
  const user = await requireUser();
  const periods = await listPeriods();
  const period = resolvePeriod(periods, searchParams.mes);

  if (!period) return <EmptyState isAdmin={user.role === "ADMIN"} />;

  const rows = await getSellerRanking(period.id);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-creme sm:text-3xl">Ranking de Vendas</h1>
          <p className="mt-1 text-sm text-creme-500">
            Equipe em {periodLabel(period.year, period.month)}, por total vendido.
          </p>
        </div>
      </header>

      <MonthSelector months={periods} current={period.slug} />

      {rows.length === 0 ? (
        <div className="card p-8 text-center text-sm text-creme-500">
          Este mês foi importado, mas nenhuma aba de vendedora trouxe dados.
        </div>
      ) : (
        /* A vendedora vê a própria linha destacada; supervisora e admin veem a
           equipe sem destaque de "sou eu". */
        <RankingList rows={rows} highlightSellerId={user.role === "VENDEDORA" ? user.sellerId : null} />
      )}
    </div>
  );
}
