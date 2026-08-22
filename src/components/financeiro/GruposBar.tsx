import { money, percent } from "@/lib/format";
import type { GrupoTotal } from "@/lib/data/finance";

/**
 * Barras horizontais em vez de pizza: com seis grupos de tamanhos muito
 * diferentes, comparar comprimento é bem mais fácil que comparar fatias.
 */
export function GruposBar({ groups }: { groups: GrupoTotal[] }) {
  const maior = groups[0]?.total ?? 0;

  return (
    <ul className="space-y-3.5">
      {groups.map((g) => (
        <li key={g.group}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-sm font-medium text-creme-300">{g.group}</span>
            <span className="num shrink-0 text-sm font-semibold text-creme">
              {money(g.total)}
              <span className="ml-2 text-xs font-normal text-creme-700">{percent(g.share)}</span>
            </span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-base-700">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-terracota to-coral"
              style={{ width: `${maior > 0 ? (g.total / maior) * 100 : 0}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
