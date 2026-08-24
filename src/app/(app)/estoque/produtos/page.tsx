import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/rbac";
import { FILTRO_LABEL, getProdutos, situacaoDoItem, type FiltroDeProduto } from "@/lib/data/estoque";
import { money, integer, percent } from "@/lib/format";
import { BuscaProdutos } from "@/components/estoque/BuscaProdutos";

export const metadata: Metadata = { title: "Produtos · Painel Mariboutique 360" };
export const dynamic = "force-dynamic";

const TOM = {
  bom: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  atencao: "border-nivel-ouro/40 bg-nivel-ouro/10 text-nivel-ouro",
  ruim: "border-coral/45 bg-coral/10 text-coral-300",
  neutro: "border-base-600 bg-base-700/40 text-creme-700"
} as const;

const FILTROS: FiltroDeProduto[] = ["todos", "parados", "baixa-saida", "repor", "negativos", "campeoes"];

export default async function ProdutosPage({
  searchParams
}: {
  searchParams: { lista?: string; q?: string; pagina?: string };
}) {
  await requireAdmin();

  const filtro = (FILTROS.includes(searchParams.lista as FiltroDeProduto)
    ? searchParams.lista
    : "todos") as FiltroDeProduto;
  const busca = searchParams.q ?? "";
  const pagina = Number(searchParams.pagina) || 1;

  const dados = await getProdutos({ filtro, busca, pagina });

  const linkDe = (params: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    if (filtro !== "todos") p.set("lista", filtro);
    if (busca) p.set("q", busca);
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined) p.delete(k);
      else p.set(k, String(v));
    }
    return `/estoque/produtos?${p.toString()}`;
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-creme sm:text-3xl">Produtos</h1>
          <p className="mt-1 text-sm text-creme-500">
            {integer(dados.total)} produto{dados.total === 1 ? "" : "s"}
            {busca ? ` para "${busca}"` : ""} · valor de compra e de venda de cada um.
          </p>
        </div>
        <Link href="/estoque" className="btn-secondary">
          Voltar ao dashboard
        </Link>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <BuscaProdutos inicial={busca} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTROS.map((f) => {
          const p = new URLSearchParams();
          if (f !== "todos") p.set("lista", f);
          if (busca) p.set("q", busca);
          return (
            <Link
              key={f}
              href={`/estoque/produtos?${p.toString()}`}
              className={`rounded-xl px-3.5 py-2 text-sm font-medium ${
                f === filtro
                  ? "bg-coral text-base"
                  : "border border-base-600 text-creme-500 hover:border-coral/40 hover:text-creme"
              }`}
            >
              {FILTRO_LABEL[f]}
            </Link>
          );
        })}
      </div>

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="bg-base-700/60 text-left">
              <tr>
                <th className="px-4 py-2.5 font-semibold text-creme-500">Código</th>
                <th className="px-4 py-2.5 font-semibold text-creme-500">Produto</th>
                <th className="px-4 py-2.5 text-right font-semibold text-creme-500">Qtd</th>
                <th className="px-4 py-2.5 text-right font-semibold text-creme-500">Compra</th>
                <th className="px-4 py-2.5 text-right font-semibold text-creme-500">Venda</th>
                <th className="px-4 py-2.5 text-right font-semibold text-creme-500">Margem</th>
                <th className="px-4 py-2.5 text-right font-semibold text-creme-500">Vendeu</th>
                <th className="px-4 py-2.5 font-semibold text-creme-500">Situação</th>
              </tr>
            </thead>
            <tbody>
              {dados.itens.map((item) => {
                const situacao = situacaoDoItem(item);
                return (
                  <tr key={item.barcode} className="border-t border-base-600/50">
                    <td className="num px-4 py-2.5 text-creme-700">{item.code ?? item.barcode}</td>
                    <td className="px-4 py-2.5">
                      <span className="block max-w-[18rem] truncate text-creme-300">{item.description}</span>
                      {item.category && <span className="label">{item.category}</span>}
                    </td>
                    <td className="num px-4 py-2.5 text-right text-creme-500">{integer(item.quantity)}</td>
                    <td className="num px-4 py-2.5 text-right text-creme-500">{money(item.cost)}</td>
                    <td className="num px-4 py-2.5 text-right font-semibold text-creme">{money(item.price)}</td>
                    <td className="num px-4 py-2.5 text-right text-creme-500">
                      {item.margemPercentual == null ? "—" : percent(item.margemPercentual)}
                    </td>
                    <td className="num px-4 py-2.5 text-right text-creme-500">
                      {integer(item.unidadesVendidas)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TOM[situacao.tom]}`}
                      >
                        {situacao.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {dados.itens.length === 0 && (
          <p className="p-6 text-center text-sm text-creme-700">Nenhum produto encontrado.</p>
        )}
      </section>

      {dados.paginas > 1 && (
        <nav className="flex items-center justify-between gap-3">
          <Link
            href={linkDe({ pagina: dados.pagina - 1 })}
            aria-disabled={dados.pagina === 1}
            className={`btn-secondary ${dados.pagina === 1 ? "pointer-events-none opacity-40" : ""}`}
          >
            Anterior
          </Link>
          <span className="text-sm text-creme-500">
            Página {dados.pagina} de {dados.paginas}
          </span>
          <Link
            href={linkDe({ pagina: dados.pagina + 1 })}
            aria-disabled={dados.pagina === dados.paginas}
            className={`btn-secondary ${dados.pagina === dados.paginas ? "pointer-events-none opacity-40" : ""}`}
          >
            Próxima
          </Link>
        </nav>
      )}
    </div>
  );
}
