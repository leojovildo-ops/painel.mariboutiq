import { moneyShort, monthName } from "@/lib/format";
import type { MesDeCaixa } from "@/lib/data/caixa";

/**
 * Variação de caixa por mês, em barras que saem do zero.
 *
 * O eixo fica no meio de propósito: caixa que sobe e caixa que desce são
 * coisas opostas, e uma barra crescendo para baixo comunica isso na hora,
 * sem precisar ler o sinal do número.
 */
export function VariacaoDeCaixa({ meses }: { meses: MesDeCaixa[] }) {
  const maior = Math.max(...meses.map((m) => Math.abs(m.cashDeltaTotal ?? 0)), 1);

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[32rem] items-stretch gap-3">
        {meses.map((m) => {
          const valor = m.cashDeltaTotal ?? 0;
          const altura = (Math.abs(valor) / maior) * 100;
          const positivo = valor >= 0;

          return (
            <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
              {/* metade de cima: meses que ganharam caixa */}
              <div className="flex h-20 w-full items-end justify-center">
                {positivo && (
                  <div
                    className="w-3/5 rounded-t bg-emerald-400/80"
                    style={{ height: `${Math.max(altura, 2)}%` }}
                    title={`${monthName(m.month)}: ${moneyShort(valor)}`}
                  />
                )}
              </div>

              <div className="h-px w-full bg-base-600" />

              {/* metade de baixo: meses que consumiram caixa */}
              <div className="flex h-20 w-full items-start justify-center">
                {!positivo && (
                  <div
                    className="w-3/5 rounded-b bg-coral/80"
                    style={{ height: `${Math.max(altura, 2)}%` }}
                    title={`${monthName(m.month)}: ${moneyShort(valor)}`}
                  />
                )}
              </div>

              <span className="text-[11px] font-semibold text-creme-700">
                {monthName(m.month).slice(0, 3)}
              </span>
              <span className={`num text-[11px] ${positivo ? "text-emerald-300" : "text-coral-300"}`}>
                {moneyShort(valor)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
