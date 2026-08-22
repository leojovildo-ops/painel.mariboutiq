import type { Metadata } from "next";
import { requireUser } from "@/lib/rbac";
import { getSellerRanking, getStoreMonth, listPeriods, resolvePeriod } from "@/lib/data/months";
import { decimal, integer, money, percent, periodLabel } from "@/lib/format";
import { LEVEL_LABEL } from "@/lib/levels";
import { MonthSelector } from "@/components/ui/MonthSelector";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatCard } from "@/components/ui/StatCard";

export const metadata: Metadata = { title: "Metas da Loja · Painel Mariboutique 360" };
export const dynamic = "force-dynamic";

export default async function MetasPage({ searchParams }: { searchParams: { mes?: string } }) {
  const user = await requireUser();
  const periods = await listPeriods();
  const period = resolvePeriod(periods, searchParams.mes);

  if (!period) return <EmptyState isAdmin={user.role === "ADMIN"} />;

  const [store, sellers] = await Promise.all([getStoreMonth(period.id), getSellerRanking(period.id)]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-creme sm:text-3xl">Metas da Loja</h1>
        <p className="mt-1 text-sm text-creme-500">
          Consolidado da Mari Boutique em {periodLabel(period.year, period.month)}.
        </p>
      </header>

      <MonthSelector months={periods} current={period.slug} />

      {!store ? (
        <div className="card p-8 text-center text-sm text-creme-500">
          A planilha deste mês não trouxe a aba <strong className="text-creme">Mari Boutique</strong>, que é
          de onde vêm a meta e a projeção da loja.
        </div>
      ) : (
        <>
          <section className="card p-6 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="label">Faturamento do mês</p>
                <p className="num mt-1.5 font-display text-4xl font-bold text-creme sm:text-5xl">
                  {money(store.revenue)}
                </p>
              </div>

              {store.level.nextTarget != null && (
                <div className="text-right">
                  <p className="label">Meta {LEVEL_LABEL[store.level.next!]}</p>
                  <p className="num mt-1.5 font-display text-2xl font-bold text-coral-300">
                    {money(store.level.nextTarget)}
                  </p>
                </div>
              )}
            </div>

            {store.level.goals.length > 0 ? (
              <div className="mt-6">
                <ProgressBar value={store.level.progress} size="lg" />
                <div className="mt-2.5 flex flex-wrap justify-between gap-2 text-sm">
                  <span className="text-creme-500">
                    {store.level.current
                      ? `Meta ${LEVEL_LABEL[store.level.current]} batida`
                      : "Primeira meta ainda não batida"}
                  </span>
                  <span className="num text-creme-500">
                    {store.level.remaining != null
                      ? `faltam ${money(store.level.remaining)} · ${percent(store.level.progress)}`
                      : "todas as metas do mês batidas"}
                  </span>
                </div>
              </div>
            ) : (
              <p className="mt-6 text-sm text-creme-700">
                A aba &ldquo;Mari Boutique&rdquo; deste mês não trouxe as metas Prata/Ouro/Diamante.
              </p>
            )}

            <div className="mt-7 grid gap-4 border-t border-base-600/50 pt-6 sm:grid-cols-2">
              <div>
                <p className="label">Projeção de fechamento</p>
                <p className="num mt-1.5 font-display text-2xl font-bold text-creme">
                  {money(store.projection)}
                </p>
                <p className="mt-1 text-xs text-creme-700">
                  Vem da linha &ldquo;Projeção&rdquo; da planilha do mês.
                </p>
              </div>
              <div>
                <p className="label">Dias trabalhados</p>
                <p className="num mt-1.5 font-display text-2xl font-bold text-creme">
                  {integer(store.workedDays)}
                  <span className="text-base font-medium text-creme-700"> de {integer(store.workingDays)} úteis</span>
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Vendas" value={integer(store.salesCount)} />
            <StatCard label="Peças" value={integer(store.pieces)} />
            <StatCard label="P.A." value={decimal(store.pa)} hint="Peças por atendimento" />
            <StatCard label="TKM" value={money(store.tkm)} hint="Ticket médio" />
          </section>

          {store.level.goals.length > 0 && (
            <section className="card p-6">
              <h2 className="font-display text-lg font-bold text-creme">Metas do mês</h2>
              <dl className="mt-4 grid grid-cols-3 gap-4">
                {store.level.goals.map((goal) => {
                  const done = store.revenue >= goal.target;
                  return (
                    <div key={goal.level}>
                      <dt className={`label ${done ? "text-coral-300" : ""}`}>{LEVEL_LABEL[goal.level]}</dt>
                      <dd className={`num mt-1 font-display text-lg font-bold ${done ? "text-creme" : "text-creme-700"}`}>
                        {money(goal.target)}
                      </dd>
                      <dd className="num mt-0.5 text-xs text-creme-700">
                        {percent((store.revenue / goal.target) * 100)} atingido
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>
          )}

          <p className="text-sm text-creme-700">
            {sellers.length} vendedora{sellers.length === 1 ? "" : "s"} com dados neste mês.
          </p>
        </>
      )}
    </div>
  );
}
