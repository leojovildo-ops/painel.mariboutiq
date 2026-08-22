import type { Metadata } from "next";
import Link from "next/link";
import { requireFinance } from "@/lib/rbac";
import { anosComPeriodo, getSaldosDoAno, listarContas } from "@/lib/data/saldos";
import { getFinanceYear } from "@/lib/data/finance";
import { money } from "@/lib/format";
import { StatCard } from "@/components/ui/StatCard";
import { SaldosDoMes } from "@/components/financeiro/SaldosDoMes";
import { EspecieParaCompras } from "@/components/financeiro/EspecieParaCompras";

export const metadata: Metadata = { title: "Saldos das Contas · Painel Mariboutique 360" };
export const dynamic = "force-dynamic";

const KIND_LABEL = { BANCO: "Banco", MAQUININHA: "Maquininha", ESPECIE: "Espécie" } as const;

export default async function ContasPage({ searchParams }: { searchParams: { ano?: string } }) {
  await requireFinance();

  const anos = await anosComPeriodo();
  if (anos.length === 0) {
    return <div className="card p-8 text-center text-sm text-creme-500">Nenhum mês registrado ainda.</div>;
  }

  const ano = anos.includes(Number(searchParams.ano)) ? Number(searchParams.ano) : anos[0];
  const contas = (await listarContas()).filter((c) => c.active);
  const meses = await getSaldosDoAno(ano, contas);

  const comDado = meses.filter((m) => m.totalInicio != null || m.totalFim != null);
  const primeiro = comDado.find((m) => m.totalInicio != null);
  const ultimo = [...comDado].reverse().find((m) => m.totalFim != null);
  const variacaoAno =
    primeiro?.totalInicio != null && ultimo?.totalFim != null ? ultimo.totalFim - primeiro.totalInicio : null;

  // O dinheiro em espécie é o que paga a mercadoria, então ele é comparado com
  // o que a loja gasta com fornecedor por mês.
  const contaEspecie = contas.find((c) => c.kind === "ESPECIE");
  const mesEspecie = contaEspecie
    ? [...meses].reverse().find((m) => m.saldos.find((s) => s.accountId === contaEspecie.id)?.closing != null)
    : undefined;
  const saldoEspecie = contaEspecie && mesEspecie
    ? (mesEspecie.saldos.find((s) => s.accountId === contaEspecie.id)?.closing ?? null)
    : null;

  const financeiro = await getFinanceYear(ano);
  const comprasPorMes = financeiro
    .filter((m) => !m.emAndamento)
    .map((m) => m.groups.find((g) => g.group === "FORNECEDOR")?.total ?? 0)
    .filter((valor) => valor > 0);
  const mediaCompras =
    comprasPorMes.length > 0
      ? comprasPorMes.reduce((a, b) => a + b, 0) / comprasPorMes.length
      : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-creme sm:text-3xl">Saldos das Contas</h1>
          <p className="mt-1 text-sm text-creme-500">
            Quanto cada conta tinha no começo e no fim de cada mês de {ano}.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Link href={`/financeiro/ano?ano=${ano}`} className="btn-secondary">
            Resultado do ano
          </Link>
          {anos.map((a) => (
            <Link
              key={a}
              href={`/financeiro/contas?ano=${a}`}
              className={`rounded-xl px-3.5 py-2 text-sm font-medium ${
                a === ano ? "bg-coral text-base" : "border border-base-600 text-creme-500 hover:text-creme"
              }`}
            >
              {a}
            </Link>
          ))}
        </div>
      </header>

      {contaEspecie && (
        <EspecieParaCompras
          saldo={saldoEspecie}
          mesDoSaldo={mesEspecie?.month ?? null}
          mediaCompras={mediaCompras}
          mesesConsiderados={comprasPorMes.length}
        />
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Começou o ano com"
          value={money(primeiro?.totalInicio ?? null)}
          hint={primeiro ? `saldo de abertura registrado` : "sem saldo lançado"}
        />
        <StatCard
          label="Último saldo registrado"
          value={money(ultimo?.totalFim ?? null)}
          hint={ultimo ? "somando todas as contas" : "sem saldo lançado"}
        />
        <StatCard
          label="Variação no período"
          value={variacaoAno == null ? "—" : `${variacaoAno >= 0 ? "+" : ""}${money(variacaoAno)}`}
          hint="do primeiro ao último saldo"
        />
      </section>

      <section className="card overflow-hidden">
        <ul>
          {meses.map((mes) => (
            <SaldosDoMes key={mes.periodId} mes={mes} contas={contas} />
          ))}
        </ul>
      </section>

      <div className="card p-5">
        <p className="label mb-3">Contas acompanhadas</p>
        <ul className="flex flex-wrap gap-2">
          {contas.map((c) => (
            <li key={c.id} className="rounded-full border border-base-600 px-3 py-1 text-sm text-creme-300">
              {c.name}
              <span className="ml-1.5 text-xs text-creme-700">{KIND_LABEL[c.kind]}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-creme-700">
          O lançamento dos saldos fica em Administração, junto dos uploads das planilhas — aqui é só
          consulta, para ninguém apagar um valor sem querer.
        </p>
      </div>
    </div>
  );
}
