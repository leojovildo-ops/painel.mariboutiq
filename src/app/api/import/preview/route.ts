import { NextResponse } from "next/server";
import { apiUser } from "@/lib/rbac";
import { forbidden, handleError, jsonError, unauthorized } from "@/lib/apiError";
import { criarPreviaDeVendas } from "@/lib/import/previas";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;

/** Lê a planilha e guarda a prévia; nada entra nos painéis antes da confirmação. */
export async function POST(request: Request) {
  try {
    const user = await apiUser();
    if (!user) return unauthorized();
    if (user.role !== "ADMIN") return forbidden();

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError("Selecione o arquivo .xlsx do mês.");
    if (!/\.xlsx?$/i.test(file.name)) return jsonError("O arquivo precisa ser uma planilha .xlsx.");
    if (file.size > MAX_BYTES) return jsonError("A planilha passa de 8 MB. Envie o arquivo original do mês.");

    const resultado = await criarPreviaDeVendas(
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
