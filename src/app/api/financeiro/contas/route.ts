import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiUser } from "@/lib/rbac";
import { forbidden, handleError, jsonError, unauthorized } from "@/lib/apiError";

const schema = z.object({
  name: z.string().min(2).max(40),
  kind: z.enum(["BANCO", "MAQUININHA", "ESPECIE"])
});

/** Cadastra uma conta nova (outro banco, outra maquininha). */
export async function POST(request: Request) {
  try {
    const user = await apiUser();
    if (!user) return unauthorized();
    if (!user.canViewFinance) return forbidden();

    const body = schema.parse(await request.json());
    const nome = body.name.trim();

    if (await prisma.account.findUnique({ where: { name: nome } })) {
      return jsonError("Já existe uma conta com esse nome.", 409);
    }

    const ultima = await prisma.account.findFirst({ orderBy: { sortOrder: "desc" } });
    const conta = await prisma.account.create({
      data: { name: nome, kind: body.kind, sortOrder: (ultima?.sortOrder ?? 0) + 1 }
    });

    return NextResponse.json({ id: conta.id }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
