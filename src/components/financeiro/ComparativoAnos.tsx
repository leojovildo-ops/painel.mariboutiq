import { money, moneyShort, monthName, percent } from "@/lib/format";
import type { AnoComparado } from "@/lib/data/comparativo";

/** Uma cor por ano, do mais antigo (apagado) ao mais recente (coral da marca). */
const CORES = ["bg-creme-700", "bg-terracota-600", "bg-terracota", "bg-terracota-400", "bg-coral"];

function corDoAno(indice: number, total: number): string {
  // O ano mais recente sempre fica no coral; os anteriores desbotam para trás.
  const posicao = CORES.length - (total - indice);
  return CORES[Math.max(0, Math.min(CORES.length - 1, posicao))];
}

/**
 * Faturamento mês a mês, um grupo de barras por mês e uma barra por ano.
 *
 * Comparar anos pelo total engana enquanto o ano corre: 2026 com sete meses
 * pareceria uma queda diante de 2025 fechado. Por isso a tabela mostra as duas
 * leituras — o total do ano e a variação só nos meses que os dois anos têm.
 */
export function ComparativoAnos({ anos }: { anos: AnoComparado[] }) {
  if (anos.length === 0) return null;

  const emOrdem = [...anos].sort((a, b) => a.year - b.year);
  const teto = Math.max(...emOrdem.flatMap((a) => a.meses.map((m) => m.revenue)), 1);

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        <div className="flex min-w-[44rem] items-end gap-2">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((mes) => (
            <div key={mes} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex h-44 w-full items-end justify-center gap-[3px]">
                {emOrdem.map((ano, i) => {
                  const dado = ano.meses.find((m) => m.month === mes);
                  const altura = dado ? (dado.revenue / teto) * 100 : 0;
                  return (
                    <div
                      key={ano.year}
                      className={`w-full rounded-t ${corDoAno(i, emOrdem.length)} ${dado ? "" : "opacity-20"}`}
                      style={{ height: `${Math.max(altura, 1)}%` }}
                      title={
                        dado
                          ? `${monthName(mes)} de ${ano.year}: ${money(dado.revenue)}`
                          : `${monthName(mes)} de ${ano.year}: sem dado`
                      }
                    />
                  );
                })}
              </div>
              <span className="text-[11px] font-semibold text-creme-700">
                {monthName(mes).slice(0, 3)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-creme-500">
        {emOrdem.map((ano, i) => (
          <span key={ano.year} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${corDoAno(i, emOrdem.length)}`} />
            {ano.year}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-base-600">
        <table className="w-full min-w-[34rem] text-sm">
          <thead className="bg-base-700/60 text-left">
            <tr>
              <th className="px-4 py-2.5 font-semibold text-creme-500">Ano</th>
              <th className="px-4 py-2.5 text-right font-semibold text-creme-500">Faturamento</th>
              <th className="px-4 py-2.5 text-right font-semibold text-creme-500">Meses</th>
              <th className="px-4 py-2.5 text-right font-semibold text-creme-500">vs. ano anterior</th>
              <th className="px-4 py-2.5 text-right font-semibold text-creme-500">Mesmos meses</th>
            </tr>
          </thead>
          <tbody>
            {anos.map((ano) => (
              <tr key={ano.year} className="border-t border-base-600/50">
                <td className="px-4 py-2.5 font-semibold text-creme">{ano.year}</td>
                <td className="num px-4 py-2.5 text-right text-creme">{money(ano.total)}</td>
                <td className="num px-4 py-2.5 text-right text-creme-700">{ano.mesesComDado}</td>
                <td
                  className={`num px-4 py-2.5 text-right ${
                    ano.variacao == null
                      ? "text-creme-700"
                      : ano.variacao >= 0
                        ? "text-emerald-300"
                        : "text-coral-300"
                  }`}
                >
                  {ano.variacao == null ? "—" : `${ano.variacao >= 0 ? "+" : ""}${percent(ano.variacao)}`}
                </td>
                <td
                  className={`num px-4 py-2.5 text-right ${
                    ano.variacaoComparavel == null
                      ? "text-creme-700"
                      : ano.variacaoComparavel >= 0
                        ? "text-emerald-300"
                        : "text-coral-300"
                  }`}
                >
                  {ano.variacaoComparavel == null ? (
                    "—"
                  ) : (
                    <>
                      {ano.variacaoComparavel >= 0 ? "+" : ""}
                      {percent(ano.variacaoComparavel)}
                      <span className="ml-1.5 text-xs font-normal text-creme-700">
                        ({ano.mesesComparados} {ano.mesesComparados === 1 ? "mês" : "meses"})
                      </span>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-creme-700">
        &ldquo;Mesmos meses&rdquo; compara só os meses que os dois anos têm — é a leitura honesta
        enquanto o ano ainda não fechou. O maior mês da série é{" "}
        {moneyShort(Math.max(...emOrdem.flatMap((a) => a.meses.map((m) => m.revenue))))}.
      </p>
    </div>
  );
}
