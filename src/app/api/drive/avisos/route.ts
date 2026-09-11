import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiUser } from "@/lib/rbac";
import { forbidden, handleError, unauthorized } from "@/lib/apiError";
import { avisosDeImportacao } from "@/lib/data/avisosDeImportacao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await apiUser();
    if (!user) return unauthorized();
    if (user.role !== "ADMIN") return forbidden();

    return NextResponse.json({ avisos: await avisosDeImportacao() });
  } catch (error) {
    return handleError(error);
  }
}

const schema = z.object({ fileId: z.string().min(1).optional() });

/** Dá o aviso por visto. Sem fileId, marca todos de uma vez. */
export async function POST(request: Request) {
  try {
    const user = await apiUser();
    if (!user) return unauthorized();
    if (user.role !== "ADMIN") return forbidden();

    const { fileId } = schema.parse(await request.json().catch(() => ({})));

    await prisma.driveSync.updateMany({
      where: fileId ? { fileId } : { seenAt: null },
      data: { seenAt: new Date() }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
