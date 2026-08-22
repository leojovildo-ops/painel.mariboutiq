import { classificar, FAIXA_COR } from "@/lib/nps";

/**
 * Nota de atendimento com a classificação ao lado. Fica na mesma linha do
 * faturamento e da projeção: quem olha o ranking vê quanto ela vendeu e como
 * ela atendeu de uma vez só, sem trocar de tela.
 */
export function NotaAtendimento({
  score,
  respostas,
  sufixo
}: {
  score: number | null;
  /** Quantas respostas geraram a nota. Uma nota alta de 2 respostas não vale
   *  o mesmo que a mesma nota de 200, e o número fica visível por isso. */
  respostas?: number | null;
  /** Texto extra, ex.: "média da equipe" quando a nota da loja é calculada. */
  sufixo?: string;
}) {
  const nota = classificar(score);
  if (!nota) return null;

  const detalhe = [
    respostas != null ? `${respostas} ${respostas === 1 ? "resposta" : "respostas"}` : null,
    sufixo
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <span
      className={`inline-flex items-baseline gap-1.5 rounded-full border px-2.5 py-0.5 text-sm ${FAIXA_COR[nota.faixa]}`}
      title={detalhe ? `Atendimento ${nota.label} · ${detalhe}` : `Atendimento ${nota.label}`}
    >
      <span className="num font-bold">{nota.score.toFixed(1).replace(".", ",")}</span>
      <span className="text-xs font-semibold uppercase tracking-wide">{nota.label}</span>
      {respostas != null && (
        <span className="num text-[11px] font-normal opacity-70">{respostas}</span>
      )}
    </span>
  );
}
