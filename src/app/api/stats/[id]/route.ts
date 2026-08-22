import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiUser } from "@/lib/rbac";
import { forbidden, handleError, jsonError, unauthorized } from "@/lib/apiError";

/** Campo em branco na tela = "sem dado" (null), que é diferente de zero. */
const optionalNumber = z.union([z.number(), z.null()]);

const schema = z.object({
  revenue: z.number().min(0).optional(),
  salesCount: z.number().int().min(0).optional(),
  pieces: z.number().int().min(0).optional(),
  pa: optionalNumber.optional(),
  tkm: optionalNumber.optional(),
  salao: optionalNumber.optional(),
  online: optionalNumber.optional(),
  projection: optionalNumber.optional()
});

/** Correção manual de qualquer número já importado — só Administrador. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await apiUser();
    if (!user) return unauthorized();
    if (user.role !== "ADMIN") return forbidden();

    const stats = await prisma.monthlyStats.findUnique({ where: { id: params.id } });
    if (!stats) return jsonError("Registro não encontrado.", 404);

    const body = schema.parse(await request.json());

    const revenue = body.revenue ?? Number(stats.revenue);
    const salesCount = body.salesCount ?? stats.salesCount;
    const pieces = body.pieces ?? stats.pieces;

    // P.A. e TKM são derivados: se o Administrador corrigiu faturamento, vendas
    // ou peças sem informar os dois, eles são recalculados para não ficarem
    // contando uma história diferente da dos números corrigidos.
    const tkm = body.tkm !== undefined ? body.tkm : salesCount > 0 ? revenue / salesCount : null;
    const pa = body.pa !== undefined ? body.pa : salesCount > 0 ? pieces / salesCount : null;

    const updated = await prisma.monthlyStats.update({
      where: { id: stats.id },
      data: {
        revenue,
        salesCount,
        pieces,
        tkm,
        pa,
        salao: body.salao !== undefined ? body.salao : stats.salao,
        online: body.online !== undefined ? body.online : stats.online,
        projection: body.projection !== undefined ? body.projection : stats.projection,
        editedAt: new Date(),
        editedById: user.id
      }
    });

    return NextResponse.json({ id: updated.id });
  } catch (error) {
    return handleError(error);
  }
}
