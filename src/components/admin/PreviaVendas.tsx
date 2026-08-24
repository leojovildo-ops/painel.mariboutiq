"use client";

import { useState } from "react";
import { money, monthName, integer } from "@/lib/format";

interface AbaPrevia {
  sheetName: string;
  revenue: number;
  salesCount: number;
  pieces: number;
}

export interface PreviaVendasDados {
  batchId: string;
  fileName: string;
  year: number | null;
  month: number | null;
  store: AbaPrevia | null;
  sellers: AbaPrevia[];
  ignoredSheets: string[];
  warnings: string[];
  replacesExisting: boolean;
}

const ANOS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i);

/**
 * Tela de conferência da planilha de vendas, usada tanto pelo upload manual
 * quanto pela leitura do Drive: as duas portas de entrada mostram os mesmos
 * avisos antes de gravar.
 */
export function PreviaVendas({
  previa,
  onConcluido,
  onDescartado
}: {
  previa: PreviaVendasDados;
  onConcluido: (mensagem: string) => void;
  onDescartado: () => void;
}) {
  const [year, setYear] = useState(previa.year ?? new Date().getFullYear());
  const [month, setMonth] = useState(previa.month ?? new Date().getMonth() + 1);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    setBusy(true);
    setErro(null);

    const res = await fetch(`/api/import/${previa.batchId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, month })
    });
    const data = await res.json();

    if (!res.ok) {
      setErro(data.error ?? "Não foi possível salvar a importação.");
      setBusy(false);
      return;
    }

    setBusy(false);
    onConcluido(`${monthName(month)} de ${year} importado: ${data.sellersSaved} vendedora(s).`);
  }

  async function descartar() {
    await fetch(`/api/import/${previa.batchId}`, { method: "DELETE" });
    onDescartado();
  }

  return (
    <div className="mt-5 space-y-5">
      <div className="rounded-xl border border-base-600 bg-base-700/40 p-4">
        <p className="label">Arquivo</p>
        <p className="mt-1 text-sm font-semibold text-creme">{previa.fileName}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`mes-${previa.batchId}`} className="label mb-1.5 block">
            Mês
          </label>
          <select
            id={`mes-${previa.batchId}`}
            className="input"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {monthName(m)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`ano-${previa.batchId}`} className="label mb-1.5 block">
            Ano
          </label>
          <select
            id={`ano-${previa.batchId}`}
            className="input"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {ANOS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      {previa.warnings.length > 0 && (
        <ul className="space-y-2 rounded-xl border border-nivel-ouro/30 bg-nivel-ouro/10 p-4 text-sm text-nivel-ouro">
          {previa.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      {previa.replacesExisting && (
        <p className="rounded-xl border border-coral/40 bg-coral/10 px-4 py-3 text-sm text-coral-300">
          Este mês já foi importado antes. Confirmar substitui os números atuais, inclusive correções
          feitas à mão.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-base-600">
        <table className="w-full min-w-[30rem] text-sm">
          <thead className="bg-base-700/60 text-left">
            <tr>
              <th className="px-4 py-2.5 font-semibold text-creme-500">Aba</th>
              <th className="px-4 py-2.5 text-right font-semibold text-creme-500">Faturamento</th>
              <th className="px-4 py-2.5 text-right font-semibold text-creme-500">Vendas</th>
              <th className="px-4 py-2.5 text-right font-semibold text-creme-500">Peças</th>
            </tr>
          </thead>
          <tbody>
            {previa.store && (
              <tr className="border-t border-base-600/60 bg-coral/5">
                <td className="px-4 py-2.5 font-semibold text-creme">Mari Boutique (loja)</td>
                <td className="num px-4 py-2.5 text-right text-creme">{money(previa.store.revenue)}</td>
                <td className="num px-4 py-2.5 text-right text-creme-300">
                  {integer(previa.store.salesCount)}
                </td>
                <td className="num px-4 py-2.5 text-right text-creme-300">{integer(previa.store.pieces)}</td>
              </tr>
            )}
            {previa.sellers.map((s) => (
              <tr key={s.sheetName} className="border-t border-base-600/60">
                <td className="px-4 py-2.5 text-creme-300">{s.sheetName}</td>
                <td className="num px-4 py-2.5 text-right text-creme">{money(s.revenue)}</td>
                <td className="num px-4 py-2.5 text-right text-creme-300">{integer(s.salesCount)}</td>
                <td className="num px-4 py-2.5 text-right text-creme-300">{integer(s.pieces)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {previa.ignoredSheets.length > 0 && (
        <p className="text-xs text-creme-700">Abas de modelo ignoradas: {previa.ignoredSheets.join(", ")}.</p>
      )}

      {erro && <p className="text-sm text-coral-300">{erro}</p>}

      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn-primary" onClick={confirmar} disabled={busy}>
          {busy ? "Salvando…" : "Confirmar e salvar"}
        </button>
        <button type="button" className="btn-secondary" onClick={descartar} disabled={busy}>
          Descartar
        </button>
      </div>
    </div>
  );
}
