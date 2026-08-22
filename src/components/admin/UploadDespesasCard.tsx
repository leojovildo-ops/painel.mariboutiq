"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money, monthName } from "@/lib/format";

interface MesPrevia {
  month: number;
  sheetName: string;
  lancamentos: number;
  total: number;
  grossRevenue: number | null;
  isFuture: boolean;
}

interface Previa {
  batchId: string;
  fileName: string;
  year: number | null;
  meses: MesPrevia[];
  ignoredSheets: string[];
  warnings: string[];
}

const ANOS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

/** Upload da planilha de despesas do ano, com conferência antes de gravar. */
export function UploadDespesasCard() {
  const router = useRouter();
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [ano, setAno] = useState(new Date().getFullYear());
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
    if (data.year) setAno(data.year);
    setBusy(false);
  }

  async function confirmar() {
    if (!previa) return;
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

    setOk(`${data.lancamentos} lançamentos importados em ${data.mesesImportados.length} mês(es) de ${ano}.`);
    setPrevia(null);
    setBusy(false);
    router.refresh();
  }

  const importaveis = previa?.meses.filter((m) => !m.isFuture) ?? [];

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
        <div className="mt-5 space-y-5">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <p className="label">Arquivo</p>
              <p className="mt-1 text-sm font-semibold text-creme">{previa.fileName}</p>
            </div>
            <div className="ml-auto">
              <label htmlFor="ano-despesas" className="label mb-1.5 block">
                Ano
              </label>
              <select
                id="ano-despesas"
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

          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-primary" onClick={confirmar} disabled={busy}>
              {busy ? "Salvando…" : `Confirmar ${importaveis.length} mês(es)`}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setPrevia(null)} disabled={busy}>
              Descartar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
