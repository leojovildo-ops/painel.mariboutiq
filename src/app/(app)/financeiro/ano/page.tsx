import type { Metadata } from "next";
import Link from "next/link";
import { requireFinance } from "@/lib/rbac";
import { getFinanceYear, listFinanceYears } from "@/lib/data/finance";
import { getComparativoAnual } from "@/lib/data/comparativo";
import { agrupar, gerarObservacoesAno } from "@/lib/finance/insights";
import { money, monthName, percent } from "@/lib/format";
import { StatCard } from "@/components/ui/StatCard";
import { Observacoes } from "@/components/financeiro/Observacoes";
import { GruposBar } from "@/components/financeiro/GruposBar";
import { EvolucaoAno } from "@/components/financeiro/EvolucaoAno";
import { ComparativoAnos } from "@/components/financeiro/ComparativoAnos";

export const metadata: Metadata = { title: "Resumo de Resultado Anual · Painel Mariboutique 360" };
export const dynamic = "force-dynamic";

export default async function ResultadoAnoPage({ searchParams }: { searchParams: { ano?: string } }) {
  await requireFinance();

  const anos = await listFinanceYears();
  if (anos.length === 0) {
    return (
      <div className="card p-8 text-center">
        <h1 className="font-display text-2xl font-bold text-creme">Sem dados financeiros ainda</h1>
        <Link href="/admin" className="btn-primary mt-6">
          Ver as planilhas do Drive
        </Link>
      </div>
    );
  }

  const ano = anos.includes(Number(searchParams.ano)) ? Number(searchParams.ano) : anos[0];
  const meses = await getFinanceYear(ano);

  const faturamento = meses.reduce((acc, m) => acc + (m.revenue ?? 0), 0);
  const despesas = meses.reduce((acc, m) => acc + m.expenses, 0);
  const lucro = faturamento - despesas;
  const margem = faturamento > 0 ? (lucro / faturamento) * 100 : null;

  // Grupos somados no ano, no mesmo formato que a tela do mês usa.
  const acumulado = new Map<string, number>();
  for (const m of meses) for (const g of m.groups) acumulado.set(g.group, (acumulado.get(g.group) ?? 0) + g.total);
  const grupos = Array.from(acumulado.entries())
    .map(([group, total]) => ({ group, total, share: despesas > 0 ? (total / despesas) * 100 : 0 }))
    .sort((a, b) => b.total - a.total);

  const observacoes = agrupar(gerarObservacoesAno(meses));
  const comparativo = await getComparativoAnual();
  const ultimoMes = meses[meses.length - 1]?.month ?? 1;

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-creme sm:text-3xl">Resumo de Resultado Anual</h1>
          <p className="mt-1 text-sm text-creme-500">
            A loja em {ano}, mês a mês. Meses ainda em andamento entram como parciais.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Link href={`/financeiro?ano=${ano}`} className="btn-secondary">
            Ver por mês
          </Link>
          {anos.map((a) => (
            <Link
              key={a}
              href={`/financeiro/ano?ano=${a}`}
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
        <StatCard label="Faturamento do ano" value={money(faturamento)} hint={`${meses.length} meses com dado`} />
        <StatCard label="Despesas do ano" value={money(despesas)} hint={`${grupos.length} grupos`} />
        <StatCard label="Resultado" value={money(lucro)} hint={lucro < 0 ? "prejuízo acumulado" : "lucro acumulado"} />
        <StatCard label="Margem do ano" value={margem == null ? "—" : percent(margem)} hint="meta da casa: 10%" />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Observacoes tom="POSITIVO" itens={observacoes.POSITIVO} />
        <Observacoes tom="ATENCAO" itens={observacoes.ATENCAO} />
        <Observacoes tom="NEGATIVO" itens={observacoes.NEGATIVO} />
      </section>

      {comparativo.length > 1 && (
        <section className="card p-6">
          <h2 className="font-display text-lg font-bold text-creme">Comparativo entre os anos</h2>
          <p className="mb-6 mt-1 text-sm text-creme-500">
            Faturamento da loja mês a mês, desde {comparativo[comparativo.length - 1].year}.
          </p>
          <ComparativoAnos anos={comparativo} />
        </section>
      )}

      <section className="card p-6">
        <h2 className="mb-5 font-display text-lg font-bold text-creme">Faturamento x despesas</h2>
        <EvolucaoAno meses={meses} mesAtivo={ultimoMes} />
      </section>

      <section className="card overflow-hidden">
        <h2 className="px-6 pb-4 pt-6 font-display text-lg font-bold text-creme">Mês a mês</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[38rem] text-sm">
            <thead className="bg-base-700/60 text-left">
              <tr>
                <th className="px-6 py-2.5 font-semibold text-creme-500">Mês</th>
                <th className="px-4 py-2.5 text-right font-semibold text-creme-500">Faturamento</th>
                <th className="px-4 py-2.5 text-right font-semibold text-creme-500">Despesas</th>
                <th className="px-4 py-2.5 text-right font-semibold text-creme-500">Resultado</th>
                <th className="px-6 py-2.5 text-right font-semibold text-creme-500">Margem</th>
              </tr>
            </thead>
            <tbody>
              {meses.map((m) => (
                <tr key={m.month} className="border-t border-base-600/50">
                  <td className="px-6 py-2.5">
                    <Link href={`/financeiro?ano=${ano}&mes=${m.month}`} className="text-creme-300 hover:text-coral-300">
                      {monthName(m.month)}
                    </Link>
                    {m.emAndamento && <span className="ml-2 text-xs text-nivel-ouro">parcial</span>}
                  </td>
                  <td className="num px-4 py-2.5 text-right text-creme">{money(m.revenue)}</td>
                  <td className="num px-4 py-2.5 text-right text-creme-300">{money(m.expenses)}</td>
                  <td
                    className={`num px-4 py-2.5 text-right font-semibold ${
                      m.profit != null && m.profit < 0 ? "text-coral-300" : "text-emerald-300"
                    }`}
                  >
                    {money(m.profit)}
                  </td>
                  <td
                    className={`num px-6 py-2.5 text-right ${
                      m.margin != null && m.margin < 0 ? "text-coral-300" : "text-creme-300"
                    }`}
                  >
                    {m.margin == null ? "—" : percent(m.margin)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-base-600 bg-base-700/40 font-semibold">
                <td className="px-6 py-3 text-creme">Total</td>
                <td className="num px-4 py-3 text-right text-creme">{money(faturamento)}</td>
                <td className="num px-4 py-3 text-right text-creme">{money(despesas)}</td>
                <td className={`num px-4 py-3 text-right ${lucro < 0 ? "text-coral-300" : "text-emerald-300"}`}>
                  {money(lucro)}
                </td>
                <td className="num px-6 py-3 text-right text-creme">{margem == null ? "—" : percent(margem)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="mb-5 font-display text-lg font-bold text-creme">Despesas por grupo no ano</h2>
        <GruposBar groups={grupos} />
      </section>
    </div>
  );
}
