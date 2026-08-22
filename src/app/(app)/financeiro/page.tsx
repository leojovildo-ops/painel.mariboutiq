import type { Metadata } from "next";
import Link from "next/link";
import { requireFinance } from "@/lib/rbac";
import { getFinanceYear, getMaioresLancamentos, listFinanceYears } from "@/lib/data/finance";
import { agrupar, gerarObservacoes } from "@/lib/finance/insights";
import { money, monthName, percent, periodLabel, integer } from "@/lib/format";
import { StatCard } from "@/components/ui/StatCard";
import { Observacoes } from "@/components/financeiro/Observacoes";
import { GruposBar } from "@/components/financeiro/GruposBar";
import { EvolucaoAno } from "@/components/financeiro/EvolucaoAno";

export const metadata: Metadata = { title: "Financeiro · Painel Mariboutique 360" };
export const dynamic = "force-dynamic";

export default async function FinanceiroPage({
  searchParams
}: {
  searchParams: { ano?: string; mes?: string };
}) {
  await requireFinance();

  const anos = await listFinanceYears();
  if (anos.length === 0) {
    return (
      <div className="card p-8 text-center sm:p-12">
        <h1 className="font-display text-2xl font-bold text-creme">Financeiro sem dados ainda</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-creme-500">
          Envie a planilha de despesas do ano na tela de Administração para ver o dashboard.
        </p>
        <Link href="/admin" className="btn-primary mt-6">
          Ir para Administração
        </Link>
      </div>
    );
  }

  const ano = anos.includes(Number(searchParams.ano)) ? Number(searchParams.ano) : anos[0];
  const meses = await getFinanceYear(ano);

  const mesPedido = Number(searchParams.mes);
  const mes = meses.find((m) => m.month === mesPedido) ?? meses[meses.length - 1];
  const anteriores = meses.filter((m) => m.month < mes.month);

  const observacoes = agrupar(gerarObservacoes(mes, anteriores));
  const maiores = await getMaioresLancamentos(mes.periodId);

  const totalAno = meses.reduce(
    (acc, m) => ({
      faturamento: acc.faturamento + (m.revenue ?? 0),
      despesas: acc.despesas + m.expenses
    }),
    { faturamento: 0, despesas: 0 }
  );
  const lucroAno = totalAno.faturamento - totalAno.despesas;

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-creme sm:text-3xl">Financeiro</h1>
          <p className="mt-1 text-sm text-creme-500">
            {periodLabel(mes.year, mes.month)} · dados da planilha de despesas de {ano}.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {meses.map((m) => (
            <Link
              key={m.month}
              href={`/financeiro?ano=${ano}&mes=${m.month}`}
              aria-current={m.month === mes.month ? "page" : undefined}
              className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                m.month === mes.month
                  ? "bg-coral text-base"
                  : "border border-base-600 text-creme-500 hover:border-coral/40 hover:text-creme"
              }`}
            >
              {monthName(m.month).slice(0, 3)}
            </Link>
          ))}
        </div>
      </header>

      {/* Os quatro números que respondem "como foi o mês". */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Faturamento"
          value={money(mes.revenue)}
          hint={mes.revenueSource === "VENDAS" ? "da planilha de vendas" : "da planilha financeira"}
        />
        <StatCard label="Despesas" value={money(mes.expenses)} hint={`${integer(mes.groups.length)} grupos`} />
        <StatCard
          label="Lucro líquido"
          value={money(mes.profit)}
          hint={mes.profit != null && mes.profit < 0 ? "no vermelho" : "faturamento menos despesas"}
        />
        <StatCard
          label="Margem"
          value={mes.margin == null ? "—" : percent(mes.margin)}
          hint="meta da casa: 10%"
        />
      </section>

      {/* A leitura em texto: é aqui que o dashboard explica o que aconteceu. */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Observacoes tom="POSITIVO" itens={observacoes.POSITIVO} />
        <Observacoes tom="ATENCAO" itens={observacoes.ATENCAO} />
        <Observacoes tom="NEGATIVO" itens={observacoes.NEGATIVO} />
      </section>

      <section className="card p-6">
        <h2 className="font-display text-lg font-bold text-creme">Faturamento x despesas no ano</h2>
        <p className="mb-5 mt-1 text-sm text-creme-500">
          Acumulado de {ano}: {money(totalAno.faturamento)} faturados, {money(totalAno.despesas)} de despesas,{" "}
          <strong className={lucroAno < 0 ? "text-coral-300" : "text-emerald-300"}>{money(lucroAno)}</strong> de
          resultado.
        </p>
        <EvolucaoAno meses={meses} mesAtivo={mes.month} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="mb-5 font-display text-lg font-bold text-creme">
            Despesas por grupo · {monthName(mes.month)}
          </h2>
          <GruposBar groups={mes.groups} />
        </section>

        <section className="card p-6">
          <h2 className="font-display text-lg font-bold text-creme">Maiores lançamentos do mês</h2>
          <p className="mb-4 mt-1 text-sm text-creme-500">Onde o dinheiro do mês foi parar, linha a linha.</p>
          <ul className="space-y-2.5">
            {maiores.map((l) => (
              <li key={l.id} className="flex items-baseline justify-between gap-3 border-b border-base-600/40 pb-2.5 last:border-b-0">
                <span className="min-w-0">
                  <span className="block truncate text-sm text-creme-300">{l.description}</span>
                  <span className="label">{l.group}</span>
                </span>
                <span className="num shrink-0 text-sm font-semibold text-creme">
                  {money(l.amount)}
                  {l.paidAt == null && (
                    <span className="ml-2 rounded-full border border-nivel-ouro/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-nivel-ouro">
                      em aberto
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
