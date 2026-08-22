"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { periodLabel } from "@/lib/format";

export interface MonthOption {
  slug: string;
  year: number;
  month: number;
}

/**
 * Navegação entre os meses já importados. Em telas largas vira uma fila de
 * abas (um mês por vez, nunca tudo misturado); no celular, um select.
 */
export function MonthSelector({ months, current }: { months: MonthOption[]; current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function go(slug: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mes", slug);
    router.push(`${pathname}?${params.toString()}`);
  }

  if (months.length === 0) return null;

  return (
    <div>
      <div className="sm:hidden">
        <label htmlFor="mes" className="label mb-1.5 block">
          Mês
        </label>
        <select id="mes" className="input" value={current} onChange={(e) => go(e.target.value)}>
          {months.map((m) => (
            <option key={m.slug} value={m.slug}>
              {periodLabel(m.year, m.month)}
            </option>
          ))}
        </select>
      </div>

      <div className="hidden gap-1.5 overflow-x-auto pb-1 sm:flex" role="tablist" aria-label="Selecionar mês">
        {months.map((m) => {
          const active = m.slug === current;
          return (
            <button
              key={m.slug}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => go(m.slug)}
              className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-coral text-base"
                  : "border border-base-600 text-creme-500 hover:border-coral/40 hover:text-creme"
              }`}
            >
              {periodLabel(m.year, m.month)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
