/**
 * Uma planilha vinda do Drive, lida e gravada.
 *
 * Fica separado da rota porque agora existem duas portas: o clique do
 * Administrador em Administração > Google Drive e o robô diário. As duas
 * precisam tratar cada tipo de arquivo do mesmo jeito — se divergirem, um
 * caminho vai acabar gravando sem os cuidados do outro.
 */
import { prisma } from "@/lib/prisma";
import type { TipoDeArquivo } from "@/lib/google/drive";
import { criarPreviaDeDespesas, criarPreviaDeVendas } from "@/lib/import/previas";
import { applyWorkbook } from "@/lib/import/applyWorkbook";
import { applyExpenses } from "@/lib/import/applyExpenses";
import { parseSurvey } from "@/lib/xlsx/parseSurvey";
import { applySurvey } from "@/lib/import/applySurvey";
import { parseStock } from "@/lib/xlsx/parseStock";
import { applyStock } from "@/lib/import/applyStock";
import { parseRelatorioVendas } from "@/lib/xlsx/parseRelatorioVendas";
import { parseHistorico } from "@/lib/xlsx/parseHistorico";
import { applyHistorico } from "@/lib/import/applyHistorico";
import type { ParsedWorkbook } from "@/lib/xlsx/parseMonthWorkbook";
import type { ParsedExpensesWorkbook } from "@/lib/xlsx/parseExpensesWorkbook";

export type TipoImportavel = Exclude<TipoDeArquivo, "DESCONHECIDO">;

export interface ResultadoDaImportacao {
  /** Mensagem do que impediu a gravação; quando vem preenchida, nada entrou. */
  erro?: string;
  /** Uma linha contando o que entrou. */
  resumo?: string;
  /**
   * Ressalvas da leitura: nome parecido com o de outra vendedora, aba
   * ignorada, mês no futuro. Não impedem a gravação, mas viram notificação
   * na Administração — é assim que um erro na planilha chega a quem pode
   * corrigir, já que ninguém mais confere antes de gravar.
   */
  avisos: string[];
}

/**
 * Lê e grava, sem tela de conferência no meio: planilha alterada no Drive
 * entra direto no painel. O que antes era conferido a olho agora sai como
 * aviso — ver `avisos`.
 */
export async function importarConteudo(
  buffer: Buffer,
  nomeArquivo: string,
  tipo: TipoImportavel,
  userId: string
): Promise<ResultadoDaImportacao> {
  if (tipo === "VENDAS") {
    const { erro, previa } = await criarPreviaDeVendas(buffer, nomeArquivo, userId);
    if (erro || !previa) return { erro, avisos: [] };

    // Sem mês e ano não dá para saber que período seria substituído, e chutar
    // apagaria os números de outro mês. Aqui vira erro: é o tipo de coisa que
    // se resolve renomeando a planilha no Drive.
    if (!previa.year || !previa.month) {
      await prisma.importBatch.update({
        where: { id: previa.batchId },
        data: { status: "DISCARDED" }
      });
      return {
        erro: "Não deu para descobrir o mês e o ano pelo arquivo. Renomeie a planilha no Drive (ex.: \"JULHO 2026\") e ela entra na próxima leitura.",
        avisos: previa.warnings
      };
    }

    const batch = await prisma.importBatch.findUnique({ where: { id: previa.batchId } });
    const resultado = await applyWorkbook(batch!.preview as unknown as ParsedWorkbook, previa.year, previa.month);
    await prisma.importBatch.update({
      where: { id: previa.batchId },
      data: { status: "CONFIRMED", confirmedAt: new Date(), periodId: resultado.periodId }
    });

    return {
      resumo: `${previa.month}/${previa.year}: ${previa.sellers.length} vendedora(s) gravada(s).`,
      avisos: previa.warnings
    };
  }

  if (tipo === "DESPESAS") {
    const { erro, previa } = await criarPreviaDeDespesas(buffer, nomeArquivo, userId);
    if (erro || !previa) return { erro, avisos: [] };

    if (!previa.year) {
      await prisma.importBatch.update({
        where: { id: previa.batchId },
        data: { status: "DISCARDED" }
      });
      return {
        erro: "Não deu para descobrir o ano pelo arquivo. Renomeie a planilha no Drive (ex.: \"DESPESAS 2026\") e ela entra na próxima leitura.",
        avisos: previa.warnings
      };
    }

    const batch = await prisma.importBatch.findUnique({ where: { id: previa.batchId } });
    await applyExpenses(batch!.preview as unknown as ParsedExpensesWorkbook, previa.year);
    await prisma.importBatch.update({
      where: { id: previa.batchId },
      data: { status: "CONFIRMED", confirmedAt: new Date() }
    });

    return {
      resumo: `Despesas de ${previa.year}: ${previa.meses.length} mês(es) gravado(s).`,
      avisos: previa.warnings
    };
  }

  if (tipo === "ESTOQUE") {
    const parsed = parseStock(buffer);
    if (parsed.itens.length === 0) {
      return { erro: parsed.warnings.join(" ") || "Nenhum produto encontrado no arquivo.", avisos: [] };
    }
    await applyStock({
      itens: parsed.itens,
      // O arquivo só de produtos não traz vendas; nesse caso as vendas já
      // gravadas continuam valendo.
      vendas: parsed.vendas.length > 0 ? parsed.vendas : undefined,
      periodo: parsed.periodo,
      fileName: nomeArquivo
    });
    return { resumo: `${parsed.itens.length} produto(s) no estoque.`, avisos: parsed.warnings };
  }

  if (tipo === "ESTOQUE_VENDAS") {
    const parsed = parseRelatorioVendas(buffer);
    if (parsed.vendas.length === 0) {
      return { erro: parsed.warnings.join(" ") || "Nenhum item de venda foi reconhecido.", avisos: [] };
    }
    await applyStock({ vendas: parsed.vendas, periodo: parsed.periodo, fileName: nomeArquivo });
    return {
      resumo: `${parsed.vendas.length} item(ns) vendido(s) em ${parsed.pedidos} pedido(s), ${parsed.devolucoes} devolução(ões).`,
      avisos: parsed.warnings
    };
  }

  if (tipo === "HISTORICO") {
    const parsed = parseHistorico(buffer);
    if (parsed.meses.length === 0) {
      return { erro: parsed.warnings.join(" ") || "Nenhum ano encontrado no arquivo.", avisos: [] };
    }
    const resultado = await applyHistorico(parsed);
    return {
      resumo: `${resultado.anos.join(", ")}: ${resultado.criados} mês(es) de histórico criados.`,
      avisos: parsed.warnings
    };
  }

  const parsed = parseSurvey(buffer, nomeArquivo);
  if (parsed.totalRespostas === 0) {
    return { erro: parsed.warnings.join(" ") || "Nenhuma resposta válida encontrada.", avisos: [] };
  }
  const resultado = await applySurvey(parsed);
  return {
    resumo: `${parsed.totalRespostas} resposta(s): ${resultado.vendedorasAtualizadas} nota(s) de vendedora e ${resultado.mesesDaLoja} mês(es) da loja.`,
    avisos: [...parsed.warnings, ...resultado.avisos]
  };
}
