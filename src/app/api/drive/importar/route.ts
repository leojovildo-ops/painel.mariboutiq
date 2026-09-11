import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser } from "@/lib/rbac";
import { forbidden, handleError, jsonError, unauthorized } from "@/lib/apiError";
import { baixarArquivo, nomeParaImportar } from "@/lib/google/drive";
import { importarConteudo } from "@/lib/import/importarConteudo";

export const runtime = "nodejs";

const schema = z.object({
  fileId: z.string().min(10),
  nome: z.string().min(1),
  nativa: z.boolean(),
  tipo: z.enum(["VENDAS", "DESPESAS", "PESQUISA", "ESTOQUE", "ESTOQUE_VENDAS", "HISTORICO"])
});

/**
 * Traz um arquivo do Drive agora, sem esperar a rodada da manhã. Grava direto,
 * como o robô: quem clica aqui está pedindo a mesma coisa, só que na hora.
 */
export async function POST(request: Request) {
  try {
    const user = await apiUser();
    if (!user) return unauthorized();
    if (user.role !== "ADMIN") return forbidden();

    const { fileId, nome, nativa, tipo } = schema.parse(await request.json());
    if (tipo === "DESPESAS" && !user.canViewFinance) return forbidden();

    const buffer = await baixarArquivo(fileId, nativa);
    const { erro, resumo, avisos } = await importarConteudo(
      buffer,
      nomeParaImportar(nome, nativa),
      tipo,
      user.id
    );

    if (erro) return jsonError(erro);
    return NextResponse.json({ tipo, resumo, avisos });
  } catch (error) {
    return handleError(error);
  }
}
