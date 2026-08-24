import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/rbac";
import { getResumoEstoque } from "@/lib/data/estoque";
import { money, integer, percent } from "@/lib/format";
import { StatCard } from "@/components/ui/StatCard";
import { Observacoes } from "@/components/financeiro/Observacoes";
import { ListaDeItens } from "@/components/estoque/ListaDeItens";
import { CategoriasBar } from "@/components/estoque/CategoriasBar";
import type { Observacao } from "@/lib/finance/insights";

export const metadata: Metadata = { title: "Estoque · Painel Mariboutique 360" };
export const dynamic = "force-dynamic";

const data = (d: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(d);

export default async function EstoquePage() {
  await requireAdmin();
  const r = await getResumoEstoque();

  if (!r.temDados) {
    return (
      <div className="card p-8 text-center sm:p-12">
        <h1 className="font-display text-2xl font-bold text-creme">Estoque sem dados ainda</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-creme-500">
          Envie o levantamento de estoque do SISloja — o arquivo com as abas de estoque e de vendas item
          a item.
        </p>
        <Link href="/admin" className="btn-primary mt-6">
          Ir para Administração
        </Link>
      </div>
    );
  }

  const custoParado = r.parados.reduce((s, i) => s + i.valorEmCusto, 0);
  const custoBaixaSaida = r.baixaSaida.reduce((s, i) => s + i.valorEmCusto, 0);
  const parcelaPresa = r.valorEmCusto > 0 ? ((custoParado + custoBaixaSaida) / r.valorEmCusto) * 100 : 0;

  // A leitura em texto segue o mesmo padrão do financeiro: o que está bom, o
  // que vigiar e o que já é dinheiro travado na prateleira.
  const criticos: Observacao[] = [];
  const atencao: Observacao[] = [];
  const positivos: Observacao[] = [];

  if (r.parados.length > 0) {
    criticos.push({
      tom: "NEGATIVO",
      titulo: `${integer(r.parados.length)} produtos não venderam nenhuma unidade`,
      texto: `São ${money(custoParado)} em custo parados na prateleira durante todo o período analisado. O maior deles é "${r.parados[0].description}", com ${integer(r.parados[0].quantity)} unidades.`
    });
  }

  if (r.baixaSaida.length > 0) {
    atencao.push({
      tom: "ATENCAO",
      titulo: `${integer(r.baixaSaida.length)} produtos com mais de 6 meses de estoque`,
      texto: `${money(custoBaixaSaida)} em custo que, no ritmo de venda atual, demoram para virar dinheiro.`
    });
  }

  if (parcelaPresa >= 25) {
    atencao.push({
      tom: "ATENCAO",
      titulo: `${percent(parcelaPresa)} do estoque está parado ou girando devagar`,
      texto: `De ${money(r.valorEmCusto)} em estoque, ${money(custoParado + custoBaixaSaida)} estão nessas duas situações.`
    });
  }

  if (r.repor.length > 0) {
    positivos.push({
      tom: "POSITIVO",
      titulo: `${integer(r.repor.length)} produtos zerados que vinham vendendo`,
      texto: `Venda perdida por falta de estoque. O primeiro da fila é "${r.repor[0].description}", que vendeu ${integer(r.repor[0].unidadesVendidas)} unidades e está zerado.`
    });
  }

  if (r.margemMedia != null) {
    positivos.push({
      tom: "POSITIVO",
      titulo: `Margem média de ${percent(r.margemMedia)} sobre o preço de venda`,
      texto: `O estoque custou ${money(r.valorEmCusto)} e está anunciado por ${money(r.valorEmVenda)}.`
    });
  }

  if (r.campeoes.length > 0) {
    positivos.push({
      tom: "POSITIVO",
      titulo: `Campeão de saída: ${r.campeoes[0].description}`,
      texto: `${integer(r.campeoes[0].unidadesVendidas)} unidades no período, com ${integer(r.campeoes[0].quantity)} ainda em estoque.`
    });
  }

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-creme sm:text-3xl">Estoque</h1>
          <p className="mt-1 text-sm text-creme-500">
          {r.periodo
            ? `Foto do estoque cruzada com as vendas de ${data(r.periodo.de)} a ${data(r.periodo.ate)} (${r.periodo.dias} dias).`
            : "Foto do estoque do SISloja."}
          </p>
        </div>

        <Link href="/estoque/produtos" className="btn-primary">
          Ver todos os produtos
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Produtos" value={integer(r.itens)} hint={`${integer(r.unidades)} unidades`} />
        <StatCard label="Valor em custo" value={money(r.valorEmCusto)} hint="o que está na prateleira" />
        <StatCard label="Valor em venda" value={money(r.valorEmVenda)} hint="se vender tudo a preço cheio" />
        <StatCard
          label="Margem média"
          value={r.margemMedia == null ? "—" : percent(r.margemMedia)}
          hint="sobre o preço de venda"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Observacoes tom="POSITIVO" itens={positivos} />
        <Observacoes tom="ATENCAO" itens={atencao} />
        <Observacoes tom="NEGATIVO" itens={criticos} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="font-display text-lg font-bold text-creme">Estoque parado</h2>
          <p className="mb-4 mt-1 text-sm text-creme-500">
            Não venderam nenhuma unidade no período. {money(custoParado)} em custo, do maior para o menor.
          </p>
          <ListaDeItens itens={r.parados} coluna="valor" verTodos="parados" />
        </section>

        <section className="card p-6">
          <h2 className="font-display text-lg font-bold text-creme">Baixa saída</h2>
          <p className="mb-4 mt-1 text-sm text-creme-500">
            Vendem, mas devagar: no ritmo atual o estoque dura mais de 6 meses.
          </p>
          <ListaDeItens itens={r.baixaSaida} coluna="cobertura" verTodos="baixa-saida" />
        </section>

        <section className="card p-6">
          <h2 className="font-display text-lg font-bold text-creme">Repor com prioridade</h2>
          <p className="mb-4 mt-1 text-sm text-creme-500">
            Zerados que vinham vendendo — cada dia sem repor é venda perdida.
          </p>
          <ListaDeItens itens={r.repor} coluna="vendidas" verTodos="repor" />
        </section>

        <section className="card p-6">
          <h2 className="font-display text-lg font-bold text-creme">Campeões de saída</h2>
          <p className="mb-4 mt-1 text-sm text-creme-500">O que mais girou no período.</p>
          <ListaDeItens itens={r.campeoes} coluna="vendidas" verTodos="campeoes" />
        </section>
      </div>

      <section className="card p-6">
        <h2 className="font-display text-lg font-bold text-creme">Onde o dinheiro está preso</h2>
        <p className="mb-5 mt-1 text-sm text-creme-500">
          Valor em custo por categoria, com quantas unidades cada uma vendeu no período.
        </p>
        <CategoriasBar categorias={r.porCategoria} />
      </section>

      {r.arquivo && (
        <p className="text-xs text-creme-700">Origem: {r.arquivo}</p>
      )}
    </div>
  );
}
