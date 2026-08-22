import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiUser } from "@/lib/rbac";
import { forbidden, handleError, jsonError, unauthorized } from "@/lib/apiError";

const schema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(["ADMIN", "SUPERVISORA", "VENDEDORA"]).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres.").optional(),
  sellerId: z.string().nullable().optional()
});

/** Editar, redefinir senha ou desativar um login. Logins nunca são apagados,
 *  para não perder o histórico de quem importou cada planilha. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await apiUser();
    if (!admin) return unauthorized();
    if (admin.role !== "ADMIN") return forbidden();

    const target = await prisma.user.findUnique({ where: { id: params.id } });
    if (!target) return jsonError("Usuário não encontrado.", 404);

    const body = schema.parse(await request.json());

    if (body.active === false && target.id === admin.id) {
      return jsonError("Você não pode desativar o seu próprio acesso.");
    }
    if (body.active === false && target.role === "ADMIN") {
      const activeAdmins = await prisma.user.count({ where: { role: "ADMIN", active: true } });
      if (activeAdmins <= 1) return jsonError("A loja precisa de pelo menos um Administrador ativo.");
    }

    const role = body.role ?? target.role;

    await prisma.user.update({
      where: { id: target.id },
      data: {
        name: body.name?.trim(),
        role: body.role,
        active: body.active,
        passwordHash: body.password ? await bcrypt.hash(body.password, 10) : undefined,
        sellerId: role === "VENDEDORA" ? (body.sellerId ?? target.sellerId) : null
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
