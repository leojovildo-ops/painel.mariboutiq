/**
 * Gamificação por nível. Os nomes e os valores das metas vêm das próprias
 * planilhas (colunas I/J, linhas 23-25) — nada é inventado aqui, e cada
 * vendedora pode ter metas diferentes em cada mês.
 */
export type GoalLevelName = "PRATA" | "OURO" | "DIAMANTE";

export const LEVEL_ORDER: GoalLevelName[] = ["PRATA", "OURO", "DIAMANTE"];

export const LEVEL_LABEL: Record<GoalLevelName, string> = {
  PRATA: "Prata",
  OURO: "Ouro",
  DIAMANTE: "Diamante"
};

export interface LevelGoal {
  level: GoalLevelName;
  target: number;
}

export interface LevelProgress {
  /** Nível já conquistado no mês, ou null enquanto a primeira meta não é batida. */
  current: GoalLevelName | null;
  /** Próximo nível a alcançar, ou null quando já bateu o mais alto. */
  next: GoalLevelName | null;
  nextTarget: number | null;
  /** Quanto falta em R$ para o próximo nível. */
  remaining: number | null;
  /** 0-100, progresso até o próximo nível (100 quando não há próximo). */
  progress: number;
  /**
   * Faturamento dividido pela meta do próximo nível, em %. É a coluna K da
   * planilha, e é o número que a equipe usa para saber o quanto falta —
   * diferente de `progress`, que mede só o trecho entre um nível e o outro.
   */
  percentOfNext: number | null;
  /** % do faturamento sobre a meta do nível atual/próximo, como na coluna K. */
  goals: LevelGoal[];
}

export function computeLevel(revenue: number, goals: LevelGoal[]): LevelProgress {
  const sorted = [...goals]
    .filter((g) => g.target > 0)
    .sort((a, b) => a.target - b.target);

  if (sorted.length === 0) {
    return {
      current: null, next: null, nextTarget: null, remaining: null,
      progress: 0, percentOfNext: null, goals: sorted
    };
  }

  const reached = sorted.filter((g) => revenue >= g.target);
  const current = reached.length > 0 ? reached[reached.length - 1].level : null;
  const upcoming = sorted.find((g) => revenue < g.target) ?? null;

  if (!upcoming) {
    return {
      current, next: null, nextTarget: null, remaining: null,
      progress: 100, percentOfNext: null, goals: sorted
    };
  }

  // A barra mede o trecho entre o nível já conquistado e o próximo, para que
  // bater o Ouro não jogue a barra do Diamante para perto do fim sozinho.
  const floor = reached.length > 0 ? reached[reached.length - 1].target : 0;
  const span = upcoming.target - floor;
  const progress = span > 0 ? Math.min(100, Math.max(0, ((revenue - floor) / span) * 100)) : 0;

  return {
    current,
    next: upcoming.level,
    nextTarget: upcoming.target,
    remaining: Math.max(0, upcoming.target - revenue),
    progress,
    percentOfNext: (revenue / upcoming.target) * 100,
    goals: sorted
  };
}
