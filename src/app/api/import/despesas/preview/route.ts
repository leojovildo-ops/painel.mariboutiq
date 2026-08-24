import { NextResponse } from "next/server";
import { apiUser } from "@/lib/rbac";
import { forbidden, handleError, jsonError, unauthorized } from "@/lib/apiError";
import { criarPreviaDeDespesas } from "@/lib/import/previas";

export const runtime = "nodejs";

const MAX_BYTES = 12 * 1024 * 1024;

/** Lê a planilha de despesas e guarda a prévia; nada entra antes da confirmação. */
export async function POST(request: Request) {
  try {
    const user = await apiUser();
    if (!user) return unauthorized();
    // A planilha financeira só pode ser vista por quem tem o direito, então
    // subir o arquivo também exige as duas coisas.
    if (user.role !== "ADMIN" || !user.canViewFinance) return forbidden();

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError("Selecione o arquivo .xlsx de despesas.");
    if (!/\.xlsx?$/i.test(file.name)) return jsonError("O arquivo precisa ser uma planilha .xlsx.");
    if (file.size > MAX_BYTES) return jsonError("A planilha passa de 12 MB.");

    const resultado = await criarPreviaDeDespesas(
      Buffer.from(await file.arrayBuffer()),
      file.name,
      user.id
    );
    if (resultado.erro) return jsonError(resultado.erro);

    return NextResponse.json(resultado.previa);
  } catch (error) {
    return handleError(error);
  }
}
