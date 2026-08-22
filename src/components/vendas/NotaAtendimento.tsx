import { classificar, FAIXA_COR } from "@/lib/nps";

/**
 * Nota de atendimento com a classificação ao lado. Fica na mesma linha do
 * faturamento e da projeção: quem olha o ranking vê quanto ela vendeu e como
 * ela atendeu de uma vez só, sem trocar de tela.
 */
export function NotaAtendimento({
  score,
  sufixo
}: {
  score: number | null;
  /** Texto extra, ex.: "média da equipe" quando a nota da loja é calculada. */
  sufixo?: string;
}) {
  const nota = classificar(score);
  if (!nota) return null;

  return (
    <span
      className={`inline-flex items-baseline gap-1.5 rounded-full border px-2.5 py-0.5 text-sm ${FAIXA_COR[nota.faixa]}`}
      title={sufixo ? `Atendimento ${nota.label} · ${sufixo}` : `Atendimento ${nota.label}`}
    >
      <span className="num font-bold">{nota.score.toFixed(1).replace(".", ",")}</span>
      <span className="text-xs font-semibold uppercase tracking-wide">{nota.label}</span>
    </span>
  );
}
