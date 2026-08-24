import { NextResponse } from "next/server";
import { z } from "zod";
import { apiUser } from "@/lib/rbac";
import { forbidden, handleError, jsonError, unauthorized } from "@/lib/apiError";
import { baixarArquivo } from "@/lib/google/drive";
import { criarPreviaDeDespesas, criarPreviaDeVendas } from "@/lib/import/previas";
import { parseSurvey } from "@/lib/xlsx/parseSurvey";
import { applySurvey } from "@/lib/import/applySurvey";

export const runtime = "nodejs";

const schema = z.object({
  fileId: z.string().min(10),
  nome: z.string().min(1),
  nativa: z.boolean(),
  tipo: z.enum(["VENDAS", "DESPESAS", "PESQUISA"])
});

/**
 * Traz um arquivo do Drive. Vendas e despesas param na tela de conferência,
 * como no upload manual — o Drive só troca de onde vem o arquivo, não o
 * cuidado antes de gravar. A pesquisa é gravada direto: ela só atualiza médias
 * de meses que já existem, sem criar nem apagar nada.
 */
export async function POST(request: Request) {
  try {
    const user = await apiUser();
    if (!user) return unauthorized();
    if (user.role !== "ADMIN") return forbidden();

    const { fileId, nome, nativa, tipo } = schema.parse(await request.json());
    if (tipo === "DESPESAS" && !user.canViewFinance) return forbidden();

    // Planilha nativa do Google sai como .xlsx na exportação.
    const nomeArquivo = nativa && !/\.xlsx?$/i.test(nome) ? `${nome}.xlsx` : nome;
    const buffer = await baixarArquivo(fileId, nativa);

    if (tipo === "VENDAS") {
      const resultado = await criarPreviaDeVendas(buffer, nomeArquivo, user.id);
      if (resultado.erro) return jsonError(resultado.erro);
      return NextResponse.json({ tipo, previa: resultado.previa });
    }

    if (tipo === "DESPESAS") {
      const resultado = await criarPreviaDeDespesas(buffer, nomeArquivo, user.id);
      if (resultado.erro) return jsonError(resultado.erro);
      return NextResponse.json({ tipo, previa: resultado.previa });
    }

    const parsed = parseSurvey(buffer, nomeArquivo);
    if (parsed.totalRespostas === 0) {
      return jsonError(parsed.warnings.join(" ") || "Nenhuma resposta válida encontrada.");
    }
    const resultado = await applySurvey(parsed);
    return NextResponse.json({
      tipo,
      pesquisa: {
        totalRespostas: parsed.totalRespostas,
        vendedorasAtualizadas: resultado.vendedorasAtualizadas,
        mesesDaLoja: resultado.mesesDaLoja,
        warnings: [...parsed.warnings, ...resultado.avisos]
      }
    });
  } catch (error) {
    return handleError(error);
  }
}
