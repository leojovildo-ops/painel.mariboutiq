import type { Metadata } from "next";
import { requireAdmin } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { listPeriods, resolvePeriod } from "@/lib/data/months";
import { periodLabel } from "@/lib/format";
import { UploadCard } from "@/components/admin/UploadCard";
import { UploadDespesasCard } from "@/components/admin/UploadDespesasCard";
import { UploadPesquisaCard } from "@/components/admin/UploadPesquisaCard";
import { SaldosCard } from "@/components/admin/SaldosCard";
import { DriveCard } from "@/components/admin/DriveCard";
import { anosComPeriodo, getSaldosDoAno, listarContas } from "@/lib/data/saldos";
import { EditStatsCard } from "@/components/admin/EditStatsCard";
import { UsersCard } from "@/components/admin/UsersCard";
import { MonthSelector } from "@/components/ui/MonthSelector";
import { AvisoDeAtualizacao } from "@/components/estoque/AvisoDeAtualizacao";
import { avisoDeEstoque } from "@/lib/data/estoqueAviso";

export const metadata: Metadata = { title: "Administração · Painel Mariboutique 360" };
export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: { mes?: string } }) {
  const admin = await requireAdmin();

  const estoque = await avisoDeEstoque();
  const periods = await listPeriods();
  const period = resolvePeriod(periods, searchParams.mes);

  // Saldos das contas: o lançamento fica aqui, junto dos uploads, e a tela do
  // Financeiro mostra o resultado sem botão de editar.
  const anos = admin.canViewFinance ? await anosComPeriodo() : [];
  const contas = admin.canViewFinance ? (await listarContas()).filter((c) => c.active) : [];
  const mesesDeSaldos = anos.length > 0 ? await getSaldosDoAno(anos[0], contas) : [];

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

      <AvisoDeAtualizacao aviso={estoque} />

      <DriveCard />

      <UploadCard />

      <UploadPesquisaCard />

      {admin.canViewFinance && <UploadDespesasCard />}

      {admin.canViewFinance && contas.length > 0 && <SaldosCard meses={mesesDeSaldos} contas={contas} />}

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
              levelOverride: s.levelOverride,
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
        sellers={sellers.map((s) => ({
          id: s.id,
          name: s.name,
          sheetName: s.sheetName,
          active: s.active,
          aliases: s.aliases
        }))}
      />
    </div>
  );
}
