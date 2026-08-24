/**
 * Montagem das prévias de importação, compartilhada entre o upload manual e a
 * leitura do Google Drive. As duas portas de entrada precisam produzir
 * exatamente a mesma tela de conferência — se divergirem, um caminho vai
 * acabar gravando sem os avisos do outro.
 */
import { prisma } from "@/lib/prisma";
import { money } from "@/lib/format";
import { parseMonthWorkbook } from "@/lib/xlsx/parseMonthWorkbook";
import { parseExpensesWorkbook } from "@/lib/xlsx/parseExpensesWorkbook";
import { avisosDeNomesParecidos } from "@/lib/import/nomesParecidos";

export async function criarPreviaDeVendas(buffer: Buffer, fileName: string, userId: string) {
  const parsed = parseMonthWorkbook(buffer, fileName);

  if (parsed.sellers.length === 0 && !parsed.store) {
    return {
      erro:
        "Nenhuma aba com dados foi reconhecida nesta planilha. Confira se o arquivo é a planilha mensal de vendas."
    };
  }

  // Abas da mesma pessoa (experiência + carteira assinada) serão somadas.
  const porPessoa = new Map<string, typeof parsed.sellers>();
  for (const s of parsed.sellers) {
    const lista = porPessoa.get(s.sellerName) ?? [];
    lista.push(s);
    porPessoa.set(s.sellerName, lista);
  }

  const avisosDeSoma = Array.from(porPessoa.entries())
    .filter(([, abas]) => abas.length > 1)
    .map(([nome, abas]) => {
      const total = abas.reduce((acc, a) => acc + a.revenue, 0);
      const detalhe = abas.map((a) => `${a.sheetName} (${money(a.revenue)})`).join(" + ");
      return `${nome} tem ${abas.length} abas nesta planilha e elas serão somadas num mês só: ${detalhe} = ${money(total)}. A observação do mês vai registrar isso.`;
    });

  const vendedoras = await prisma.seller.findMany({ select: { sheetName: true } });
  const warnings = [
    ...parsed.warnings,
    ...avisosDeSoma,
    ...avisosDeNomesParecidos(
      Array.from(porPessoa.keys()),
      vendedoras.map((v) => v.sheetName)
    )
  ];

  const existente =
    parsed.year && parsed.month
      ? await prisma.period.findUnique({
          where: { year_month: { year: parsed.year, month: parsed.month } },
          include: { _count: { select: { stats: true } } }
        })
      : null;

  const batch = await prisma.importBatch.create({
    data: {
      kind: "SALES",
      fileName,
      preview: parsed as unknown as object,
      sheetsFound: parsed.sellers.length + (parsed.store ? 1 : 0),
      sheetsIgnored: parsed.ignoredSheets,
      warnings,
      importedById: userId
    }
  });

  return {
    previa: {
      batchId: batch.id,
      fileName,
      year: parsed.year,
      month: parsed.month,
      store: parsed.store,
      sellers: parsed.sellers,
      ignoredSheets: parsed.ignoredSheets,
      warnings,
      replacesExisting: (existente?._count.stats ?? 0) > 0
    }
  };
}

export async function criarPreviaDeDespesas(buffer: Buffer, fileName: string, userId: string) {
  const parsed = parseExpensesWorkbook(buffer, fileName);
  const comDados = parsed.months.filter((m) => m.expenses.length > 0);

  if (comDados.length === 0) {
    return { erro: "Nenhum lançamento foi encontrado nas abas mensais desta planilha." };
  }

  const batch = await prisma.importBatch.create({
    data: {
      kind: "EXPENSES",
      fileName,
      preview: parsed as unknown as object,
      sheetsFound: comDados.length,
      sheetsIgnored: parsed.ignoredSheets,
      warnings: parsed.warnings,
      importedById: userId
    }
  });

  return {
    previa: {
      batchId: batch.id,
      fileName,
      year: parsed.year,
      meses: comDados.map((m) => ({
        month: m.month,
        sheetName: m.sheetName,
        lancamentos: m.expenses.length,
        total: m.total,
        grossRevenue: m.grossRevenue,
        isFuture: m.isFuture
      })),
      ignoredSheets: parsed.ignoredSheets,
      warnings: parsed.warnings
    }
  };
}
