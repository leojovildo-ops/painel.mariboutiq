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

export interface VendedoraParaCasar {
  id: string;
  sheetName: string;
  aliases?: string[];
}

/**
 * Casa o nome respondido no formulário com a vendedora cadastrada.
 *
 * O formulário e as planilhas foram escritos por pessoas diferentes: "Stefanny"
 * no formulário é "STEFANY" nas abas, e o campo "Outro:" é texto livre, então
 * aparece de tudo ("Ster", "Stefany B"...). Sem casar esses nomes, as respostas
 * ficariam órfãs e a nota dela nunca apareceria.
 *
 * A ordem é da regra mais segura para a mais tolerante:
 *   1. nome igual ao da aba da planilha;
 *   2. apelido cadastrado à mão na Administração — sempre vence a adivinhação;
 *   3. erro de digitação (uma ou duas letras de diferença);
 *   4. começo do nome em comum, e só quando UMA única vendedora bate — é o que
 *      resolve "Ster", curto demais para as regras acima.
 */
export function casarVendedora(
  nomeNoFormulario: string,
  vendedoras: VendedoraParaCasar[]
): VendedoraParaCasar | null {
  const alvo = normalize(nomeNoFormulario);
  if (!alvo || alvo === "OUTRO" || alvo.startsWith("(")) return null;

  const exata = vendedoras.find((v) => normalize(v.sheetName) === alvo);
  if (exata) return exata;

  const porApelido = vendedoras.find((v) => (v.aliases ?? []).some((a) => normalize(a) === alvo));
  if (porApelido) return porApelido;

  // Só nomes de tamanho parecido, para "Rafaela" não casar com "Mayara".
  const parecidas = vendedoras
    .map((v) => ({ v, d: distancia(alvo, normalize(v.sheetName)) }))
    .filter(({ v, d }) => d <= 2 && Math.abs(normalize(v.sheetName).length - alvo.length) <= 2)
    .sort((a, b) => a.d - b.d);
  if (parecidas.length > 0) return parecidas[0].v;

  // Começo em comum: exige 3 letras e some na dúvida. Se duas vendedoras
  // começarem igual, é melhor não adivinhar e deixar a resposta para a loja —
  // um palpite errado premiaria a pessoa errada no ranking de atendimento.
  const PREFIXO_MINIMO = 3;
  if (alvo.length >= PREFIXO_MINIMO) {
    const porPrefixo = vendedoras.filter((v) => {
      const nome = normalize(v.sheetName);
      const comum = Math.min(nome.length, alvo.length);
      if (comum < PREFIXO_MINIMO) return false;
      return nome.slice(0, PREFIXO_MINIMO) === alvo.slice(0, PREFIXO_MINIMO);
    });
    if (porPrefixo.length === 1) return porPrefixo[0];
  }

  return null;
}

/**
 * Grava as notas do mês. Só escreve onde já existe o mês importado: criar
 * linha nova a partir da pesquisa colocaria no ranking uma vendedora sem
 * nenhuma venda registrada.
 */
export async function applySurvey(parsed: ParsedSurvey) {
  const vendedoras = await prisma.seller.findMany({
    select: { id: true, sheetName: true, aliases: true }
  });
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
