import { LEVEL_LABEL, type GoalLevelName } from "@/lib/levels";

const STYLE: Record<GoalLevelName, { ring: string; face: string; text: string }> = {
  PRATA: {
    ring: "ring-nivel-prata/40",
    face: "bg-[radial-gradient(120%_120%_at_30%_20%,#EEF1F4,#9FA7B0_55%,#6E767F)]",
    text: "text-base"
  },
  OURO: {
    ring: "ring-nivel-ouro/50",
    face: "bg-[radial-gradient(120%_120%_at_30%_20%,#FBE7A8,#E7B84B_55%,#A9791C)]",
    text: "text-base"
  },
  DIAMANTE: {
    ring: "ring-nivel-diamante/50",
    face: "bg-[radial-gradient(120%_120%_at_30%_20%,#E6FBFF,#7ED2E6_55%,#3C93AB)]",
    text: "text-base"
  }
};

/** Selo do nível — o elemento visual mais forte da tela de níveis. */
export function LevelBadge({
  level,
  size = "md"
}: {
  /** null = ainda não bateu a primeira meta do mês. */
  level: GoalLevelName | null;
  size?: "sm" | "md" | "lg";
}) {
  const box = size === "lg" ? "h-24 w-24 text-sm" : size === "sm" ? "h-11 w-11 text-[9px]" : "h-16 w-16 text-[11px]";

  if (!level) {
    return (
      <span
        className={`${box} flex shrink-0 flex-col items-center justify-center rounded-full border border-dashed border-base-600 text-center font-semibold uppercase tracking-wider text-creme-700`}
      >
        A caminho
      </span>
    );
  }

  const style = STYLE[level];
  return (
    <span
      className={`${box} ${style.face} ${style.text} flex shrink-0 flex-col items-center justify-center rounded-full font-display font-bold uppercase tracking-wide shadow-lg ring-4 ${style.ring}`}
      title={`Nível ${LEVEL_LABEL[level]}`}
    >
      {LEVEL_LABEL[level]}
    </span>
  );
}
