"use client";

import { useState } from "react";
import { money, monthName } from "@/lib/format";

export interface PreviaDespesasDados {
  batchId: string;
  fileName: string;
  year: number | null;
  meses: Array<{
    month: number;
    sheetName: string;
    lancamentos: number;
    total: number;
    grossRevenue: number | null;
    isFuture: boolean;
  }>;
  ignoredSheets: string[];
  warnings: string[];
}

const ANOS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

/** Conferência da planilha de despesas, para o upload manual e para o Drive. */
export function PreviaDespesas({
  previa,
  onConcluido,
  onDescartado
}: {
  previa: PreviaDespesasDados;
  onConcluido: (mensagem: string) => void;
  onDescartado: () => void;
}) {
  const [ano, setAno] = useState(previa.year ?? new Date().getFullYear());
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const importaveis = previa.meses.filter((m) => !m.isFuture);

  async function confirmar() {
    setBusy(true);
    setErro(null);

    const res = await fetch(`/api/import/despesas/${previa.batchId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: ano })
    });
    const data = await res.json();

    if (!res.ok) {
      setErro(data.error ?? "Não foi possível salvar.");
      setBusy(false);
      return;
    }

    setBusy(false);
    onConcluido(
      `${data.lancamentos} lançamentos importados em ${data.mesesImportados.length} mês(es) de ${ano}.`
    );
  }

  return (
    <div className="mt-5 space-y-5">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <p className="label">Arquivo</p>
          <p className="mt-1 text-sm font-semibold text-creme">{previa.fileName}</p>
        </div>
        <div className="ml-auto">
          <label htmlFor={`ano-desp-${previa.batchId}`} className="label mb-1.5 block">
            Ano
          </label>
          <select
            id={`ano-desp-${previa.batchId}`}
            className="input"
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
          >
            {ANOS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      {previa.warnings.map((w) => (
        <p key={w} className="rounded-xl border border-nivel-ouro/30 bg-nivel-ouro/10 px-4 py-3 text-sm text-nivel-ouro">
          {w}
        </p>
      ))}

      <div className="overflow-x-auto rounded-xl border border-base-600">
        <table className="w-full min-w-[32rem] text-sm">
          <thead className="bg-base-700/60 text-left">
            <tr>
              <th className="px-4 py-2.5 font-semibold text-creme-500">Mês</th>
              <th className="px-4 py-2.5 text-right font-semibold text-creme-500">Lançamentos</th>
              <th className="px-4 py-2.5 text-right font-semibold text-creme-500">Despesas</th>
              <th className="px-4 py-2.5 text-right font-semibold text-creme-500">Faturamento</th>
            </tr>
          </thead>
          <tbody>
            {previa.meses.map((m) => (
              <tr key={m.month} className={`border-t border-base-600/60 ${m.isFuture ? "opacity-45" : ""}`}>
                <td className="px-4 py-2.5 text-creme-300">
                  {monthName(m.month)}
                  {m.isFuture && <span className="ml-2 text-xs text-nivel-ouro">previsão, não será importado</span>}
                </td>
                <td className="num px-4 py-2.5 text-right text-creme-300">{m.lancamentos}</td>
                <td className="num px-4 py-2.5 text-right text-creme">{money(m.total)}</td>
                <td className="num px-4 py-2.5 text-right text-creme-300">
                  {m.grossRevenue == null ? "—" : money(m.grossRevenue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {erro && <p className="text-sm text-coral-300">{erro}</p>}

      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn-primary" onClick={confirmar} disabled={busy}>
          {busy ? "Salvando…" : `Confirmar ${importaveis.length} mês(es)`}
        </button>
        <button type="button" className="btn-secondary" onClick={onDescartado} disabled={busy}>
          Descartar
        </button>
      </div>
    </div>
  );
}
