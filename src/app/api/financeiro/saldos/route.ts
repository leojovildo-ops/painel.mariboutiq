import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiUser } from "@/lib/rbac";
import { forbidden, handleError, unauthorized } from "@/lib/apiError";

/** Campo em branco na tela vira null: "não encontrei o extrato", que é
 *  diferente de um saldo zerado de verdade. */
const valor = z.union([z.number(), z.null()]);

const schema = z.object({
  periodId: z.string(),
  saldos: z
    .array(z.object({ accountId: z.string(), opening: valor, closing: valor }))
    .max(30)
});

export async function POST(request: Request) {
  try {
    const user = await apiUser();
    if (!user) return unauthorized();
    if (!user.canViewFinance) return forbidden();

    const { periodId, saldos } = schema.parse(await request.json());

    for (const saldo of saldos) {
      await prisma.accountBalance.upsert({
        where: { accountId_periodId: { accountId: saldo.accountId, periodId } },
        update: { opening: saldo.opening, closing: saldo.closing },
        create: {
          accountId: saldo.accountId,
          periodId,
          opening: saldo.opening,
          closing: saldo.closing
        }
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
