import { money, monthName } from "@/lib/format";

/**
 * O dinheiro em espécie da loja serve para comprar mercadoria, então o número
 * sozinho não responde a pergunta real: "dá para comprar?". O cartão põe o
 * saldo ao lado do que a loja costuma gastar com fornecedor por mês, que é a
 * régua que dá sentido a ele.
 */
export function EspecieParaCompras({
  saldo,
  mesDoSaldo,
  mediaCompras,
  mesesConsiderados
}: {
  saldo: number | null;
  mesDoSaldo: number | null;
  /** Média mensal do grupo FORNECEDOR nos meses já fechados. */
  mediaCompras: number | null;
  mesesConsiderados: number;
}) {
  const cobertura = saldo != null && mediaCompras != null && mediaCompras > 0 ? saldo / mediaCompras : null;

  return (
    <section className="card border-coral/35 bg-gradient-to-br from-coral/[0.10] to-transparent p-6">
      <p className="label">Em espécie, para comprar mercadoria</p>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="num font-display text-3xl font-bold text-creme sm:text-4xl">{money(saldo)}</p>
        {mesDoSaldo != null && (
          <span className="text-sm text-creme-500">último saldo lançado · {monthName(mesDoSaldo)}</span>
        )}
      </div>

      {saldo == null ? (
        <p className="mt-3 text-sm text-creme-700">
          Lance o saldo da conta Espécie em Administração para acompanhar aqui.
        </p>
      ) : mediaCompras == null ? (
        <p className="mt-3 text-sm text-creme-700">
          Sem compras de fornecedor registradas ainda para servir de comparação.
        </p>
      ) : (
        <div className="mt-4 border-t border-base-600/50 pt-4">
          <p className="text-sm text-creme-500">
            A loja gasta em média{" "}
            <strong className="num font-semibold text-creme">{money(mediaCompras)}</strong> por mês com
            fornecedor{" "}
            <span className="text-creme-700">
              ({mesesConsiderados} {mesesConsiderados === 1 ? "mês fechado" : "meses fechados"})
            </span>
            .
          </p>
          {cobertura != null && (
            <p className="mt-1.5 text-sm">
              <span className={cobertura >= 1 ? "text-emerald-300" : "text-nivel-ouro"}>
                O caixa em espécie cobre{" "}
                <strong className="num font-semibold">
                  {cobertura >= 1
                    ? `${cobertura.toFixed(1).replace(".", ",")} ${cobertura >= 2 ? "meses" : "mês"}`
                    : `${Math.round(cobertura * 100)}%`}
                </strong>{" "}
                {cobertura >= 1 ? "de compra nesse ritmo." : "de um mês de compra nesse ritmo."}
              </span>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
