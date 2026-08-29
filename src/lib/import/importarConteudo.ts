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
  /** Mensagem para quem clicou; nada é gravado quando ela vem preenchida. */
  erro?: string;
  /** Corpo devolvido pela rota, no formato que cada tela já espera. */
  resposta?: Record<string, unknown>;
  /** Uma linha contando o que entrou, para o histórico do robô. */
  resumo?: string;
  /** Prévia criada mas ainda sem gravar: falta o mês ou o ano no arquivo. */
  pendente?: boolean;
}

/**
 * `confirmarSozinho` grava vendas e despesas sem passar pela tela de
 * conferência. É o que o robô diário usa; o clique manual continua parando na
 * prévia, que é onde os avisos de nome parecido e de substituição aparecem.
 */
export async function importarConteudo(
  buffer: Buffer,
  nomeArquivo: string,
  tipo: TipoImportavel,
  userId: string,
  { confirmarSozinho = false }: { confirmarSozinho?: boolean } = {}
): Promise<ResultadoDaImportacao> {
  if (tipo === "VENDAS") {
    const { erro, previa } = await criarPreviaDeVendas(buffer, nomeArquivo, userId);
    if (erro || !previa) return { erro };
    if (!confirmarSozinho) return { resposta: { tipo, previa } };

    // Sem mês e ano não dá para saber que período seria substituído, e chutar
    // apagaria os números de outro mês. Fica de prévia esperando um clique.
    if (!previa.year || !previa.month) {
      return {
        resposta: { tipo, previa },
        pendente: true,
        resumo: `${nomeArquivo}: não deu para descobrir o mês pelo arquivo; a prévia ficou aguardando confirmação na Administração.`
      };
    }

    const batch = await prisma.importBatch.findUnique({ where: { id: previa.batchId } });
    const resultado = await applyWorkbook(batch!.preview as unknown as ParsedWorkbook, previa.year, previa.month);
    await prisma.importBatch.update({
      where: { id: previa.batchId },
      data: { status: "CONFIRMED", confirmedAt: new Date(), periodId: resultado.periodId }
    });

    return {
      resposta: { tipo, previa },
      resumo: `${previa.month}/${previa.year}: ${previa.sellers.length} vendedora(s) gravada(s).`
    };
  }

  if (tipo === "DESPESAS") {
    const { erro, previa } = await criarPreviaDeDespesas(buffer, nomeArquivo, userId);
    if (erro || !previa) return { erro };
    if (!confirmarSozinho) return { resposta: { tipo, previa } };

    if (!previa.year) {
      return {
        resposta: { tipo, previa },
        pendente: true,
        resumo: `${nomeArquivo}: não deu para descobrir o ano pelo arquivo; a prévia ficou aguardando confirmação na Administração.`
      };
    }

    const batch = await prisma.importBatch.findUnique({ where: { id: previa.batchId } });
    await applyExpenses(batch!.preview as unknown as ParsedExpensesWorkbook, previa.year);
    await prisma.importBatch.update({
      where: { id: previa.batchId },
      data: { status: "CONFIRMED", confirmedAt: new Date() }
    });

    return {
      resposta: { tipo, previa },
      resumo: `Despesas de ${previa.year}: ${previa.meses.length} mês(es) gravado(s).`
    };
  }

  if (tipo === "ESTOQUE") {
    const parsed = parseStock(buffer);
    if (parsed.itens.length === 0) {
      return { erro: parsed.warnings.join(" ") || "Nenhum produto encontrado no arquivo." };
    }
    const resultado = await applyStock({
      itens: parsed.itens,
      // O arquivo só de produtos não traz vendas; nesse caso as vendas já
      // gravadas continuam valendo.
      vendas: parsed.vendas.length > 0 ? parsed.vendas : undefined,
      periodo: parsed.periodo,
      fileName: nomeArquivo
    });
    return {
      resposta: { tipo, estoque: { ...resultado, warnings: parsed.warnings } },
      resumo: `${parsed.itens.length} produto(s) no estoque.`
    };
  }

  if (tipo === "ESTOQUE_VENDAS") {
    const parsed = parseRelatorioVendas(buffer);
    if (parsed.vendas.length === 0) {
      return { erro: parsed.warnings.join(" ") || "Nenhum item de venda foi reconhecido." };
    }
    const resultado = await applyStock({
      vendas: parsed.vendas,
      periodo: parsed.periodo,
      fileName: nomeArquivo
    });
    return {
      resposta: {
        tipo,
        estoque: {
          ...resultado,
          pedidos: parsed.pedidos,
          devolucoes: parsed.devolucoes,
          warnings: parsed.warnings
        }
      },
      resumo: `${parsed.vendas.length} item(ns) vendido(s) em ${parsed.pedidos} pedido(s).`
    };
  }

  if (tipo === "HISTORICO") {
    const parsed = parseHistorico(buffer);
    if (parsed.meses.length === 0) {
      return { erro: parsed.warnings.join(" ") || "Nenhum ano encontrado no arquivo." };
    }
    const resultado = await applyHistorico(parsed);
    return {
      resposta: { tipo, historico: resultado },
      resumo: `${parsed.meses.length} mês(es) de histórico.`
    };
  }

  const parsed = parseSurvey(buffer, nomeArquivo);
  if (parsed.totalRespostas === 0) {
    return { erro: parsed.warnings.join(" ") || "Nenhuma resposta válida encontrada." };
  }
  const resultado = await applySurvey(parsed);
  return {
    resposta: {
      tipo,
      pesquisa: {
        totalRespostas: parsed.totalRespostas,
        vendedorasAtualizadas: resultado.vendedorasAtualizadas,
        mesesDaLoja: resultado.mesesDaLoja,
        warnings: [...parsed.warnings, ...resultado.avisos]
      }
    },
    resumo: `${parsed.totalRespostas} resposta(s) da pesquisa.`
  };
}
