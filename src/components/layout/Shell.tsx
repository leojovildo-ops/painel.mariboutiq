"use client";

import { useEffect, useState } from "react";
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

/** Hambúrguer fechado, "X" aberto. */
function IconeMenu({ aberto }: { aberto?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      {aberto ? (
        <>
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </>
      ) : (
        <>
          <line x1="3.5" y1="7" x2="20.5" y2="7" />
          <line x1="3.5" y1="12" x2="20.5" y2="12" />
          <line x1="3.5" y1="17" x2="20.5" y2="17" />
        </>
      )}
    </svg>
  );
}

/** Quem está logado e a saída, iguais no sheet e na lateral. */
function Rodape({ role, name }: { role: Role; name: string }) {
  return (
    <>
      <p className="text-sm font-semibold text-creme">{name}</p>
      <p className="label mt-0.5">{ROLE_LABEL[role]}</p>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="btn-ghost mt-2 px-0"
      >
        Sair
      </button>
    </>
  );
}

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

  // Com o sheet aberto, rolar o fundo dá a impressão de que o menu "escapou";
  // e o Esc é o jeito esperado de fechar qualquer painel sobreposto.
  useEffect(() => {
    if (!menuOpen) return;

    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", aoTeclar);

    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [menuOpen]);

  return (
    <div className="min-h-dvh lg:flex">
      {/* Barra do topo — só no celular/tablet estreito. */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-base-600/60 bg-base/90 px-4 py-3 backdrop-blur lg:hidden">
        <Wordmark compact />
        {/* No celular a navegação inteira mora aqui dentro: o botão é o único
            caminho para as páginas, então precisa de rótulo acessível mesmo
            sendo só um ícone. */}
        <button
          type="button"
          className="btn-secondary px-3 py-2"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="menu-principal"
          aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
        >
          <IconeMenu aberto={menuOpen} />
        </button>
      </header>

      {/* Celular: o menu abre como sheet por cima do conteúdo, e não empurrando
          a página. Fica sempre montado para poder deslizar na abertura e no
          fechamento; `invisible` tira do caminho do toque quando está fechado. */}
      <div
        className={`fixed inset-0 z-40 lg:hidden ${menuOpen ? "visible" : "invisible"}`}
        aria-hidden={!menuOpen}
      >
        <div
          className={`absolute inset-0 bg-base/80 backdrop-blur-sm transition-opacity duration-300 ${
            menuOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMenuOpen(false)}
        />

        <aside
          id="menu-principal"
          role="dialog"
          aria-modal="true"
          aria-label="Menu principal"
          className={`absolute inset-y-0 right-0 flex w-[min(20rem,85vw)] flex-col overflow-y-auto border-l border-base-600/60 bg-base px-5 py-6 shadow-2xl transition-transform duration-300 ease-out ${
            menuOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="mb-6 flex items-center justify-between">
            <Wordmark compact />
            <button
              type="button"
              className="btn-secondary px-3 py-2"
              onClick={() => setMenuOpen(false)}
              aria-label="Fechar menu"
            >
              <IconeMenu aberto />
            </button>
          </div>

          <Nav role={role} canViewFinance={canViewFinance} onNavigate={() => setMenuOpen(false)} />

          <div className="mt-8 border-t border-base-600/60 pt-5">
            <Rodape role={role} name={name} />
          </div>
        </aside>
      </div>

      {/* Telas largas: a mesma navegação, fixa na lateral. */}
      <aside className="relative hidden lg:sticky lg:top-0 lg:block lg:h-dvh lg:w-72 lg:shrink-0 lg:border-r lg:border-base-600/60 lg:px-5 lg:py-7">
        <div className="mb-8">
          <Wordmark />
        </div>

        <Nav role={role} canViewFinance={canViewFinance} />

        <div className="absolute bottom-7 left-5 right-5">
          <Rodape role={role} name={name} />
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
