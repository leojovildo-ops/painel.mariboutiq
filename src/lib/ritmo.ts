/**
 * Ritmo diário: quanto a loja (ou a vendedora) vem fazendo por dia e quanto
 * precisa fazer por dia útil restante para alcançar a próxima meta.
 *
 * É a conta das linhas "MÉDIA ATUAL" e "Média Meta O/D" da planilha, conferida
 * contra ela centavo a centavo:
 *
 *   média atual   = faturamento ÷ dias trabalhados
 *   falta por dia = (meta − faturamento) ÷ (dias úteis − dias trabalhados)
 *
 * Fica calculado aqui, e não lido da planilha, para acompanhar cada dia novo
 * lançado sem depender de uma reimportação.
 */
export interface Ritmo {
  /** Média por dia trabalhado até agora. */
  mediaDiaria: number | null;
  diasRestantes: number | null;
  /** Quanto falta por dia útil para a próxima meta. Null quando não há meta
   *  pendente ou quando o mês não tem mais dias. */
  faltaPorDia: number | null;
}

export function calcularRitmo(dados: {
  revenue: number;
  workingDays: number | null;
  workedDays: number | null;
  /** Meta ainda não alcançada; null quando todas já foram batidas. */
  nextTarget: number | null;
}): Ritmo {
  const { revenue, workingDays, workedDays, nextTarget } = dados;

  const mediaDiaria = workedDays && workedDays > 0 ? revenue / workedDays : null;

  const diasRestantes =
    workingDays != null && workedDays != null ? Math.max(0, workingDays - workedDays) : null;

  // Sem meta pendente ou sem dia restante não existe ritmo a perseguir: a
  // conta daria divisão por zero ou um valor negativo sem sentido na tela.
  const faltaPorDia =
    nextTarget != null && diasRestantes != null && diasRestantes > 0 && nextTarget > revenue
      ? (nextTarget - revenue) / diasRestantes
      : null;

  return { mediaDiaria, diasRestantes, faltaPorDia };
}
