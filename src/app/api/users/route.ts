import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiUser } from "@/lib/rbac";
import { forbidden, handleError, jsonError, unauthorized } from "@/lib/apiError";

const schema = z.object({
  name: z.string().min(2, "Informe o nome completo."),
  email: z.string().email("E-mail inválido."),
  password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres."),
  role: z.enum(["ADMIN", "SUPERVISORA", "VENDEDORA"]),
  /** Vendedora: aba da planilha à qual o login corresponde. */
  sellerId: z.string().nullable().optional()
});

export async function POST(request: Request) {
  try {
    const user = await apiUser();
    if (!user) return unauthorized();
    if (user.role !== "ADMIN") return forbidden();

    const body = schema.parse(await request.json());
    const email = body.email.toLowerCase().trim();

    if (await prisma.user.findUnique({ where: { email } })) {
      return jsonError("Já existe um login com este e-mail.", 409);
    }
    if (body.role === "VENDEDORA" && !body.sellerId) {
      return jsonError("Escolha a qual vendedora da planilha este login corresponde.");
    }

    const created = await prisma.user.create({
      data: {
        name: body.name.trim(),
        email,
        passwordHash: await bcrypt.hash(body.password, 10),
        role: body.role,
        sellerId: body.role === "VENDEDORA" ? body.sellerId! : null
      }
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
