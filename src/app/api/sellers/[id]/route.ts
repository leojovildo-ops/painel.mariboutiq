import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiUser } from "@/lib/rbac";
import { forbidden, handleError, jsonError, unauthorized } from "@/lib/apiError";

const schema = z.object({
  /** Nome de exibição; o nome da aba da planilha (sheetName) nunca muda aqui. */
  name: z.string().min(2).optional(),
  active: z.boolean().optional(),
  /** Grafias alternativas usadas na pesquisa de satisfação. */
  aliases: z.array(z.string().min(2).max(40)).max(12).optional()
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await apiUser();
    if (!user) return unauthorized();
    if (user.role !== "ADMIN") return forbidden();

    const seller = await prisma.seller.findUnique({ where: { id: params.id } });
    if (!seller) return jsonError("Vendedora não encontrada.", 404);

    const body = schema.parse(await request.json());
    await prisma.seller.update({
      where: { id: seller.id },
      data: {
        name: body.name?.trim(),
        active: body.active,
        aliases: body.aliases?.map((a) => a.trim()).filter(Boolean)
      }
    });

    // Desativar a vendedora tira também o acesso do login dela ao painel.
    if (body.active === false) {
      await prisma.user.updateMany({ where: { sellerId: seller.id }, data: { active: false } });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
