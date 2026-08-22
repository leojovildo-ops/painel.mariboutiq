"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Apelidos pelos quais a vendedora aparece na pesquisa de satisfação.
 *
 * O campo "Outro:" do formulário é texto livre, então aparece de tudo: "Ster",
 * "Stefanny", "Stefany B". O casamento automático resolve erro de digitação e
 * começo de nome, mas apelidos que não lembram o nome só funcionam se alguém
 * disser que são a mesma pessoa — é para isso que serve esta lista.
 */
export function ApelidosVendedora({
  seller
}: {
  seller: { id: string; name: string; sheetName: string; aliases: string[] };
}) {
  const router = useRouter();
  const [texto, setTexto] = useState(seller.aliases.join(", "));
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  async function salvar() {
    setBusy(true);
    setErro(null);
    setSalvo(false);

    const aliases = texto
      .split(",")
      .map((a) => a.trim())
      .filter((a) => a.length >= 2);

    const res = await fetch(`/api/sellers/${seller.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aliases })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErro(data.error ?? "Não foi possível salvar.");
      setBusy(false);
      return;
    }

    setSalvo(true);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-base-600/40 py-3 last:border-b-0">
      <div className="min-w-[9rem]">
        <p className="text-sm font-semibold text-creme">{seller.name}</p>
        <p className="label mt-0.5">aba {seller.sheetName}</p>
      </div>

      <label className="min-w-[14rem] flex-1">
        <span className="label mb-1 block">Como aparece na pesquisa</span>
        <input
          className="input"
          placeholder="Stefanny, Ster"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setSalvo(false);
          }}
        />
      </label>

      <button type="button" className="btn-secondary" onClick={salvar} disabled={busy}>
        {busy ? "Salvando…" : salvo ? "Salvo" : "Salvar"}
      </button>

      {erro && <p className="w-full text-sm text-coral-300">{erro}</p>}
    </div>
  );
}
