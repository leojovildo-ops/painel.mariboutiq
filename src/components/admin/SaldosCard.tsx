"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Conta, MesDeSaldos } from "@/lib/data/saldos";
import { SaldosDoMes } from "@/components/financeiro/SaldosDoMes";

const TIPOS = [
  { value: "BANCO", label: "Banco" },
  { value: "MAQUININHA", label: "Maquininha" },
  { value: "ESPECIE", label: "Espécie" }
] as const;

/** Lançamento dos saldos das contas, mês a mês, a partir dos extratos. */
export function SaldosCard({ meses, contas }: { meses: MesDeSaldos[]; contas: Conta[] }) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]["value"]>("BANCO");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criarConta(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErro(null);

    const res = await fetch("/api/financeiro/contas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nome, kind: tipo })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErro(data.error ?? "Não foi possível criar a conta.");
      setBusy(false);
      return;
    }

    setNome("");
    setBusy(false);
    router.refresh();
  }

  return (
    <section className="card p-6">
      <h2 className="font-display text-xl font-bold text-creme">Saldos das contas</h2>
      <p className="mt-1 text-sm text-creme-500">
        Quanto cada conta tinha no começo e no fim de cada mês, a partir dos extratos. Conta sem extrato
        fica em branco — em branco é &ldquo;sem dado&rdquo;, e não zero.
      </p>

      <form onSubmit={criarConta} className="mt-5 flex flex-wrap items-end gap-3">
        <label className="min-w-[12rem] flex-1">
          <span className="label mb-1 block">Nova conta</span>
          <input
            className="input"
            placeholder="Nome do banco ou da maquininha"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            minLength={2}
            required
          />
        </label>
        <label>
          <span className="label mb-1 block">Tipo</span>
          <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-secondary" disabled={busy}>
          Adicionar
        </button>
      </form>

      {erro && <p className="mt-3 text-sm text-coral-300">{erro}</p>}

      <ul className="mt-6 overflow-hidden rounded-xl border border-base-600">
        {meses.map((mes) => (
          <SaldosDoMes key={mes.periodId} mes={mes} contas={contas} editavel />
        ))}
      </ul>

      {meses.length === 0 && (
        <p className="mt-6 text-sm text-creme-700">
          Nenhum mês registrado ainda. Coloque uma planilha de vendas ou de despesas na pasta do Drive primeiro.
        </p>
      )}
    </section>
  );
}
