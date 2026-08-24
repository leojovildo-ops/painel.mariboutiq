import { NextResponse } from "next/server";
import { apiUser } from "@/lib/rbac";
import { forbidden, handleError, unauthorized } from "@/lib/apiError";
import { listarArquivos } from "@/lib/google/drive";
import { contaDeServicoConfigurada } from "@/lib/google/serviceAccount";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** O que existe hoje na pasta do Drive da loja. */
export async function GET() {
  try {
    const user = await apiUser();
    if (!user) return unauthorized();
    if (user.role !== "ADMIN") return forbidden();

    if (!contaDeServicoConfigurada()) {
      return NextResponse.json({ configurado: false, arquivos: [] });
    }

    return NextResponse.json({ configurado: true, arquivos: await listarArquivos() });
  } catch (error) {
    return handleError(error);
  }
}
