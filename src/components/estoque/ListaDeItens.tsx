import { money, integer } from "@/lib/format";
import type { ItemAnalisado } from "@/lib/data/estoque";

type Coluna = "valor" | "cobertura" | "vendidas";

/**
 * Lista de produtos de uma situação (parado, baixa saída, repor...).
 *
 * A última coluna muda conforme a pergunta que a lista responde: em estoque
 * parado o que importa é o dinheiro na prateleira; em baixa saída, quanto
 * tempo ele vai durar; em reposição, o quanto vendia.
 */
export function ListaDeItens({
  itens,
  coluna,
  limite = 10
}: {
  itens: ItemAnalisado[];
  coluna: Coluna;
  limite?: number;
}) {
  if (itens.length === 0) {
    return <p className="text-sm text-creme-700">Nenhum item nesta situação.</p>;
  }

  const rotulo = { valor: "Em custo", cobertura: "Dura", vendidas: "Vendeu" }[coluna];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[26rem] text-sm">
        <thead className="text-left">
          <tr className="border-b border-base-600/60">
            <th className="pb-2 font-semibold text-creme-500">Produto</th>
            <th className="pb-2 text-right font-semibold text-creme-500">Qtd</th>
            <th className="pb-2 text-right font-semibold text-creme-500">{rotulo}</th>
          </tr>
        </thead>
        <tbody>
          {itens.slice(0, limite).map((item) => (
            <tr key={item.barcode} className="border-b border-base-600/30 last:border-b-0">
              <td className="py-2 pr-3">
                <span className="block truncate text-creme-300">{item.description}</span>
                {item.category && <span className="label">{item.category}</span>}
              </td>
              <td className="num py-2 text-right text-creme-500">{integer(item.quantity)}</td>
              <td className="num py-2 text-right font-semibold text-creme">
                {coluna === "valor" && money(item.valorEmCusto)}
                {coluna === "cobertura" &&
                  (item.coberturaMeses == null
                    ? "—"
                    : `${item.coberturaMeses.toFixed(0)} ${item.coberturaMeses < 2 ? "mês" : "meses"}`)}
                {coluna === "vendidas" && integer(item.unidadesVendidas)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {itens.length > limite && (
        <p className="mt-3 text-xs text-creme-700">
          Mostrando os {limite} primeiros de {integer(itens.length)}.
        </p>
      )}
    </div>
  );
}
