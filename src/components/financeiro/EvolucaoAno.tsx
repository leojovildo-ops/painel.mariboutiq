import { moneyShort, monthName, percent } from "@/lib/format";
import type { MesFinanceiro } from "@/lib/data/finance";

/**
 * Faturamento x despesas mês a mês, em colunas pareadas. A escala é comum aos
 * dois valores, senão barras de tamanho parecido representariam quantias
 * diferentes e a comparação enganaria.
 */
export function EvolucaoAno({ meses, mesAtivo }: { meses: MesFinanceiro[]; mesAtivo: number }) {
  const teto = Math.max(...meses.flatMap((m) => [m.revenue ?? 0, m.expenses]), 1);

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[34rem] items-end gap-3">
        {meses.map((m) => {
          const ativo = m.month === mesAtivo;
          const alturaFat = ((m.revenue ?? 0) / teto) * 100;
          const alturaDesp = (m.expenses / teto) * 100;

          return (
            <div key={m.month} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex h-40 w-full items-end justify-center gap-1">
                <div
                  className={`w-1/2 rounded-t bg-gradient-to-t from-terracota to-coral ${ativo ? "" : "opacity-45"}`}
                  style={{ height: `${Math.max(alturaFat, 1)}%` }}
                  title={`Faturamento: ${moneyShort(m.revenue)}`}
                />
                <div
                  className={`w-1/2 rounded-t bg-creme-700 ${ativo ? "" : "opacity-45"}`}
                  style={{ height: `${Math.max(alturaDesp, 1)}%` }}
                  title={`Despesas: ${moneyShort(m.expenses)}`}
                />
              </div>
              <span className={`text-[11px] font-semibold ${ativo ? "text-coral-300" : "text-creme-700"}`}>
                {monthName(m.month).slice(0, 3)}
              </span>
              <span className={`num text-[11px] ${m.margin != null && m.margin < 0 ? "text-coral-300" : "text-creme-700"}`}>
                {m.margin == null ? "—" : percent(m.margin)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-creme-700">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-coral" /> Faturamento
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-creme-700" /> Despesas
        </span>
        <span>O número abaixo de cada mês é a margem.</span>
      </div>
    </div>
  );
}
