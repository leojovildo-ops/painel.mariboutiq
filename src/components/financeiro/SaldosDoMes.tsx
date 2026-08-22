"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money, monthName } from "@/lib/format";
import type { Conta, MesDeSaldos } from "@/lib/data/saldos";

/** Campo vazio = extrato não encontrado (null). Zero é saldo zerado de verdade. */
function paraValor(texto: string): number | null {
  const limpo = texto.trim();
  if (limpo === "") return null;
  const n = Number(limpo.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function paraTexto(valor: number | null): string {
  return valor == null ? "" : String(valor);
}

export function SaldosDoMes({
  mes,
  contas,
  editavel = false
}: {
  mes: MesDeSaldos;
  contas: Conta[];
  /**
   * O lançamento fica só na Administração, junto dos uploads das planilhas.
   * A tela do Financeiro é de consulta e apresentação: sem botão de editar,
   * ninguém apaga um saldo sem querer no meio de uma reunião.
   */
  editavel?: boolean;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState(() =>
    Object.fromEntries(
      mes.saldos.map((s) => [s.accountId, { opening: paraTexto(s.opening), closing: paraTexto(s.closing) }])
    )
  );

  async function salvar() {
    setBusy(true);
    setErro(null);

    const res = await fetch("/api/financeiro/saldos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        periodId: mes.periodId,
        saldos: contas.map((c) => ({
          accountId: c.id,
          opening: paraValor(form[c.id]?.opening ?? ""),
          closing: paraValor(form[c.id]?.closing ?? "")
        }))
      })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErro(data.error ?? "Não foi possível salvar.");
      setBusy(false);
      return;
    }

    setBusy(false);
    setAberto(false);
    router.refresh();
  }

  const preenchidas = contas.length - mes.faltando.length;

  return (
    <li className="border-b border-base-600/50 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="min-w-[10rem]">
          <p className="font-display text-lg font-bold text-creme">{monthName(mes.month)}</p>
          <p className="label mt-0.5">
            {preenchidas} de {contas.length} contas
          </p>
        </div>

        <div className="flex flex-1 flex-wrap items-baseline gap-x-6 gap-y-1">
          <span className="num text-sm text-creme-500">
            iniciou com <strong className="font-semibold text-creme">{money(mes.totalInicio)}</strong>
          </span>
          <span className="num text-sm text-creme-500">
            terminou com <strong className="font-semibold text-creme">{money(mes.totalFim)}</strong>
          </span>
          {mes.variacao != null && (
            <span
              className={`num rounded-full border px-2.5 py-0.5 text-sm font-semibold ${
                mes.variacao >= 0
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-coral/45 bg-coral/10 text-coral-300"
              }`}
            >
              {mes.variacao >= 0 ? "+" : ""}
              {money(mes.variacao)}
            </span>
          )}
        </div>

        {editavel && (
          <button type="button" className="btn-secondary" onClick={() => setAberto(!aberto)}>
            {aberto ? "Fechar" : "Lançar saldos"}
          </button>
        )}
      </div>

      {/* O início de um mês deveria ser o fim do anterior; quando não é, o
          painel mostra os dois números em vez de escolher um. */}
      {mes.divergencias.length > 0 && (
        <div className="mx-4 mb-4 rounded-xl border border-nivel-ouro/30 bg-nivel-ouro/10 px-4 py-3 text-sm text-nivel-ouro">
          {mes.divergencias.map((d) => (
            <p key={d.accountId}>
              {d.nome}: {monthName(mes.month)} começa com {money(d.informado)}, mas o mês anterior terminou
              com {money(d.anterior)} — diferença de {money(Math.abs(d.informado - d.anterior))}.
            </p>
          ))}
        </div>
      )}

      {(!aberto || !editavel) && preenchidas > 0 && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 px-4 pb-4 text-xs text-creme-700">
          {contas.map((c) => {
            const s = mes.saldos.find((x) => x.accountId === c.id);
            if (!s || (s.opening == null && s.closing == null)) return null;
            return (
              <span key={c.id} className="num">
                {c.name}: {money(s.opening)} → <span className="text-creme-500">{money(s.closing)}</span>
              </span>
            );
          })}
        </div>
      )}

      {aberto && editavel && (
        <div className="border-t border-base-600/60 bg-base-700/30 p-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[26rem] text-sm">
              <thead>
                <tr className="text-left">
                  <th className="pb-2 font-semibold text-creme-500">Conta</th>
                  <th className="pb-2 font-semibold text-creme-500">Iniciou com</th>
                  <th className="pb-2 font-semibold text-creme-500">Terminou com</th>
                </tr>
              </thead>
              <tbody>
                {contas.map((c) => (
                  <tr key={c.id}>
                    <td className="py-1.5 pr-4 text-creme-300">{c.name}</td>
                    <td className="py-1.5 pr-3">
                      <input
                        className="input num"
                        inputMode="decimal"
                        placeholder="—"
                        value={form[c.id]?.opening ?? ""}
                        onChange={(e) =>
                          setForm({ ...form, [c.id]: { ...form[c.id], opening: e.target.value } })
                        }
                      />
                    </td>
                    <td className="py-1.5">
                      <input
                        className="input num"
                        inputMode="decimal"
                        placeholder="—"
                        value={form[c.id]?.closing ?? ""}
                        onChange={(e) =>
                          setForm({ ...form, [c.id]: { ...form[c.id], closing: e.target.value } })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-creme-700">
            Deixe em branco a conta cujo extrato você não encontrou — em branco é &ldquo;sem dado&rdquo;, e
            não zero.
          </p>

          {erro && <p className="mt-3 text-sm text-coral-300">{erro}</p>}

          <div className="mt-4 flex gap-3">
            <button type="button" className="btn-primary" onClick={salvar} disabled={busy}>
              {busy ? "Salvando…" : "Salvar saldos"}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setAberto(false)} disabled={busy}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
