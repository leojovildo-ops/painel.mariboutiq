"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money, decimal, integer } from "@/lib/format";

export interface EditableRow {
  id: string;
  label: string;
  scope: "STORE" | "SELLER";
  revenue: number;
  salesCount: number;
  pieces: number;
  pa: number | null;
  tkm: number | null;
  projection: number | null;
  note: string | null;
  editedAt: string | null;
}

/** Campo vazio = "sem dado" (null); zero é um valor de verdade e é mantido. */
function toValue(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function Field({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="label mb-1 block">{label}</span>
      <input className="input num" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function RowEditor({ row, onDone }: { row: EditableRow; onDone: () => void }) {
  const [form, setForm] = useState({
    revenue: String(row.revenue),
    salesCount: String(row.salesCount),
    pieces: String(row.pieces),
    pa: row.pa == null ? "" : String(row.pa),
    tkm: row.tkm == null ? "" : String(row.tkm),
    projection: row.projection == null ? "" : String(row.projection),
    note: row.note ?? ""
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);

    const response = await fetch(`/api/stats/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        revenue: toValue(form.revenue) ?? 0,
        salesCount: Math.round(toValue(form.salesCount) ?? 0),
        pieces: Math.round(toValue(form.pieces) ?? 0),
        pa: toValue(form.pa),
        tkm: toValue(form.tkm),
        projection: toValue(form.projection),
        note: form.note
      })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Não foi possível salvar.");
      setBusy(false);
      return;
    }

    setBusy(false);
    onDone();
  }

  return (
    <div className="border-t border-base-600/60 bg-base-700/30 p-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Faturamento" value={form.revenue} onChange={(v) => setForm({ ...form, revenue: v })} />
        <Field label="Vendas" value={form.salesCount} onChange={(v) => setForm({ ...form, salesCount: v })} />
        <Field label="Peças" value={form.pieces} onChange={(v) => setForm({ ...form, pieces: v })} />
        <Field label="P.A. (vazio = recalcular)" value={form.pa} onChange={(v) => setForm({ ...form, pa: v })} />
        <Field label="TKM (vazio = recalcular)" value={form.tkm} onChange={(v) => setForm({ ...form, tkm: v })} />
        {row.scope === "STORE" && (
          <Field label="Projeção" value={form.projection} onChange={(v) => setForm({ ...form, projection: v })} />
        )}
      </div>

      <label className="mt-4 block">
        <span className="label mb-1 block">Observação do mês</span>
        <textarea
          className="input min-h-[4.5rem] resize-y"
          maxLength={500}
          placeholder="Ex.: mês soma o período de experiência com o de carteira assinada."
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
        />
        <span className="mt-1 block text-xs text-creme-700">
          Aparece no ranking e na tela de níveis, junto do nome.
        </span>
      </label>

      {error && <p className="mt-3 text-sm text-coral-300">{error}</p>}

      <div className="mt-4 flex gap-3">
        <button type="button" className="btn-primary" onClick={save} disabled={busy}>
          {busy ? "Salvando…" : "Salvar correção"}
        </button>
        <button type="button" className="btn-secondary" onClick={onDone} disabled={busy}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

export function EditStatsCard({ rows }: { rows: EditableRow[] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);

  if (rows.length === 0) {
    return <div className="card p-6 text-sm text-creme-500">Nenhum dado neste mês.</div>;
  }

  return (
    <div className="card overflow-hidden">
      <ul>
        {rows.map((row) => (
          <li key={row.id} className="border-b border-base-600/50 last:border-b-0">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-semibold text-creme">{row.label}</p>
                <p className="num mt-0.5 text-sm text-creme-500">
                  {money(row.revenue)} · {integer(row.salesCount)} vendas · {integer(row.pieces)} peças · P.A.{" "}
                  {decimal(row.pa)} · TKM {money(row.tkm)}
                </p>
                {row.note && <p className="mt-1 text-xs text-creme-500">{row.note}</p>}
                {row.editedAt && (
                  <p className="mt-0.5 text-xs text-creme-700">Corrigido manualmente</p>
                )}
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setOpenId(openId === row.id ? null : row.id)}
              >
                {openId === row.id ? "Fechar" : "Editar"}
              </button>
            </div>

            {openId === row.id && (
              <RowEditor
                row={row}
                onDone={() => {
                  setOpenId(null);
                  router.refresh();
                }}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
