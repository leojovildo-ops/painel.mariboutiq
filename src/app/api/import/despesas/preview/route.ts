import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiUser } from "@/lib/rbac";
import { forbidden, handleError, jsonError, unauthorized } from "@/lib/apiError";
import { parseExpensesWorkbook } from "@/lib/xlsx/parseExpensesWorkbook";

export const runtime = "nodejs";

const MAX_BYTES = 12 * 1024 * 1024;

/** Lê a planilha de despesas e guarda a prévia; nada entra antes da confirmação. */
export async function POST(request: Request) {
  try {
    const user = await apiUser();
    if (!user) return unauthorized();
    // A planilha financeira só pode ser vista por quem tem o direito, então
    // subir o arquivo também exige as duas coisas.
    if (user.role !== "ADMIN" || !user.canViewFinance) return forbidden();

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError("Selecione o arquivo .xlsx de despesas.");
    if (!/\.xlsx?$/i.test(file.name)) return jsonError("O arquivo precisa ser uma planilha .xlsx.");
    if (file.size > MAX_BYTES) return jsonError("A planilha passa de 12 MB.");

    const parsed = parseExpensesWorkbook(Buffer.from(await file.arrayBuffer()), file.name);
    const comDados = parsed.months.filter((m) => m.expenses.length > 0);
    if (comDados.length === 0) {
      return jsonError("Nenhum lançamento foi encontrado nas abas mensais desta planilha.");
    }

    const batch = await prisma.importBatch.create({
      data: {
        kind: "EXPENSES",
        fileName: file.name,
        preview: parsed as unknown as object,
        sheetsFound: comDados.length,
        sheetsIgnored: parsed.ignoredSheets,
        warnings: parsed.warnings,
        importedById: user.id
      }
    });

    return NextResponse.json({
      batchId: batch.id,
      fileName: file.name,
      year: parsed.year,
      meses: parsed.months
        .filter((m) => m.expenses.length > 0)
        .map((m) => ({
          month: m.month,
          sheetName: m.sheetName,
          lancamentos: m.expenses.length,
          total: m.total,
          grossRevenue: m.grossRevenue,
          isFuture: m.isFuture
        })),
      ignoredSheets: parsed.ignoredSheets,
      warnings: parsed.warnings
    });
  } catch (error) {
    return handleError(error);
  }
}
