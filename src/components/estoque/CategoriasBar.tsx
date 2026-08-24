import { money, integer } from "@/lib/format";

/** Onde o dinheiro do estoque está preso, por categoria. */
export function CategoriasBar({
  categorias
}: {
  categorias: Array<{ categoria: string; itens: number; unidades: number; valorEmCusto: number; vendidas: number }>;
}) {
  const maior = categorias[0]?.valorEmCusto ?? 0;

  return (
    <ul className="space-y-3.5">
      {categorias.slice(0, 10).map((c) => (
        <li key={c.categoria}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-sm font-medium text-creme-300">{c.categoria}</span>
            <span className="num shrink-0 text-sm font-semibold text-creme">
              {money(c.valorEmCusto)}
              <span className="ml-2 text-xs font-normal text-creme-700">
                {integer(c.itens)} itens · vendeu {integer(c.vendidas)}
              </span>
            </span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-base-700">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-terracota to-coral"
              style={{ width: `${maior > 0 ? (c.valorEmCusto / maior) * 100 : 0}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
