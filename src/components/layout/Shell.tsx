"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import type { Role } from "@prisma/client";
import { Wordmark } from "@/components/brand/Logo";
import { Nav } from "./Nav";

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
  children
}: {
  role: Role;
  name: string;
  greeting: string;
  canViewFinance: boolean;
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
        <p className="font-display text-xl font-bold text-creme sm:text-2xl">{greeting}</p>
        <div className="mt-7">{children}</div>
      </main>
    </div>
  );
}
