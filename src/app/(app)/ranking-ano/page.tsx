import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/rbac";
import { getAnnualRanking, listSalesYears } from "@/lib/data/months";
import { money, monthName, integer } from "@/lib/format";
import { LEVEL_LABEL } from "@/lib/levels";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Ranking do Ano · Painel Mariboutique 360" };
export const dynamic = "force-dynamic";

const CORES_NIVEL = {
  PRATA: "bg-nivel-prata",
  OURO: "bg-nivel-ouro",
  DIAMANTE: "bg-nivel-diamante"
} as const;

export default async function RankingAnoPage({ searchParams }: { searchParams: { ano?: string } }) {
  const user = await requireUser();
  const anos = await listSalesYears();

  if (anos.length === 0) return <EmptyState isAdmin={user.role === "ADMIN"} />;

  const ano = anos.includes(Number(searchParams.ano)) ? Number(searchParams.ano) : anos[0];
  const linhas = await getAnnualRanking(ano);
  const destaque = user.role === "VENDEDORA" ? user.sellerId : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-creme sm:text-3xl">Ranking do Ano</h1>
          <p className="mt-1 text-sm text-creme-500">
            Metas batidas em {ano}. Quem bate meta todo mês fica na frente de quem teve um mês excepcional.
          </p>
        </div>

        {anos.length > 1 && (
          <div className="flex gap-1.5">
            {anos.map((a) => (
              <Link
                key={a}
                href={`/ranking-ano?ano=${a}`}
                className={`rounded-xl px-3.5 py-2 text-sm font-medium ${
                  a === ano ? "bg-coral text-base" : "border border-base-600 text-creme-500 hover:text-creme"
                }`}
              >
                {a}
              </Link>
            ))}
          </div>
        )}
      </header>

      {linhas.length === 0 ? (
        <div className="card p-8 text-center text-sm text-creme-500">Nenhuma venda importada em {ano}.</div>
      ) : (
        <ol className="space-y-3">
          {linhas.map((linha) => {
            const eu = linha.sellerId === destaque;
            return (
              <li
                key={linha.sellerId}
                className={`card p-5 ${eu ? "border-coral/70 shadow-glow" : ""}`}
              >
                <div className="flex items-center gap-4">
                  <span
                    className={`num w-10 shrink-0 text-center font-display text-2xl font-bold ${
                      linha.position <= 3 ? "text-coral" : "text-creme-700"
                    }`}
                  >
                    {linha.position}º
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-display text-lg font-bold text-creme">{linha.name}</p>
                      {eu && (
                        <span className="rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-base">
                          Você
                        </span>
                      )}
                    </div>
                    <p className="num mt-0.5 text-sm text-creme-500">
                      {money(linha.revenue)} no ano · {integer(linha.mesesTrabalhados)} mês
                      {linha.mesesTrabalhados === 1 ? "" : "es"} com venda
                    </p>
                  </div>

                  {/* O placar de metas é o que define a posição, então vem em destaque. */}
                  <div className="flex shrink-0 gap-3 text-center">
                    {(["DIAMANTE", "OURO", "PRATA"] as const).map((nivel) => {
                      const qtd = nivel === "DIAMANTE" ? linha.diamante : nivel === "OURO" ? linha.ouro : linha.prata;
                      return (
                        <div key={nivel}>
                          <p className="num font-display text-xl font-bold text-creme">{qtd}</p>
                          <p className="label mt-0.5">{LEVEL_LABEL[nivel]}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Fita do ano: um quadradinho por mês, com a cor do nível batido. */}
                <div className="mt-4 flex flex-wrap gap-1.5 border-t border-base-600/50 pt-4">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                    const mes = linha.meses.find((x) => x.month === m);
                    const cor = mes?.level ? CORES_NIVEL[mes.level] : mes ? "bg-base-600" : "bg-base-700/50";
                    return (
                      <span
                        key={m}
                        className={`flex h-7 w-9 items-center justify-center rounded text-[10px] font-semibold ${cor} ${
                          mes?.level ? "text-base" : "text-creme-700"
                        }`}
                        title={
                          mes
                            ? `${monthName(m)}: ${money(mes.revenue)}${mes.level ? ` · ${LEVEL_LABEL[mes.level]}` : " · sem meta batida"}`
                            : `${monthName(m)}: sem dado`
                        }
                      >
                        {monthName(m).slice(0, 3)}
                      </span>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <p className="text-xs text-creme-700">
        Os níveis são cumulativos: um mês de Diamante conta também como Ouro e Prata.
      </p>
    </div>
  );
}
