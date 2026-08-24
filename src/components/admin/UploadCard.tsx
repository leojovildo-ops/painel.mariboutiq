"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PreviaVendas, type PreviaVendasDados } from "./PreviaVendas";

/** Upload da planilha do mês -> conferência -> gravação. Nada entra nos
 *  painéis antes de o Administrador confirmar a prévia. */
export function UploadCard() {
  const router = useRouter();
  const [previa, setPrevia] = useState<PreviaVendasDados | null>(null);
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
    const res = await fetch("/api/import/preview", { method: "POST", body });
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
      <h2 className="font-display text-xl font-bold text-creme">Importar planilha do mês</h2>
      <p className="mt-1 text-sm text-creme-500">
        Envie o arquivo .xlsx do mês. O sistema lê uma aba por vendedora e a aba{" "}
        <strong className="text-creme-300">Mari Boutique</strong>, ignorando as abas de modelo.
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
        <PreviaVendas
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
