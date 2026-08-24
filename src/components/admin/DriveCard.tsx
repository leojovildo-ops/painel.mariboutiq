"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PreviaVendas, type PreviaVendasDados } from "./PreviaVendas";
import { PreviaDespesas, type PreviaDespesasDados } from "./PreviaDespesas";

type Tipo =
  | "VENDAS"
  | "DESPESAS"
  | "PESQUISA"
  | "ESTOQUE"
  | "ESTOQUE_VENDAS"
  | "HISTORICO"
  | "DESCONHECIDO";

interface Arquivo {
  id: string;
  name: string;
  modifiedTime: string;
  tipo: Tipo;
  nativa: boolean;
}

const TIPO_LABEL: Record<Tipo, string> = {
  VENDAS: "Vendas",
  DESPESAS: "Despesas",
  PESQUISA: "Pesquisa",
  ESTOQUE: "Estoque: produtos",
  ESTOQUE_VENDAS: "Estoque: vendas",
  HISTORICO: "Histórico anual",
  DESCONHECIDO: "Não identificado"
};

function quando(iso: string): string {
  const data = new Date(iso);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    .format(data)
    .replace(".", "");
}

/**
 * Leitura da pasta do Drive. O botão só traz o arquivo: vendas e despesas
 * param na mesma tela de conferência do upload manual, porque o Drive muda de
 * onde vem o arquivo, não o cuidado antes de gravar.
 */
export function DriveCard() {
  const router = useRouter();
  const [arquivos, setArquivos] = useState<Arquivo[] | null>(null);
  const [configurado, setConfigurado] = useState(true);
  const [carregando, setCarregando] = useState(false);
  const [trazendo, setTrazendo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [previaVendas, setPreviaVendas] = useState<PreviaVendasDados | null>(null);
  const [previaDespesas, setPreviaDespesas] = useState<PreviaDespesasDados | null>(null);

  async function atualizar() {
    setCarregando(true);
    setErro(null);
    setOk(null);

    const res = await fetch("/api/drive/arquivos");
    const data = await res.json();

    if (!res.ok) {
      setErro(data.error ?? "Não foi possível ler a pasta do Drive.");
      setCarregando(false);
      return;
    }

    setConfigurado(data.configurado);
    setArquivos(data.arquivos);
    setCarregando(false);
  }

  async function trazer(arquivo: Arquivo, tipo: Exclude<Tipo, "DESCONHECIDO">) {
    setTrazendo(arquivo.id);
    setErro(null);
    setOk(null);
    setPreviaVendas(null);
    setPreviaDespesas(null);

    const res = await fetch("/api/drive/importar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId: arquivo.id, nome: arquivo.name, nativa: arquivo.nativa, tipo })
    });
    const data = await res.json();

    if (!res.ok) {
      setErro(data.error ?? "Não foi possível trazer o arquivo.");
      setTrazendo(null);
      return;
    }

    if (data.tipo === "VENDAS") setPreviaVendas(data.previa);
    else if (data.tipo === "DESPESAS") setPreviaDespesas(data.previa);
    else if (data.tipo === "ESTOQUE" || data.tipo === "ESTOQUE_VENDAS") {
      const e = data.estoque;
      const detalhe = e.pedidos ? ` (${e.pedidos} pedidos, ${e.devolucoes} devoluções)` : "";
      setOk(`Estoque atualizado: ${e.itens} produtos e ${e.vendas} linhas de venda${detalhe}.`);
      router.refresh();
    } else if (data.tipo === "HISTORICO") {
      const h = data.historico;
      setOk(
        `Histórico de ${h.anos.join(", ")}: ${h.criados} mês(es) criados. ${h.preservados.length} mês(es) já tinham detalhe e foram preservados.`
      );
      router.refresh();
    } else {
      const p = data.pesquisa;
      setOk(
        `${p.totalRespostas} respostas lidas · ${p.vendedorasAtualizadas} nota(s) de vendedora e ${p.mesesDaLoja} mês(es) da loja atualizados.`
      );
      if (p.warnings.length > 0) setErro(p.warnings.join(" "));
      router.refresh();
    }

    setTrazendo(null);
  }

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-creme">Planilhas no Google Drive</h2>
          <p className="mt-1 text-sm text-creme-500">
            Lê a pasta da loja no Drive. Vendas e despesas passam pela mesma conferência do upload manual
            antes de valer.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={atualizar} disabled={carregando}>
          {carregando ? "Buscando…" : "Atualizar do Drive"}
        </button>
      </div>

      {!configurado && (
        <p className="mt-4 rounded-xl border border-nivel-ouro/30 bg-nivel-ouro/10 px-4 py-3 text-sm text-nivel-ouro">
          A conta de serviço do Google ainda não está configurada neste servidor.
        </p>
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

      {arquivos && arquivos.length === 0 && (
        <p className="mt-4 text-sm text-creme-700">Nenhuma planilha encontrada na pasta.</p>
      )}

      {arquivos && arquivos.length > 0 && !previaVendas && !previaDespesas && (
        <ul className="mt-5 overflow-hidden rounded-xl border border-base-600">
          {arquivos.map((arquivo) => (
            <li
              key={arquivo.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-base-600/60 p-3.5 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-creme">{arquivo.name}</p>
                <p className="label mt-0.5">
                  {TIPO_LABEL[arquivo.tipo]} · alterado {quando(arquivo.modifiedTime)}
                </p>
              </div>

              {arquivo.tipo === "DESCONHECIDO" ? (
                <div className="flex gap-2">
                  {(["VENDAS", "DESPESAS", "PESQUISA", "ESTOQUE", "ESTOQUE_VENDAS", "HISTORICO"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      className="btn-secondary px-3 py-1.5 text-xs"
                      disabled={trazendo === arquivo.id}
                      onClick={() => trazer(arquivo, t)}
                    >
                      {TIPO_LABEL[t]}
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={trazendo === arquivo.id}
                  onClick={() => trazer(arquivo, arquivo.tipo as Exclude<Tipo, "DESCONHECIDO">)}
                >
                  {trazendo === arquivo.id ? "Trazendo…" : "Trazer"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {previaVendas && (
        <PreviaVendas
          previa={previaVendas}
          onConcluido={(mensagem) => {
            setOk(mensagem);
            setPreviaVendas(null);
            router.refresh();
          }}
          onDescartado={() => setPreviaVendas(null)}
        />
      )}

      {previaDespesas && (
        <PreviaDespesas
          previa={previaDespesas}
          onConcluido={(mensagem) => {
            setOk(mensagem);
            setPreviaDespesas(null);
            router.refresh();
          }}
          onDescartado={() => setPreviaDespesas(null)}
        />
      )}
    </section>
  );
}
