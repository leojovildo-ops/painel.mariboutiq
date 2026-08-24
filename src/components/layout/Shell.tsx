"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import type { Role } from "@prisma/client";
import { Wordmark } from "@/components/brand/Logo";
import { Nav } from "./Nav";

/** "24/08 às 16:23", ou só a data quando não é de hoje nem de ontem. */
function formatarAtualizacao(iso: string): string {
  const data = new Date(iso);
  const agora = new Date();
  const dias = Math.floor((agora.getTime() - data.getTime()) / 86400000);

  const dia = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(data);
  const hora = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(data);

  if (dias === 0) return `hoje às ${hora}`;
  if (dias === 1) return `ontem às ${hora}`;
  return dia;
}

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrador",
  SUPERVISORA: "Supervisora",
  VENDEDORA: "Vendedora"
};

export function Shell({
  role,
  name,
  greeting,
  canViewFinance,
  atualizadoEm,
  children
}: {
  role: Role;
  name: string;
  greeting: string;
  canViewFinance: boolean;
  /** ISO da última importação que valeu, ou null se nada foi importado. */
  atualizadoEm: string | null;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-dvh lg:flex">
      {/* Barra do topo — só no celular/tablet estreito. */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-base-600/60 bg-base/90 px-4 py-3 backdrop-blur lg:hidden">
        <Wordmark compact />
        <button
          type="button"
          className="btn-secondary px-3 py-2"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="menu-principal"
        >
          {menuOpen ? "Fechar" : "Menu"}
        </button>
      </header>

      <aside
        id="menu-principal"
        className={`${
          menuOpen ? "block" : "hidden"
        } border-b border-base-600/60 px-4 py-5 lg:sticky lg:top-0 lg:block lg:h-dvh lg:w-72 lg:shrink-0 lg:border-b-0 lg:border-r lg:px-5 lg:py-7`}
      >
        <div className="mb-8 hidden lg:block">
          <Wordmark />
        </div>

        <Nav role={role} canViewFinance={canViewFinance} onNavigate={() => setMenuOpen(false)} />

        <div className="mt-8 border-t border-base-600/60 pt-5 lg:absolute lg:bottom-7 lg:left-5 lg:right-5 lg:mt-0">
          <p className="text-sm font-semibold text-creme">{name}</p>
          <p className="label mt-0.5">{ROLE_LABEL[role]}</p>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="btn-ghost mt-2 px-0"
          >
            Sair
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-7 sm:px-7 lg:px-10 lg:py-10">
        <p className="font-display text-xl font-bold text-creme sm:text-2xl">
          {greeting}
          {atualizadoEm && (
            <span className="ml-2 font-sans text-sm font-normal text-creme-700">
              (dados de {formatarAtualizacao(atualizadoEm)})
            </span>
          )}
        </p>
        <div className="mt-7">{children}</div>
      </main>
    </div>
  );
}
