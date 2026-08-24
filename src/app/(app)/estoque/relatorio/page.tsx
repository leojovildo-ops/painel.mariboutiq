import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/rbac";
import { getResumoEstoque, type ItemAnalisado } from "@/lib/data/estoque";
import { money, integer, percent } from "@/lib/format";
import { BotaoImprimir } from "@/components/estoque/BotaoImprimir";

export const metadata: Metadata = { title: "Relatório de Estoque · Painel Mariboutique 360" };
export const dynamic = "force-dynamic";

const data = (d: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(d);

/** Coluna final, diferente em cada tópico, igual à do dashboard. */
type Extra = "valor" | "cobertura" | "vendidas";

function Secao({
  titulo,
  descricao,
  itens,
  extra,
  limite,
  primeira = false
}: {
  titulo: string;
  descricao: string;
  itens: ItemAnalisado[];
  extra: Extra;
  limite?: number;
  primeira?: boolean;
}) {
  const lista = limite ? itens.slice(0, limite) : itens;
  const rotulo = { valor: "Em custo", cobertura: "Dura", vendidas: "Vendeu" }[extra];
  const totalCusto = itens.reduce((s, i) => s + i.valorEmCusto, 0);

  return (
    <section className={primeira ? "" : "quebra-pagina"}>
      <h2 className="font-display text-xl font-bold text-creme">{titulo}</h2>
      <p className="mb-4 mt-1 text-sm text-creme-500">
        {descricao} · {integer(itens.length)} produto{itens.length === 1 ? "" : "s"}
        {extra !== "vendidas" && ` · ${money(totalCusto)} em custo`}
      </p>

      {lista.length === 0 ? (
        <p className="text-sm text-creme-700">Nenhum produto nesta situação.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b border-base-600 text-left">
            <tr>
              <th className="py-2 pr-3 font-semibold text-creme-500">Código</th>
              <th className="py-2 pr-3 font-semibold text-creme-500">Produto</th>
              <th className="py-2 pr-3 text-right font-semibold text-creme-500">Qtd</th>
              <th className="py-2 pr-3 text-right font-semibold text-creme-500">Compra</th>
              <th className="py-2 pr-3 text-right font-semibold text-creme-500">Venda</th>
              <th className="py-2 text-right font-semibold text-creme-500">{rotulo}</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((item) => (
              <tr key={item.barcode} className="border-b border-base-600/40">
                <td className="num py-1.5 pr-3 text-creme-700">{item.code ?? item.barcode}</td>
                <td className="py-1.5 pr-3 text-creme-300">
                  {item.description}
                  {item.category && <span className="ml-2 text-xs text-creme-700">{item.category}</span>}
                </td>
                <td className="num py-1.5 pr-3 text-right text-creme-500">{integer(item.quantity)}</td>
                <td className="num py-1.5 pr-3 text-right text-creme-500">{money(item.cost)}</td>
                <td className="num py-1.5 pr-3 text-right text-creme">{money(item.price)}</td>
                <td className="num py-1.5 text-right font-semibold text-creme">
                  {extra === "valor" && money(item.valorEmCusto)}
                  {extra === "cobertura" &&
                    (item.coberturaMeses == null ? "—" : `${item.coberturaMeses.toFixed(0)} meses`)}
                  {extra === "vendidas" && integer(item.unidadesVendidas)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {limite && itens.length > limite && (
        <p className="mt-3 text-xs text-creme-700">
          Mostrando os {limite} primeiros de {integer(itens.length)}.
        </p>
      )}
    </section>
  );
}

export default async function RelatorioEstoquePage() {
  await requireAdmin();
  const r = await getResumoEstoque();

  if (!r.temDados) {
    return <div className="card p-8 text-center text-sm text-creme-500">Nenhum dado de estoque importado.</div>;
  }

  const geradoEm = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date());

  return (
    <div className="impresso space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-base-600 pb-5">
        <div>
          <h1 className="font-display text-2xl font-bold text-creme">Relatório de Estoque</h1>
          <p className="mt-1 text-sm text-creme-500">Mari Boutique · gerado em {geradoEm}</p>
          {r.periodo && (
            <p className="text-sm text-creme-500">
              Estoque cruzado com as vendas de {data(r.periodo.de)} a {data(r.periodo.ate)} ({r.periodo.dias} dias).
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Link href="/estoque" className="btn-secondary print:hidden">
            Voltar
          </Link>
          <BotaoImprimir />
        </div>
      </header>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Produtos", valor: integer(r.itens), extra: `${integer(r.unidades)} unidades` },
          { label: "Valor em custo", valor: money(r.valorEmCusto), extra: "na prateleira" },
          { label: "Valor em venda", valor: money(r.valorEmVenda), extra: "a preço cheio" },
          {
            label: "Margem média",
            valor: r.margemMedia == null ? "—" : percent(r.margemMedia),
            extra: "sobre a venda"
          }
        ].map((k) => (
          <div key={k.label}>
            <p className="label">{k.label}</p>
            <p className="num mt-1 font-display text-lg font-bold text-creme">{k.valor}</p>
            <p className="text-xs text-creme-700">{k.extra}</p>
          </div>
        ))}
      </section>

      <Secao
        primeira
        titulo="Estoque parado"
        descricao="Com estoque e nenhuma unidade vendida no período"
        itens={r.parados}
        extra="valor"
      />
      <Secao
        titulo="Baixa saída"
        descricao="No ritmo atual, o estoque dura mais de 6 meses"
        itens={r.baixaSaida}
        extra="cobertura"
      />
      <Secao
        titulo="Repor com prioridade"
        descricao="Zerados que vinham vendendo — venda perdida por falta de estoque"
        itens={r.repor}
        extra="vendidas"
      />
      <Secao
        titulo="Campeões de saída"
        descricao="O que mais girou no período"
        itens={r.campeoes}
        extra="vendidas"
        limite={50}
      />

      {r.negativos.length > 0 && (
        <Secao
          titulo="Estoque negativo"
          descricao="Quantidade abaixo de zero no SISloja — o controle e a prateleira não batem"
          itens={r.negativos}
          extra="vendidas"
        />
      )}
    </div>
  );
}
