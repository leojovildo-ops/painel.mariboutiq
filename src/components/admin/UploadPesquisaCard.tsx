"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { monthName } from "@/lib/format";
import { classificar } from "@/lib/nps";

interface Resultado {
  totalRespostas: number;
  ignoradas: number;
  vendedorasAtualizadas: number;
  mesesDaLoja: number;
  meses: Array<{ month: number; year: number; respostas: number; media: number }>;
  warnings: string[];
}

export function UploadPesquisaCard() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  async function escolher(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    setErro(null);
    setResultado(null);

    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/import/pesquisa", { method: "POST", body });
    const data = await res.json();

    if (!res.ok) {
      setErro(data.error ?? "Não foi possível ler o arquivo.");
      setBusy(false);
      return;
    }

    setResultado(data);
    setBusy(false);
    router.refresh();
  }

  return (
    <section className="card p-6">
      <h2 className="font-display text-xl font-bold text-creme">Importar pesquisa de satisfação</h2>
      <p className="mt-1 text-sm text-creme-500">
        O arquivo de respostas do formulário (.csv ou .xlsx). No Google Forms:{" "}
        <strong className="text-creme-300">Respostas → Baixar respostas (.csv)</strong>. O e-mail e o contato
        das clientes não são importados — só a nota, a data e a consultora.
      </p>

      <label className="btn-primary mt-5 cursor-pointer">
        <input type="file" accept=".csv,.xlsx,.xls" className="sr-only" onChange={escolher} disabled={busy} />
        {busy ? "Lendo respostas…" : "Escolher arquivo de respostas"}
      </label>

      {erro && (
        <p role="alert" className="mt-4 rounded-xl border border-coral/40 bg-coral/10 px-4 py-3 text-sm text-coral-300">
          {erro}
        </p>
      )}

      {resultado && (
        <div className="mt-5 space-y-4">
          <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {resultado.totalRespostas} respostas lidas · {resultado.vendedorasAtualizadas} nota(s) de vendedora e{" "}
            {resultado.mesesDaLoja} mês(es) da loja atualizados.
          </p>

          <div className="overflow-x-auto rounded-xl border border-base-600">
            <table className="w-full min-w-[24rem] text-sm">
              <thead className="bg-base-700/60 text-left">
                <tr>
                  <th className="px-4 py-2.5 font-semibold text-creme-500">Mês</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-creme-500">Respostas</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-creme-500">Nota da loja</th>
                </tr>
              </thead>
              <tbody>
                {resultado.meses.map((m) => {
                  const nota = classificar(m.media);
                  return (
                    <tr key={`${m.year}-${m.month}`} className="border-t border-base-600/60">
                      <td className="px-4 py-2.5 text-creme-300">
                        {monthName(m.month)} de {m.year}
                      </td>
                      <td className="num px-4 py-2.5 text-right text-creme-300">{m.respostas}</td>
                      <td className="num px-4 py-2.5 text-right font-semibold text-creme">
                        {m.media.toFixed(2).replace(".", ",")}
                        {nota && <span className="ml-2 text-xs font-normal text-creme-500">{nota.label}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {resultado.warnings.map((w) => (
            <p key={w} className="rounded-xl border border-nivel-ouro/30 bg-nivel-ouro/10 px-4 py-3 text-sm text-nivel-ouro">
              {w}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
