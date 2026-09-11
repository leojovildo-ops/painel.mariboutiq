"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";

interface NavItem {
  href: string;
  label: string;
  adminOnly?: boolean;
}

const VENDAS: NavItem[] = [
  { href: "/metas", label: "Metas da Loja" },
  { href: "/ranking", label: "Ranking de Vendas" },
  { href: "/niveis", label: "Ranking de Nível" },
  { href: "/ranking-ano", label: "Ranking do Ano" },
  { href: "/admin", label: "Administração", adminOnly: true }
];

const FINANCEIRO: NavItem[] = [
  { href: "/financeiro", label: "Dashboard do mês" },
  { href: "/financeiro/ano", label: "Resumo de resultado anual" },
  { href: "/financeiro/contas", label: "Saldos das contas" },
  { href: "/financeiro/caixa", label: "Fluxo de caixa" }
];

const ESTOQUE: NavItem[] = [{ href: "/estoque", label: "Dashboard" }];

export function Nav({
  role,
  canViewFinance,
  avisos = 0,
  onNavigate
}: {
  role: Role;
  canViewFinance: boolean;
  /** Problemas da importação automática esperando um olhar na Administração. */
  avisos?: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items = VENDAS.filter((item) => !item.adminOnly || role === "ADMIN");

  return (
    <nav className="flex flex-col gap-6">
      <div>
        <p className="label mb-2 px-3">Vendas</p>
        <ul className="space-y-1">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-coral/15 text-coral-300 shadow-[inset_0_0_0_1px_rgba(228,113,78,0.3)]"
                      : "text-creme-500 hover:bg-base-700/60 hover:text-creme"
                  }`}
                >
                  {item.label}
                  {item.href === "/admin" && avisos > 0 && (
                    <span
                      className="ml-2 inline-flex min-w-[1.25rem] justify-center rounded-full bg-coral px-1.5 py-0.5 text-xs font-bold text-base"
                      aria-label={`${avisos} aviso(s) de importação`}
                    >
                      {avisos}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Financeiro só aparece para quem tem o direito liberado, e o direito
          é por pessoa: ser Administrador não basta. */}
      {canViewFinance && (
        <div>
          <p className="label mb-2 px-3">Financeiro</p>
          <ul className="space-y-1">
            {FINANCEIRO.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-coral/15 text-coral-300 shadow-[inset_0_0_0_1px_rgba(228,113,78,0.3)]"
                        : "text-creme-500 hover:bg-base-700/60 hover:text-creme"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Estoque traz custo e margem por produto, então fica restrito ao
          Administrador, como a Administração. */}
      {role === "ADMIN" && (
        <div>
          <p className="label mb-2 px-3">Estoque</p>
          <ul className="space-y-1">
            {ESTOQUE.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-coral/15 text-coral-300 shadow-[inset_0_0_0_1px_rgba(228,113,78,0.3)]"
                        : "text-creme-500 hover:bg-base-700/60 hover:text-creme"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </nav>
  );
}
