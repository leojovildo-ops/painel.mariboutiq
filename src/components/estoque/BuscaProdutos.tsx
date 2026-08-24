"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Busca por nome, código de barras ou categoria. */
export function BuscaProdutos({ inicial }: { inicial: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [texto, setTexto] = useState(inicial);

  function buscar(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (texto.trim()) params.set("q", texto.trim());
    else params.delete("q");
    // Uma busca nova sempre começa da primeira página.
    params.delete("pagina");
    router.push(`/estoque/produtos?${params.toString()}`);
  }

  return (
    <form onSubmit={buscar} className="flex flex-1 gap-2">
      <input
        className="input"
        placeholder="Buscar por nome, código ou categoria"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <button type="submit" className="btn-secondary shrink-0">
        Buscar
      </button>
    </form>
  );
}
