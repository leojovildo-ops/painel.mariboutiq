import type { Metadata } from "next";
import { requireUser } from "@/lib/rbac";
import { getSellerRanking, listPeriods, resolvePeriod } from "@/lib/data/months";
import { money, percent, periodLabel } from "@/lib/format";
import { LEVEL_LABEL } from "@/lib/levels";
import { MonthSelector } from "@/components/ui/MonthSelector";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { LevelBadge } from "@/components/vendas/LevelBadge";

export const metadata: Metadata = { title: "Ranking de Nível · Painel Mariboutique 360" };
export const dynamic = "force-dynamic";

const TONE = { PRATA: "prata", OURO: "ouro", DIAMANTE: "diamante" } as const;

export default async function NiveisPage({ searchParams }: { searchParams: { mes?: string } }) {
  const user = await requireUser();
  const periods = await listPeriods();
  const period = resolvePeriod(periods, searchParams.mes);

  if (!period) return <EmptyState isAdmin={user.role === "ADMIN"} />;

  const rows = await getSellerRanking(period.id);
  const highlightSellerId = user.role === "VENDEDORA" ? user.sellerId : null;

  // Ordena pelo nível conquistado (Diamante primeiro) e, dentro do nível, pelo faturamento.
  const ranked = [...rows].sort((a, b) => {
    const rank = (level: string | null) => (level === "DIAMANTE" ? 3 : level === "OURO" ? 2 : level === "PRATA" ? 1 : 0);
    return rank(b.level.current) - rank(a.level.current) || b.revenue - a.revenue;
  });

  // A meta Prata vem em branco na planilha de alguns meses (a célula J23).
  // Sem avisar, o selo Prata simplesmente nunca aparece e ninguém entende por quê.
  const semPrata =
    ranked.length > 0 && ranked.every((r) => !r.level.goals.some((g) => g.level === "PRATA"));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-creme sm:text-3xl">Ranking de Nível</h1>
        <p className="mt-1 text-sm text-creme-500">
          Níveis conquistados em {periodLabel(period.year, period.month)}, sobre as metas de cada vendedora.
        </p>
      </header>

      <MonthSelector months={periods} current={period.slug} />

      {semPrata && (
        <p className="rounded-xl border border-nivel-ouro/30 bg-nivel-ouro/10 px-4 py-3 text-sm text-nivel-ouro">
          A meta <strong>Prata</strong> está em branco na planilha deste mês, então o nível Prata não
          aparece para ninguém. Para ativá-lo, preencha o valor da Prata na coluna J, ao lado do rótulo,
          em cada aba.
        </p>
      )}

      {ranked.length === 0 ? (
        <div className="card p-8 text-center text-sm text-creme-500">
          Nenhuma vendedora com dados neste mês.
        </div>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {ranked.map((row) => {
            const highlighted = row.sellerId === highlightSellerId;
            const { level } = row;
            const tone = level.next ? TONE[level.next] : level.current ? TONE[level.current] : "coral";

            return (
              <li
                key={row.sellerId}
                className={`card p-5 sm:p-6 ${highlighted ? "border-coral/70 shadow-glow" : ""}`}
              >
                <div className="flex items-center gap-5">
                  <div className="flex shrink-0 flex-col items-center gap-1.5">
                    <LevelBadge level={level.current} size="lg" />
                    {/* Sem nível conquistado, o número que importa é o quanto
                        falta para o próximo — e não um selo vazio. */}
                    {!level.current && level.percentOfNext != null && (
                      <span className="num text-sm font-bold text-coral-300">
                        {percent(level.percentOfNext)}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-display text-xl font-bold text-creme">{row.name}</p>
                      {highlighted && (
                        <span className="rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-base">
                          Você
                        </span>
                      )}
                    </div>
                    <p className="num mt-1 text-sm text-creme-500">
                      {money(row.revenue)} no mês
                    </p>
                    <p className="mt-0.5 text-xs text-creme-700">
                      {level.current && level.ajustadoManualmente
                        ? `Nível ${LEVEL_LABEL[level.current]} · ajustado manualmente`
                        : level.current
                        ? `Nível ${LEVEL_LABEL[level.current]} conquistado`
                        : level.next
                          ? `A caminho do ${LEVEL_LABEL[level.next]}`
                          : "Sem metas na planilha deste mês"}
                    </p>
                  </div>
                </div>

                {row.note && (
                  <p className="mt-4 rounded-xl border border-base-600/70 bg-base-700/40 px-3.5 py-2.5 text-xs leading-relaxed text-creme-500">
                    {row.note}
                  </p>
                )}

                {level.next && level.nextTarget != null ? (
                  <div className="mt-5">
                    <div className="mb-2 flex items-baseline justify-between gap-3">
                      <span className="label">Próximo nível · {LEVEL_LABEL[level.next]}</span>
                      <span className="num text-xs text-creme-500">
                        {percent(level.percentOfNext)} da meta · faltam {money(level.remaining)}
                      </span>
                    </div>
                    <ProgressBar value={level.progress} tone={tone} size="md" />
                    <p className="num mt-1.5 text-right text-xs text-creme-700">{percent(level.progress)}</p>
                  </div>
                ) : (
                  level.current === "DIAMANTE" && (
                    <p className="mt-5 rounded-xl border border-nivel-diamante/30 bg-nivel-diamante/10 px-4 py-3 text-sm font-semibold text-nivel-diamante">
                      Todas as metas do mês batidas.
                    </p>
                  )
                )}

                {level.goals.length > 0 && (
                  <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-base-600/50 pt-4">
                    {level.goals.map((goal) => {
                      const done = row.revenue >= goal.target;
                      return (
                        <div key={goal.level}>
                          <dt className={`label ${done ? "text-coral-300" : ""}`}>{LEVEL_LABEL[goal.level]}</dt>
                          <dd className={`num mt-0.5 text-sm font-semibold ${done ? "text-creme" : "text-creme-700"}`}>
                            {money(goal.target)}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
