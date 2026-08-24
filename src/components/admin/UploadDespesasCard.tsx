"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PreviaDespesas, type PreviaDespesasDados } from "./PreviaDespesas";

/** Upload da planilha de despesas do ano, com conferência antes de gravar. */
export function UploadDespesasCard() {
  const router = useRouter();
  const [previa, setPrevia] = useState<PreviaDespesasDados | null>(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function escolher(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    setErro(null);
    setOk(null);

    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/import/despesas/preview", { method: "POST", body });
    const data = await res.json();

    if (!res.ok) {
      setErro(data.error ?? "Não foi possível ler a planilha.");
      setBusy(false);
      return;
    }

    setPrevia(data);
    setBusy(false);
  }

  return (
    <section className="card p-6">
      <h2 className="font-display text-xl font-bold text-creme">Importar planilha de despesas</h2>
      <p className="mt-1 text-sm text-creme-500">
        O arquivo do ano inteiro, com as abas <strong className="text-creme-300">JAN</strong> a{" "}
        <strong className="text-creme-300">DEZ</strong>. Reimportar substitui os lançamentos dos meses que
        estiverem no arquivo.
      </p>

      {!previa && (
        <label className="btn-primary mt-5 cursor-pointer">
          <input type="file" accept=".xlsx,.xls" className="sr-only" onChange={escolher} disabled={busy} />
          {busy ? "Lendo planilha…" : "Escolher arquivo .xlsx"}
        </label>
      )}

      {erro && (
        <p role="alert" className="mt-4 rounded-xl border border-coral/40 bg-coral/10 px-4 py-3 text-sm text-coral-300">
          {erro}
        </p>
      )}

      {ok && (
        <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {ok}
        </p>
      )}

      {previa && (
        <PreviaDespesas
          previa={previa}
          onConcluido={(mensagem) => {
            setOk(mensagem);
            setPrevia(null);
            router.refresh();
          }}
          onDescartado={() => {
            setPrevia(null);
            setErro(null);
          }}
        />
      )}
    </section>
  );
}
