import { money, monthName } from "@/lib/format";
import type { ResumoDeEspecie } from "@/lib/data/especie";

function plural(n: number, singular: string, plural: string) {
  return n === 1 ? singular : plural;
}

/**
 * O dinheiro em espécie da loja existe para comprar mercadoria, então o saldo
 * sozinho não responde nada. O cartão junta as três coisas que decidem a
 * compra: quanto tem no cofre, quanto entra em dinheiro por mês e quanto uma
 * viagem costuma levar.
 */
export function EspecieParaCompras({ resumo }: { resumo: ResumoDeEspecie }) {
  const {
    saldo,
    mesDoSaldo,
    entradaMedia,
    entradaTipica,
    mesesAtipicos,
    mesesInformados,
    valorPorViagem,
    viagensNoCaixa,
    mesesPorViagem
  } = resumo;

  const daParaViajar = viagensNoCaixa != null && viagensNoCaixa >= 1;

  return (
    <section className="card border-coral/35 bg-gradient-to-br from-coral/[0.10] to-transparent p-6">
      <p className="label">Em espécie, para comprar mercadoria</p>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="num font-display text-3xl font-bold text-creme sm:text-4xl">{money(saldo)}</p>
        {mesDoSaldo != null && (
          <span className="text-sm text-creme-500">no cofre · {monthName(mesDoSaldo)}</span>
        )}
      </div>

      {saldo == null ? (
        <p className="mt-3 text-sm text-creme-700">
          Lance o saldo da conta Espécie em Administração para acompanhar aqui.
        </p>
      ) : (
        <>
          {viagensNoCaixa != null && valorPorViagem != null && (
            <p
              className={`mt-4 text-lg font-semibold ${daParaViajar ? "text-emerald-300" : "text-nivel-ouro"}`}
            >
              {daParaViajar ? (
                <>
                  Dá para {viagensNoCaixa >= 2 ? `${Math.floor(viagensNoCaixa)} viagens` : "uma viagem"} de
                  compras agora.
                </>
              ) : (
                <>Falta {money(valorPorViagem - saldo)} para fechar uma viagem.</>
              )}
            </p>
          )}

          <dl className="mt-4 grid gap-4 border-t border-base-600/50 pt-4 sm:grid-cols-3">
            <div>
              <dt className="label">Entra em dinheiro</dt>
              <dd className="num mt-1 text-sm font-semibold text-creme">
                {money(entradaTipica)}
                <span className="ml-1 text-xs font-normal text-creme-700">no mês típico</span>
              </dd>
              <dd className="mt-0.5 text-xs text-creme-700">
                média dos {mesesInformados} {plural(mesesInformados, "mês", "meses")}: {money(entradaMedia)}
              </dd>
            </div>

            <div>
              <dt className="label">Cada viagem leva</dt>
              <dd className="num mt-1 text-sm font-semibold text-creme">{money(valorPorViagem)}</dd>
              <dd className="mt-0.5 text-xs text-creme-700">valor médio informado</dd>
            </div>

            <div>
              <dt className="label">Repõe uma viagem em</dt>
              <dd className="num mt-1 text-sm font-semibold text-creme">
                {mesesPorViagem == null
                  ? "—"
                  : `${mesesPorViagem.toFixed(1).replace(".", ",")} ${plural(Math.round(mesesPorViagem), "mês", "meses")}`}
              </dd>
              <dd className="mt-0.5 text-xs text-creme-700">no ritmo do mês típico</dd>
            </div>
          </dl>

          {mesesAtipicos.length > 0 && (
            <p className="mt-4 rounded-xl border border-nivel-ouro/30 bg-nivel-ouro/10 px-4 py-3 text-sm text-nivel-ouro">
              {mesesAtipicos.map((m) => `${monthName(m.month)} (${money(m.amount)})`).join(", ")}{" "}
              {plural(mesesAtipicos.length, "ficou", "ficaram")} muito acima dos demais e{" "}
              {plural(mesesAtipicos.length, "puxa", "puxam")} a média para cima. A projeção acima usa o mês
              típico, não a média, para não contar com um dinheiro que não costuma entrar.
            </p>
          )}

          {resumo.entradas.length > 0 && (
            <div className="mt-5 border-t border-base-600/50 pt-4">
              <p className="label mb-2">Entrada em dinheiro por mês</p>
              <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                {resumo.entradas.map((e) => (
                  <span key={e.month} className="num text-xs text-creme-500">
                    {monthName(e.month).slice(0, 3)}{" "}
                    <span className="font-semibold text-creme-300">{money(e.amount)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
