import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiUser } from "@/lib/rbac";
import { forbidden, handleError, jsonError, unauthorized } from "@/lib/apiError";
import { applyExpenses } from "@/lib/import/applyExpenses";
import type { ParsedExpensesWorkbook } from "@/lib/xlsx/parseExpensesWorkbook";

export const runtime = "nodejs";

const schema = z.object({ year: z.number().int().min(2000).max(2100) });

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await apiUser();
    if (!user) return unauthorized();
    if (user.role !== "ADMIN" || !user.canViewFinance) return forbidden();

    const batch = await prisma.importBatch.findUnique({ where: { id: params.id } });
    if (!batch) return jsonError("Importação não encontrada.", 404);
    if (batch.kind !== "EXPENSES") return jsonError("Esta importação não é de despesas.", 409);
    if (batch.status !== "PENDING") return jsonError("Esta importação já foi concluída ou descartada.", 409);

    const { year } = schema.parse(await request.json());
    const parsed = batch.preview as unknown as ParsedExpensesWorkbook;
    const result = await applyExpenses(parsed, year);

    await prisma.importBatch.update({
      where: { id: batch.id },
      data: { status: "CONFIRMED", confirmedAt: new Date() }
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}
