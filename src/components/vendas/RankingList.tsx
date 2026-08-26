import type { SellerRow } from "@/lib/data/months";
import { decimal, integer, money } from "@/lib/format";
import { LEVEL_LABEL } from "@/lib/levels";
import { LevelBadge } from "./LevelBadge";
import { NotaAtendimento } from "./NotaAtendimento";

const MEDAL = ["1º", "2º", "3º"];

/** Moldura do pódio: destaque para o topo sem virar brincadeira infantil. */
function podiumStyle(position: number, highlighted: boolean): string {
  if (highlighted) return "border-coral/70 bg-coral/10 shadow-glow";
  if (position === 1) return "border-nivel-ouro/45 bg-gradient-to-r from-nivel-ouro/[0.10] to-transparent";
  if (position === 2) return "border-nivel-prata/35 bg-gradient-to-r from-nivel-prata/[0.07] to-transparent";
  if (position === 3) return "border-terracota-400/40 bg-gradient-to-r from-terracota/[0.12] to-transparent";
  return "border-base-600/70";
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label">{label}</p>
      <p className="num mt-0.5 text-sm font-semibold text-creme-300">{value}</p>
    </div>
  );
}

export function RankingList({
  rows,
  highlightSellerId
}: {
  rows: SellerRow[];
  highlightSellerId: string | null;
}) {
  return (
    <ol className="space-y-3">
      {rows.map((row) => {
        const highlighted = row.sellerId === highlightSellerId;
        return (
          <li
            key={row.sellerId}
            className={`rounded-2xl border p-4 shadow-card transition-colors sm:p-5 ${podiumStyle(
              row.position,
              highlighted
            )} ${highlighted ? "" : "bg-base-800/70"}`}
          >
            <div className="flex items-center gap-4">
              <span
                className={`num w-11 shrink-0 text-center font-display text-2xl font-bold ${
                  row.position <= 3 ? "text-coral" : "text-creme-700"
                }`}
              >
                {MEDAL[row.position - 1] ?? `${row.position}º`}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="truncate font-display text-lg font-bold text-creme">{row.name}</p>
                  {highlighted && (
                    <span className="rounded-full bg-coral px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-base">
                      Você
                    </span>
                  )}
                  {!row.active && (
                    <span className="rounded-full border border-base-600 px-2 py-0.5 text-[10px] uppercase tracking-wider text-creme-700">
                      Inativa
                    </span>
                  )}
                </div>
                {/* Total vendido e projecao lado a lado: o primeiro diz onde
                    ela esta, o segundo onde o mes deve terminar no ritmo atual. */}
                <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <p className="num font-display text-xl font-bold text-coral-300 sm:text-2xl">
                    {money(row.revenue)}
                  </p>
                  {row.projection != null && (
                    <p className="num text-sm text-creme-500">
                      projeção <span className="font-semibold text-creme-300">{money(row.projection)}</span>
                    </p>
                  )}
                  <NotaAtendimento score={row.npsScore} respostas={row.npsResponses} />
                </div>
              </div>

              <LevelBadge level={row.level.current} size="sm" />
            </div>

            {/* Quanto falta por dia é o número que a vendedora usa hoje; a
                meta do mês sozinha não diz o que fazer nesta segunda-feira. */}
            {row.ritmo.faltaPorDia != null && row.level.next && (
              <p className="num mt-2.5 text-sm text-creme-500">
                faltam{" "}
                <strong className="font-semibold text-coral-300">{money(row.ritmo.faltaPorDia)}</strong> por
                dia para o {LEVEL_LABEL[row.level.next]}
                <span className="text-creme-700">
                  {" "}
                  · {integer(row.ritmo.diasRestantes)}{" "}
                  {row.ritmo.diasRestantes === 1 ? "dia restante" : "dias restantes"}
                </span>
                {row.ritmo.mediaDiaria != null && (
                  <span className="text-creme-700"> · vem fazendo {money(row.ritmo.mediaDiaria)}/dia</span>
                )}
              </p>
            )}

            {/* Observação do mês: é aqui que se explica, por exemplo, que o
                mês soma o período de experiência com o de carteira assinada. */}
            {row.note && (
              <p className="mt-3 rounded-xl border border-base-600/70 bg-base-700/40 px-3.5 py-2.5 text-xs leading-relaxed text-creme-500">
                {row.note}
              </p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-base-600/50 pt-3.5 sm:grid-cols-4">
              <Metric label="Vendas" value={integer(row.salesCount)} />
              <Metric label="Peças" value={integer(row.pieces)} />
              <Metric label="P.A." value={decimal(row.pa)} />
              <Metric label="TKM" value={money(row.tkm)} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
