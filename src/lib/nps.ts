/**
 * Nota de satisfação do atendimento, de 0 a 10.
 *
 * É a média das respostas da pesquisa — não o índice NPS clássico (promotores
 * menos detratores, que vai de -100 a 100). As faixas abaixo são as que a
 * loja usa.
 */
export type FaixaAtendimento = "EXCELENTE" | "OTIMA" | "REGULAR" | "RUIM";

export interface Atendimento {
  score: number;
  faixa: FaixaAtendimento;
  label: string;
}

export const FAIXA_LABEL: Record<FaixaAtendimento, string> = {
  EXCELENTE: "Excelente",
  OTIMA: "Ótima",
  REGULAR: "Regular",
  RUIM: "Ruim"
};

/** Cores por faixa, para o texto ficar legível no fundo escuro. */
export const FAIXA_COR: Record<FaixaAtendimento, string> = {
  EXCELENTE: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  OTIMA: "text-nivel-diamante border-nivel-diamante/40 bg-nivel-diamante/10",
  REGULAR: "text-nivel-ouro border-nivel-ouro/40 bg-nivel-ouro/10",
  RUIM: "text-coral-300 border-coral/45 bg-coral/10"
};

export function classificar(score: number | null | undefined): Atendimento | null {
  if (score == null || !Number.isFinite(score)) return null;

  // 9,0 conta como Excelente e 8,0 como Ótima: a régua é "a partir de", senão
  // uma nota redonda cairia na faixa de baixo.
  const faixa: FaixaAtendimento =
    score >= 9 ? "EXCELENTE" : score >= 8 ? "OTIMA" : score >= 7 ? "REGULAR" : "RUIM";

  return { score, faixa, label: FAIXA_LABEL[faixa] };
}

/** Nota da loja a partir das notas das vendedoras do mês. */
export function mediaDaLoja(notas: Array<number | null>): number | null {
  const validas = notas.filter((n): n is number => n != null && Number.isFinite(n));
  if (validas.length === 0) return null;
  return validas.reduce((acc, n) => acc + n, 0) / validas.length;
}
