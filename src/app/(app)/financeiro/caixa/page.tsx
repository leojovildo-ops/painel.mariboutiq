import type { Metadata } from "next";
import Link from "next/link";
import { requireFinance } from "@/lib/rbac";
import { anosComCaixa, getResumoDeCaixa, type StatusDeCaixa } from "@/lib/data/caixa";
import { money, monthName, percent, integer } from "@/lib/format";
import { StatCard } from "@/components/ui/StatCard";
import { VariacaoDeCaixa } from "@/components/financeiro/VariacaoDeCaixa";

export const metadata: Metadata = { title: "Fluxo de Caixa · Painel Mariboutique 360" };
export const dynamic = "force-dynamic";

const ESTILO: Record<StatusDeCaixa, { rotulo: string; borda: string; fundo: string; texto: string; ponto: string }> = {
  POSITIVO: {
    rotulo: "Positivo",
    borda: "border-emerald-500/30",
    fundo: "bg-emerald-500/[0.07]",
    texto: "text-emerald-300",
    ponto: "bg-emerald-400"
  },
  ATENCAO: {
    rotulo: "Ponto de atenção",
    borda: "border-nivel-ouro/35",
    fundo: "bg-nivel-ouro/[0.08]",
    texto: "text-nivel-ouro",
    ponto: "bg-nivel-ouro"
  },
  NEGATIVO: {
    rotulo: "Negativo",
    borda: "border-coral/45",
    fundo: "bg-coral/[0.09]",
    texto: "text-coral-300",
    ponto: "bg-coral"
  }
};

function Valor({ valor }: { valor: number | null }) {
  if (valor == null) return <span className="text-creme-700">—</span>;
  return (
    <span className={valor >= 0 ? "text-emerald-300" : "text-coral-300"}>
      {valor >= 0 ? "+" : ""}
      {money(valor)}
    </span>
  );
}

export default async function CaixaPage({ searchParams }: { searchParams: { ano?: string } }) {
  await requireFinance();

  const anos = await anosComCaixa();
  if (anos.length === 0) {
    return (
      <div className="card p-8 text-center">
        <h1 className="font-display text-2xl font-bold text-creme">Sem leitura de caixa ainda</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-creme-500">
          Esta tela mostra a análise de caixa mês a mês, feita a partir dos extratos.
        </p>
      </div>
    );
  }

  const ano = anos.includes(Number(searchParams.ano)) ? Number(searchParams.ano) : anos[0];
  const r = await getResumoDeCaixa(ano);

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-creme sm:text-3xl">Fluxo de Caixa</h1>
          <p className="mt-1 text-sm text-creme-500">
            Quanto entrou e saiu de cada conta em {ano}, e o porquê de cada mês.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Link href={`/financeiro/ano?ano=${ano}`} className="btn-secondary">
            Resumo anual
          </Link>
          {anos.map((a) => (
            <Link
              key={a}
              href={`/financeiro/caixa?ano=${a}`}
              className={`rounded-xl px-3.5 py-2 text-sm font-medium ${
                a === ano ? "bg-coral text-base" : "border border-base-600 text-creme-500 hover:text-creme"
              }`}
            >
              {a}
            </Link>
          ))}
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Variação de caixa"
          value={`${r.variacaoAcumulada >= 0 ? "+" : ""}${money(r.variacaoAcumulada)}`}
          hint={`acumulado de ${r.meses.length} ${r.meses.length === 1 ? "mês" : "meses"}`}
        />
        <StatCard label="Meses positivos" value={integer(r.porStatus.POSITIVO)} hint="caixa cresceu" />
        <StatCard label="Pontos de atenção" value={integer(r.porStatus.ATENCAO)} hint="olhar de perto" />
        <StatCard label="Meses negativos" value={integer(r.porStatus.NEGATIVO)} hint="caixa caiu" />
      </section>

      {r.bancoQueMaisConsumiu && (
        <p className="rounded-2xl border border-coral/40 bg-coral/[0.09] px-5 py-4 text-sm text-coral-300">
          No acumulado do ano, a conta que mais consumiu caixa é a{" "}
          <strong className="font-semibold">{r.bancoQueMaisConsumiu.nome}</strong>, com{" "}
          <strong className="num font-semibold">{money(r.bancoQueMaisConsumiu.total)}</strong>.
        </p>
      )}

      <section className="card p-6">
        <h2 className="font-display text-lg font-bold text-creme">Variação de caixa mês a mês</h2>
        <p className="mb-6 mt-1 text-sm text-creme-500">
          Acima do eixo, meses em que o caixa cresceu; abaixo, meses em que encolheu.
        </p>
        <VariacaoDeCaixa meses={r.meses} />
      </section>

      {/* O texto de cada mês é o coração desta tela: ele explica o que os
          números sozinhos não contam. */}
      <section className="space-y-4">
        {[...r.meses].reverse().map((m) => {
          const estilo = ESTILO[m.status];
          return (
            <article key={m.month} className={`rounded-2xl border ${estilo.borda} ${estilo.fundo} p-5`}>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${estilo.ponto}`} aria-hidden />
                  <h3 className="font-display text-lg font-bold text-creme">{monthName(m.month)}</h3>
                  <span className={`text-xs font-bold uppercase tracking-wider ${estilo.texto}`}>
                    {estilo.rotulo}
                  </span>
                </div>

                <span className="num text-sm font-semibold">
                  caixa <Valor valor={m.cashDeltaTotal} />
                </span>
              </div>

              {m.note && <p className="mt-3 text-sm leading-relaxed text-creme-300">{m.note}</p>}

              <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-base-600/50 pt-4 sm:grid-cols-3 lg:grid-cols-6">
                <div>
                  <dt className="label">Receita</dt>
                  <dd className="num mt-0.5 text-sm font-semibold text-creme">{money(m.revenue)}</dd>
                </div>
                <div>
                  <dt className="label">Despesas</dt>
                  <dd className="num mt-0.5 text-sm font-semibold text-creme">{money(m.expenses)}</dd>
                </div>
                <div>
                  <dt className="label">Resultado</dt>
                  <dd className="num mt-0.5 text-sm font-semibold">
                    <Valor valor={m.margin} />
                    {m.margemPercentual != null && (
                      <span className="ml-1.5 text-xs font-normal text-creme-700">
                        {percent(m.margemPercentual)}
                      </span>
                    )}
                  </dd>
                </div>

                {m.bancos.map((b) => (
                  <div key={b.nome}>
                    <dt className="label">{b.nome}</dt>
                    <dd className="num mt-0.5 text-sm font-semibold">
                      <Valor valor={b.delta} />
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          );
        })}
      </section>

      <p className="text-xs text-creme-700">
        Esta tela não recalcula nada: os valores e as observações vêm da análise dos extratos, guardada
        no banco. Para atualizar um mês, atualize a linha correspondente.
      </p>
    </div>
  );
}
