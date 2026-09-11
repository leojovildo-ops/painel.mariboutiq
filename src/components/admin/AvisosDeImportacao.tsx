"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AvisoDeImportacao } from "@/lib/data/avisosDeImportacao";

function quando(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}

/**
 * A notificação do robô. Fica no topo da Administração porque é o único lugar
 * onde alguém pode agir sobre o que ela diz — e some assim que for lida, para
 * não virar paisagem.
 */
export function AvisosDeImportacao({ avisos }: { avisos: AvisoDeImportacao[] }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);

  if (avisos.length === 0) return null;

  async function darPorVisto(fileId?: string) {
    setOcupado(fileId ?? "todos");
    await fetch("/api/drive/avisos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fileId ? { fileId } : {})
    });
    setOcupado(null);
    router.refresh();
  }

  const falhas = avisos.filter((a) => !a.ok).length;

  return (
    <section className="rounded-2xl border border-coral/40 bg-coral/10 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-creme">
            {falhas > 0
              ? `${falhas} planilha(s) não entraram`
              : `${avisos.length} planilha(s) entraram com ressalva`}
          </h2>
          <p className="mt-1 text-sm text-creme-500">
            As planilhas do Drive entram sozinhas. Isto é o que a leitura estranhou.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary w-full sm:w-auto"
          onClick={() => darPorVisto()}
          disabled={ocupado !== null}
        >
          Dar tudo por visto
        </button>
      </div>

      <ul className="mt-4 space-y-3">
        {avisos.map((aviso) => (
          <li key={aviso.fileId} className="rounded-xl border border-base-600/60 bg-base/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-creme">{aviso.fileName}</p>
                <p className="label mt-0.5">
                  {aviso.ok ? "Gravado com ressalva" : "Não gravado"} · {quando(aviso.quando)}
                </p>
              </div>
              <button
                type="button"
                className="btn-ghost px-0 text-xs"
                onClick={() => darPorVisto(aviso.fileId)}
                disabled={ocupado !== null}
              >
                Dar por visto
              </button>
            </div>

            {aviso.erro && <p className="mt-2 text-sm text-coral-300">{aviso.erro}</p>}

            {aviso.avisos.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-creme-500">
                {aviso.avisos.map((texto, i) => (
                  <li key={i}>· {texto}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
