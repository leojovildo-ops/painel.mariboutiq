import type { Metadata } from "next";
import { requireAdmin } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { listPeriods, resolvePeriod } from "@/lib/data/months";
import { periodLabel } from "@/lib/format";
import { UploadCard } from "@/components/admin/UploadCard";
import { UploadDespesasCard } from "@/components/admin/UploadDespesasCard";
import { UploadPesquisaCard } from "@/components/admin/UploadPesquisaCard";
import { EditStatsCard } from "@/components/admin/EditStatsCard";
import { UsersCard } from "@/components/admin/UsersCard";
import { MonthSelector } from "@/components/ui/MonthSelector";

export const metadata: Metadata = { title: "Administração · Painel Mariboutique 360" };
export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: { mes?: string } }) {
  const admin = await requireAdmin();

  const periods = await listPeriods();
  const period = resolvePeriod(periods, searchParams.mes);

  const [sellers, users, stats] = await Promise.all([
    prisma.seller.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], include: { seller: true } }),
    period
      ? prisma.monthlyStats.findMany({
          where: { periodId: period.id },
          include: { seller: true },
          orderBy: [{ scope: "asc" }, { revenue: "desc" }]
        })
      : Promise.resolve([])
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl font-bold text-creme sm:text-3xl">Administração</h1>
        <p className="mt-1 text-sm text-creme-500">
          Importação das planilhas, correção de números e acessos da equipe.
        </p>
      </header>

      <UploadCard />

      <UploadPesquisaCard />

      {admin.canViewFinance && <UploadDespesasCard />}

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-bold text-creme">Corrigir números importados</h2>
          <p className="mt-1 text-sm text-creme-500">
            {period
              ? `Editando ${periodLabel(period.year, period.month)}. As correções aparecem nos painéis na hora.`
              : "Nenhum mês importado ainda."}
          </p>
        </div>

        <MonthSelector months={periods} current={period?.slug ?? ""} />

        {period && (
          <EditStatsCard
            rows={stats.map((s) => ({
              id: s.id,
              label: s.scope === "STORE" ? "Mari Boutique (loja)" : (s.seller?.name ?? "—"),
              scope: s.scope,
              revenue: Number(s.revenue),
              salesCount: s.salesCount,
              pieces: s.pieces,
              pa: s.pa == null ? null : Number(s.pa),
              tkm: s.tkm == null ? null : Number(s.tkm),
              projection: s.projection == null ? null : Number(s.projection),
              note: s.note,
              npsScore: s.npsScore == null ? null : Number(s.npsScore),
              editedAt: s.editedAt ? s.editedAt.toISOString() : null
            }))}
          />
        )}
      </section>

      <UsersCard
        podeGerirFinanceiro={admin.canViewFinance}
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          active: u.active,
          sellerId: u.sellerId,
          sellerName: u.seller?.name ?? null,
          canViewFinance: u.canViewFinance
        }))}
        sellers={sellers.map((s) => ({ id: s.id, name: s.name, sheetName: s.sheetName, active: s.active }))}
      />
    </div>
  );
}
