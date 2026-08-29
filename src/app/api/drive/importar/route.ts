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
 * Traz um arquivo do Drive. Vendas e despesas param na tela de conferência,
 * como no upload manual — o Drive só troca de onde vem o arquivo, não o
 * cuidado antes de gravar. A pesquisa é gravada direto: ela só atualiza médias
 * de meses que já existem, sem criar nem apagar nada.
 *
 * O robô diário (/api/cron/drive) usa o mesmo caminho, só que confirmando
 * vendas e despesas sozinho.
 */
export async function POST(request: Request) {
  try {
    const user = await apiUser();
    if (!user) return unauthorized();
    if (user.role !== "ADMIN") return forbidden();

    const { fileId, nome, nativa, tipo } = schema.parse(await request.json());
    if (tipo === "DESPESAS" && !user.canViewFinance) return forbidden();

    const buffer = await baixarArquivo(fileId, nativa);
    const { erro, resposta } = await importarConteudo(buffer, nomeParaImportar(nome, nativa), tipo, user.id);

    if (erro || !resposta) return jsonError(erro ?? "Não foi possível importar este arquivo.");
    return NextResponse.json(resposta);
  } catch (error) {
    return handleError(error);
  }
}
