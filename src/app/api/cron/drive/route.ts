import { NextResponse } from "next/server";
import { apiUser } from "@/lib/rbac";
import { handleError, unauthorized } from "@/lib/apiError";
import { contaDeServicoConfigurada } from "@/lib/google/serviceAccount";
import { sincronizarDrive } from "@/lib/import/sincronizarDrive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Planilha grande demora; o padrão de 10s da Vercel não dá conta. */
export const maxDuration = 300;

/**
 * O robô diário. Quem chama é o cron da Vercel (vercel.json), que manda o
 * cabeçalho `Authorization: Bearer $CRON_SECRET`. Um Administrador logado
 * também pode chamar, que é o botão "Sincronizar agora" da Administração.
 */
export async function GET(request: Request) {
  try {
    const segredo = process.env.CRON_SECRET;
    const autorizado = segredo && request.headers.get("authorization") === `Bearer ${segredo}`;

    if (!autorizado) {
      const user = await apiUser();
      if (!user || user.role !== "ADMIN") return unauthorized();
    }

    if (!contaDeServicoConfigurada()) {
      return NextResponse.json({ configurado: false, importados: [] });
    }

    const url = new URL(request.url);
    const resultado = await sincronizarDrive({ forcar: url.searchParams.get("forcar") === "1" });

    console.log(
      `[drive] rodada: ${resultado.importados.length} importado(s), ${resultado.semMudanca} sem mudança, ${resultado.ignorados.length} ignorado(s).`
    );
    return NextResponse.json({ configurado: true, ...resultado });
  } catch (error) {
    return handleError(error);
  }
}
