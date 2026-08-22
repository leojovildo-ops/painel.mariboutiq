import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiUser } from "@/lib/rbac";
import { forbidden, handleError, jsonError, unauthorized } from "@/lib/apiError";

/** Descarta uma prévia sem gravar nada nos painéis. */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await apiUser();
    if (!user) return unauthorized();
    if (user.role !== "ADMIN") return forbidden();

    const batch = await prisma.importBatch.findUnique({ where: { id: params.id } });
    if (!batch) return jsonError("Importação não encontrada.", 404);
    if (batch.status === "CONFIRMED") return jsonError("Esta importação já foi salva.", 409);

    await prisma.importBatch.update({ where: { id: batch.id }, data: { status: "DISCARDED" } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
