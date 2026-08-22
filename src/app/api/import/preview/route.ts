import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiUser } from "@/lib/rbac";
import { forbidden, handleError, jsonError, unauthorized } from "@/lib/apiError";
import { parseMonthWorkbook } from "@/lib/xlsx/parseMonthWorkbook";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;

/** Lê a planilha e guarda a prévia; nada entra nos painéis antes da confirmação. */
export async function POST(request: Request) {
  try {
    const user = await apiUser();
    if (!user) return unauthorized();
    if (user.role !== "ADMIN") return forbidden();

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError("Selecione o arquivo .xlsx do mês.");
    if (!/\.xlsx?$/i.test(file.name)) return jsonError("O arquivo precisa ser uma planilha .xlsx.");
    if (file.size > MAX_BYTES) return jsonError("A planilha passa de 8 MB. Envie o arquivo original do mês.");

    const parsed = parseMonthWorkbook(Buffer.from(await file.arrayBuffer()), file.name);

    if (parsed.sellers.length === 0 && !parsed.store) {
      return jsonError(
        "Nenhuma aba com dados foi reconhecida nesta planilha. Confira se o arquivo é a planilha mensal de vendas."
      );
    }

    const existing =
      parsed.year && parsed.month
        ? await prisma.period.findUnique({
            where: { year_month: { year: parsed.year, month: parsed.month } },
            include: { _count: { select: { stats: true } } }
          })
        : null;

    const batch = await prisma.importBatch.create({
      data: {
        fileName: file.name,
        preview: parsed as unknown as object,
        sheetsFound: parsed.sellers.length + (parsed.store ? 1 : 0),
        sheetsIgnored: parsed.ignoredSheets,
        warnings: parsed.warnings,
        importedById: user.id
      }
    });

    return NextResponse.json({
      batchId: batch.id,
      fileName: file.name,
      year: parsed.year,
      month: parsed.month,
      store: parsed.store,
      sellers: parsed.sellers,
      ignoredSheets: parsed.ignoredSheets,
      warnings: parsed.warnings,
      /** Avisa que confirmar vai substituir o mês já importado. */
      replacesExisting: (existing?._count.stats ?? 0) > 0
    });
  } catch (error) {
    return handleError(error);
  }
}
