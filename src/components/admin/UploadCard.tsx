"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money, monthName, integer } from "@/lib/format";

interface PreviewSeller {
  sheetName: string;
  revenue: number;
  salesCount: number;
  pieces: number;
}

interface Preview {
  batchId: string;
  fileName: string;
  year: number | null;
  month: number | null;
  store: PreviewSeller | null;
  sellers: PreviewSeller[];
  ignoredSheets: string[];
  warnings: string[];
  replacesExisting: boolean;
}

const ANOS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i);

/** Upload da planilha do mês -> conferência -> gravação. Nada entra nos
 *  painéis antes de o Administrador confirmar a prévia. */
export function UploadCard() {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    setError(null);
    setDone(null);

    const body = new FormData();
    body.append("file", file);

    const response = await fetch("/api/import/preview", { method: "POST", body });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "Não foi possível ler a planilha.");
      setBusy(false);
      return;
    }

    setPreview(data);
    if (data.year) setYear(data.year);
    if (data.month) setMonth(data.month);
    setBusy(false);
  }

  async function confirm() {
    if (!preview) return;
    setBusy(true);
    setError(null);

    const response = await fetch(`/api/import/${preview.batchId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month })
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "Não foi possível salvar a importação.");
      setBusy(false);
      return;
    }

    setDone(`${monthName(month)} de ${year} importado: ${data.sellersSaved} vendedora(s).`);
    setPreview(null);
    setBusy(false);
    router.refresh();
  }

  async function discard() {
    if (!preview) return;
    await fetch(`/api/import/${preview.batchId}`, { method: "DELETE" });
    setPreview(null);
    setError(null);
  }

  return (
    <section className="card p-6">
      <h2 className="font-display text-xl font-bold text-creme">Importar planilha do mês</h2>
      <p className="mt-1 text-sm text-creme-500">
        Envie o arquivo .xlsx do mês. O sistema lê uma aba por vendedora e a aba{" "}
        <strong className="text-creme-300">Mari Boutique</strong>, ignorando as abas de modelo.
      </p>

      {!preview && (
        <label className="btn-primary mt-5 cursor-pointer">
          <input type="file" accept=".xlsx,.xls" className="sr-only" onChange={handleFile} disabled={busy} />
          {busy ? "Lendo planilha…" : "Escolher arquivo .xlsx"}
        </label>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-coral/40 bg-coral/10 px-4 py-3 text-sm text-coral-300">
          {error}
        </p>
      )}

      {done && (
        <p className="mt-4 rounded-xl border border-nivel-diamante/30 bg-nivel-diamante/10 px-4 py-3 text-sm text-nivel-diamante">
          {done}
        </p>
      )}

      {preview && (
        <div className="mt-5 space-y-5">
          <div className="rounded-xl border border-base-600 bg-base-700/40 p-4">
            <p className="label">Arquivo</p>
            <p className="mt-1 text-sm font-semibold text-creme">{preview.fileName}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="import-mes" className="label mb-1.5 block">
                Mês
              </label>
              <select id="import-mes" className="input" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {monthName(m)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="import-ano" className="label mb-1.5 block">
                Ano
              </label>
              <select id="import-ano" className="input" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {ANOS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {preview.warnings.length > 0 && (
            <ul className="space-y-2 rounded-xl border border-nivel-ouro/30 bg-nivel-ouro/10 p-4 text-sm text-nivel-ouro">
              {preview.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}

          {preview.replacesExisting && (
            <p className="rounded-xl border border-coral/40 bg-coral/10 px-4 py-3 text-sm text-coral-300">
              Este mês já foi importado antes. Confirmar substitui os números atuais, inclusive correções feitas
              à mão.
            </p>
          )}

          <div className="overflow-x-auto rounded-xl border border-base-600">
            <table className="w-full min-w-[30rem] text-sm">
              <thead className="bg-base-700/60">
                <tr className="text-left">
                  <th className="px-4 py-2.5 font-semibold text-creme-500">Aba</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-creme-500">Faturamento</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-creme-500">Vendas</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-creme-500">Peças</th>
                </tr>
              </thead>
              <tbody>
                {preview.store && (
                  <tr className="border-t border-base-600/60 bg-coral/5">
                    <td className="px-4 py-2.5 font-semibold text-creme">Mari Boutique (loja)</td>
                    <td className="num px-4 py-2.5 text-right text-creme">{money(preview.store.revenue)}</td>
                    <td className="num px-4 py-2.5 text-right text-creme-300">{integer(preview.store.salesCount)}</td>
                    <td className="num px-4 py-2.5 text-right text-creme-300">{integer(preview.store.pieces)}</td>
                  </tr>
                )}
                {preview.sellers.map((seller) => (
                  <tr key={seller.sheetName} className="border-t border-base-600/60">
                    <td className="px-4 py-2.5 text-creme-300">{seller.sheetName}</td>
                    <td className="num px-4 py-2.5 text-right text-creme">{money(seller.revenue)}</td>
                    <td className="num px-4 py-2.5 text-right text-creme-300">{integer(seller.salesCount)}</td>
                    <td className="num px-4 py-2.5 text-right text-creme-300">{integer(seller.pieces)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.ignoredSheets.length > 0 && (
            <p className="text-xs text-creme-700">
              Abas de modelo ignoradas: {preview.ignoredSheets.join(", ")}.
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-primary" onClick={confirm} disabled={busy}>
              {busy ? "Salvando…" : "Confirmar e salvar"}
            </button>
            <button type="button" className="btn-secondary" onClick={discard} disabled={busy}>
              Descartar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
