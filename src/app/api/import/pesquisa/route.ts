import { NextResponse } from "next/server";
import { apiUser } from "@/lib/rbac";
import { forbidden, handleError, jsonError, unauthorized } from "@/lib/apiError";
import { parseSurvey } from "@/lib/xlsx/parseSurvey";
import { applySurvey } from "@/lib/import/applySurvey";

export const runtime = "nodejs";

const MAX_BYTES = 12 * 1024 * 1024;

/**
 * Importa as respostas da pesquisa de satisfação. Diferente das planilhas de
 * vendas e despesas, aqui não há etapa de confirmação: a importação só escreve
 * a nota e a quantidade de respostas em meses que já existem, sem criar nem
 * apagar nada — reimportar simplesmente atualiza as médias.
 */
export async function POST(request: Request) {
  try {
    const user = await apiUser();
    if (!user) return unauthorized();
    if (user.role !== "ADMIN") return forbidden();

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return jsonError("Selecione o arquivo de respostas (.csv ou .xlsx).");
    if (!/\.(csv|xlsx?)$/i.test(file.name)) return jsonError("O arquivo precisa ser .csv ou .xlsx.");
    if (file.size > MAX_BYTES) return jsonError("O arquivo passa de 12 MB.");

    const parsed = parseSurvey(Buffer.from(await file.arrayBuffer()), file.name);
    if (parsed.totalRespostas === 0) {
      return NextResponse.json({ error: parsed.warnings.join(" ") || "Nenhuma resposta válida encontrada." }, { status: 400 });
    }

    const resultado = await applySurvey(parsed);

    return NextResponse.json({
      totalRespostas: parsed.totalRespostas,
      ignoradas: parsed.ignoradas,
      vendedorasAtualizadas: resultado.vendedorasAtualizadas,
      mesesDaLoja: resultado.mesesDaLoja,
      meses: parsed.porMes.map((m) => ({
        month: m.month,
        year: m.year,
        respostas: m.respostas,
        media: Number(m.media.toFixed(2))
      })),
      warnings: [...parsed.warnings, ...resultado.avisos]
    });
  } catch (error) {
    return handleError(error);
  }
}
