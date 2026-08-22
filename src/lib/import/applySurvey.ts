import { prisma } from "@/lib/prisma";
import { normalize } from "@/lib/xlsx/parseMonthWorkbook";
import type { ParsedSurvey } from "@/lib/xlsx/parseSurvey";

/** Distância de edição, para casar "Stefanny" (formulário) com "STEFANY" (planilha). */
function distancia(a: string, b: string): number {
  const linha = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let anterior = linha[0];
    linha[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = linha[j];
      linha[j] = Math.min(linha[j] + 1, linha[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1));
      anterior = temp;
    }
  }
  return linha[b.length];
}

/**
 * Casa o nome respondido no formulário com a vendedora cadastrada. O
 * formulário e as planilhas foram escritos por pessoas diferentes, em momentos
 * diferentes: "Stefanny" no formulário é "STEFANY" nas abas. Sem isso, as
 * respostas dela ficariam órfãs e a nota dela nunca apareceria.
 */
export function casarVendedora(
  nomeNoFormulario: string,
  vendedoras: Array<{ id: string; sheetName: string }>
): { id: string; sheetName: string } | null {
  const alvo = normalize(nomeNoFormulario);
  if (!alvo || alvo === "OUTRO" || alvo.startsWith("(")) return null;

  const exata = vendedoras.find((v) => normalize(v.sheetName) === alvo);
  if (exata) return exata;

  // Só nomes de tamanho parecido, para "Rafaela" não casar com "Mayara".
  const parecidas = vendedoras
    .map((v) => ({ v, d: distancia(alvo, normalize(v.sheetName)) }))
    .filter(({ v, d }) => d <= 2 && Math.abs(normalize(v.sheetName).length - alvo.length) <= 2)
    .sort((a, b) => a.d - b.d);

  return parecidas.length > 0 ? parecidas[0].v : null;
}

/**
 * Grava as notas do mês. Só escreve onde já existe o mês importado: criar
 * linha nova a partir da pesquisa colocaria no ranking uma vendedora sem
 * nenhuma venda registrada.
 */
export async function applySurvey(parsed: ParsedSurvey) {
  const vendedoras = await prisma.seller.findMany({ select: { id: true, sheetName: true } });
  const avisos: string[] = [];
  const naoCasados = new Set<string>();

  let vendedorasAtualizadas = 0;
  for (const linha of parsed.porVendedora) {
    const vendedora = casarVendedora(linha.nomeNoFormulario, vendedoras);
    if (!vendedora) {
      if (linha.nomeNoFormulario !== "(não informado)") naoCasados.add(linha.nomeNoFormulario);
      continue;
    }

    const stats = await prisma.monthlyStats.findFirst({
      where: {
        scope: "SELLER",
        sellerId: vendedora.id,
        period: { year: linha.year, month: linha.month }
      }
    });

    if (!stats) {
      avisos.push(
        `${linha.nomeNoFormulario}: ${linha.respostas} resposta(s) de ${String(linha.month).padStart(2, "0")}/${linha.year}, mas esse mês dela ainda não foi importado das vendas — a nota não foi gravada.`
      );
      continue;
    }

    await prisma.monthlyStats.update({
      where: { id: stats.id },
      data: { npsScore: linha.media, npsResponses: linha.respostas }
    });
    vendedorasAtualizadas += 1;
  }

  let mesesDaLoja = 0;
  for (const mes of parsed.porMes) {
    const stats = await prisma.monthlyStats.findFirst({
      where: { scope: "STORE", period: { year: mes.year, month: mes.month } }
    });
    if (!stats) continue;
    await prisma.monthlyStats.update({
      where: { id: stats.id },
      data: { npsScore: mes.media, npsResponses: mes.respostas }
    });
    mesesDaLoja += 1;
  }

  if (naoCasados.size > 0) {
    avisos.push(
      `Nomes que não têm vendedora correspondente: ${Array.from(naoCasados).join(", ")}. As respostas contam para a nota da loja, mas não para ninguém em particular.`
    );
  }

  return { vendedorasAtualizadas, mesesDaLoja, avisos, totalRespostas: parsed.totalRespostas };
}
