import type { MesFinanceiro } from "@/lib/data/finance";

export type Tom = "POSITIVO" | "ATENCAO" | "NEGATIVO";

export interface Observacao {
  tom: Tom;
  titulo: string;
  texto: string;
}

/**
 * Meta de margem líquida da casa: a própria planilha (aba "DESPESAS GERAL")
 * trabalha com MARGEM L = 10%. É essa a régua usada aqui.
 */
const META_MARGEM = 10;

/** Variação a partir da qual uma mudança deixa de ser ruído e vira notícia. */
const VARIACAO_RELEVANTE = 5;

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;

function variacao(atual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

/**
 * Lê os números do mês e escreve o que está bom, o que merece atenção e o que
 * está ruim. Cada observação é derivada de uma comparação explícita — com a
 * meta de margem, com o mês anterior ou com a média dos meses já fechados —
 * para que o texto sempre possa ser conferido contra a planilha.
 */
export function gerarObservacoes(mes: MesFinanceiro, anteriores: MesFinanceiro[]): Observacao[] {
  const obs: Observacao[] = [];
  const anterior = anteriores.length > 0 ? anteriores[anteriores.length - 1] : null;
  const comReceita = anteriores.filter((m) => m.revenue != null && m.revenue > 0);

  // ---- Mês ainda aberto -----------------------------------------------------
  // Nada aqui pode comparar um mês pela metade com meses fechados sem dizer
  // que é isso que está acontecendo: a "queda" seria só o mês não ter acabado.
  if (mes.emAndamento) {
    const dias =
      mes.diasTrabalhados != null && mes.diasUteis != null
        ? ` Até agora são ${mes.diasTrabalhados} de ${mes.diasUteis} dias úteis.`
        : "";
    obs.push({
      tom: "ATENCAO",
      titulo: "Mês ainda em andamento",
      texto: `Os números abaixo são parciais e não dá para compará-los de igual para igual com meses fechados.${dias}`
    });
  }

  // ---- Resultado do mês -----------------------------------------------------
  if (mes.revenue == null) {
    obs.push({
      tom: "ATENCAO",
      titulo: "Faturamento do mês ainda não informado",
      texto:
        "Sem o faturamento não dá para calcular lucro nem margem. Importe a planilha de vendas deste mês, ou preencha a linha FATURAMENTO BRUTO na aba RESUMO DESPESAS ANO."
    });
  } else if (mes.profit != null && mes.margin != null) {
    if (mes.profit < 0) {
      obs.push({
        tom: mes.emAndamento ? "ATENCAO" : "NEGATIVO",
        titulo: mes.emAndamento
          ? `Parcial no vermelho: ${brl(mes.profit)}`
          : `Mês fechou no vermelho: ${brl(mes.profit)}`,
        texto: `As despesas (${brl(mes.expenses)}) passaram o faturamento (${brl(mes.revenue)}). A diferença precisa sair do caixa ou de meses melhores.`
      });
    } else if (mes.margin >= META_MARGEM) {
      obs.push({
        tom: "POSITIVO",
        titulo: `Margem${mes.emAndamento ? " parcial" : ""} de ${pct(mes.margin)}, acima da meta de ${pct(META_MARGEM)}`,
        texto: `Lucro de ${brl(mes.profit)} sobre ${brl(mes.revenue)} de faturamento.`
      });
    } else {
      obs.push({
        tom: "ATENCAO",
        titulo: `Margem${mes.emAndamento ? " parcial" : ""} de ${pct(mes.margin)}, abaixo da meta de ${pct(META_MARGEM)}`,
        texto: `Sobrou ${brl(mes.profit)}. Para bater a meta neste faturamento, as despesas teriam que ficar em ${brl(mes.revenue * (1 - META_MARGEM / 100))}.`
      });
    }
  }

  // ---- Faturamento contra o mês anterior ------------------------------------
  // Só faz sentido com o mês fechado (ver acima).
  if (!mes.emAndamento && mes.revenue != null && anterior?.revenue != null) {
    const v = variacao(mes.revenue, anterior.revenue);
    if (v != null && Math.abs(v) >= VARIACAO_RELEVANTE) {
      obs.push({
        tom: v > 0 ? "POSITIVO" : "ATENCAO",
        titulo: `Faturamento ${v > 0 ? "subiu" : "caiu"} ${pct(Math.abs(v))} sobre o mês anterior`,
        texto: `${brl(anterior.revenue)} no mês passado contra ${brl(mes.revenue)} agora.`
      });
    }
  }

  // ---- Despesas contra a média dos meses anteriores -------------------------
  if (!mes.emAndamento && anteriores.length >= 2) {
    const media = anteriores.reduce((acc, m) => acc + m.expenses, 0) / anteriores.length;
    const v = variacao(mes.expenses, media);
    if (v != null && v >= VARIACAO_RELEVANTE * 2) {
      obs.push({
        tom: "ATENCAO",
        titulo: `Despesas ${pct(v)} acima da média do ano`,
        texto: `A média dos meses anteriores é ${brl(media)}; este mês fechou em ${brl(mes.expenses)}.`
      });
    } else if (v != null && v <= -VARIACAO_RELEVANTE * 2) {
      obs.push({
        tom: "POSITIVO",
        titulo: `Despesas ${pct(Math.abs(v))} abaixo da média do ano`,
        texto: `Média dos meses anteriores: ${brl(media)}. Este mês: ${brl(mes.expenses)}.`
      });
    }
  }

  // ---- Grupo que mais pesou -------------------------------------------------
  const maior = mes.groups[0];
  if (maior && mes.revenue != null && mes.revenue > 0) {
    const sobreFaturamento = (maior.total / mes.revenue) * 100;
    obs.push({
      tom: sobreFaturamento >= 50 ? "ATENCAO" : "POSITIVO",
      titulo: `${maior.group} é o maior gasto: ${pct(maior.share)} das despesas`,
      texto: `${brl(maior.total)}, o equivalente a ${pct(sobreFaturamento)} do faturamento do mês.`
    });
  }

  // ---- Grupo que mais variou contra a média --------------------------------
  if (!mes.emAndamento && anteriores.length >= 2) {
    const mediaPorGrupo = new Map<string, number>();
    for (const m of anteriores) {
      for (const g of m.groups) mediaPorGrupo.set(g.group, (mediaPorGrupo.get(g.group) ?? 0) + g.total);
    }

    let pior: { group: string; v: number; atual: number; media: number } | null = null;
    for (const g of mes.groups) {
      const soma = mediaPorGrupo.get(g.group);
      if (soma == null) continue;
      const media = soma / anteriores.length;
      const v = variacao(g.total, media);
      // Só vale a pena avisar sobre grupo grande: um item pequeno dobrar não muda o mês.
      if (v != null && v >= 25 && g.total > mes.expenses * 0.1 && (!pior || v > pior.v)) {
        pior = { group: g.group, v, atual: g.total, media };
      }
    }
    if (pior) {
      obs.push({
        tom: "ATENCAO",
        titulo: `${pior.group} subiu ${pct(pior.v)} contra a média`,
        texto: `Média dos meses anteriores: ${brl(pior.media)}. Este mês: ${brl(pior.atual)}.`
      });
    }
  }

  // ---- Contas em aberto -----------------------------------------------------
  if (mes.emAberto > 0) {
    const peso = mes.expenses > 0 ? (mes.emAbertoValor / mes.expenses) * 100 : 0;
    obs.push({
      tom: peso >= 25 ? "NEGATIVO" : "ATENCAO",
      titulo: `${mes.emAberto} lançamento${mes.emAberto === 1 ? "" : "s"} sem data de pagamento`,
      texto: `${brl(mes.emAbertoValor)} em aberto, ${pct(peso)} das despesas do mês. Se já foram pagos, falta preencher a data na planilha.`
    });
  } else if (mes.expenses > 0) {
    obs.push({
      tom: "POSITIVO",
      titulo: "Nenhuma conta em aberto",
      texto: "Todos os lançamentos do mês têm data de pagamento preenchida."
    });
  }

  // ---- Consistência entre as duas planilhas ---------------------------------
  if (mes.revenueSource === "FINANCEIRO") {
    obs.push({
      tom: "ATENCAO",
      titulo: "Faturamento veio da planilha financeira",
      texto: "A planilha de vendas deste mês ainda não foi importada, então o número não tem a abertura por vendedora."
    });
  }

  // ---- Melhor mês do ano até aqui ------------------------------------------
  if (!mes.emAndamento && mes.margin != null && comReceita.length >= 2) {
    const melhorAnterior = Math.max(...comReceita.map((m) => m.margin ?? -Infinity));
    if (mes.margin > melhorAnterior) {
      obs.push({
        tom: "POSITIVO",
        titulo: "Melhor margem do ano até agora",
        texto: `Nenhum mês anterior passou de ${pct(melhorAnterior)}.`
      });
    }
  }

  return obs;
}

export function agrupar(obs: Observacao[]): Record<Tom, Observacao[]> {
  return {
    POSITIVO: obs.filter((o) => o.tom === "POSITIVO"),
    ATENCAO: obs.filter((o) => o.tom === "ATENCAO"),
    NEGATIVO: obs.filter((o) => o.tom === "NEGATIVO")
  };
}

/**
 * Leitura do ano inteiro. Só considera meses fechados nas comparações — o mês
 * corrente é parcial e distorceria média, melhor e pior mês.
 */
export function gerarObservacoesAno(meses: MesFinanceiro[]): Observacao[] {
  const obs: Observacao[] = [];
  const fechados = meses.filter((m) => !m.emAndamento);
  const comMargem = fechados.filter((m) => m.margin != null);

  const faturamento = meses.reduce((acc, m) => acc + (m.revenue ?? 0), 0);
  const despesas = meses.reduce((acc, m) => acc + m.expenses, 0);
  const lucro = faturamento - despesas;
  const margem = faturamento > 0 ? (lucro / faturamento) * 100 : null;

  // ---- Resultado acumulado --------------------------------------------------
  if (margem != null) {
    if (lucro < 0) {
      obs.push({
        tom: "NEGATIVO",
        titulo: `Ano acumula prejuízo de ${brl(lucro)}`,
        texto: `${brl(despesas)} de despesas contra ${brl(faturamento)} de faturamento.`
      });
    } else if (margem >= META_MARGEM) {
      obs.push({
        tom: "POSITIVO",
        titulo: `Margem do ano em ${pct(margem)}, acima da meta de ${pct(META_MARGEM)}`,
        texto: `${brl(lucro)} de resultado acumulado.`
      });
    } else {
      obs.push({
        tom: "ATENCAO",
        titulo: `Margem do ano em ${pct(margem)}, abaixo da meta de ${pct(META_MARGEM)}`,
        texto: `${brl(lucro)} acumulados. Na meta, o ano teria rendido ${brl(faturamento * (META_MARGEM / 100))} até aqui.`
      });
    }
  }

  // ---- Meses no vermelho ----------------------------------------------------
  const vermelhos = comMargem.filter((m) => (m.profit ?? 0) < 0);
  if (vermelhos.length > 0) {
    obs.push({
      tom: vermelhos.length >= 3 ? "NEGATIVO" : "ATENCAO",
      titulo: `${vermelhos.length} ${vermelhos.length === 1 ? "mês fechou" : "meses fecharam"} no vermelho`,
      texto: `${vermelhos.map((m) => MES_CURTO[m.month - 1]).join(", ")} — somando ${brl(
        vermelhos.reduce((acc, m) => acc + (m.profit ?? 0), 0)
      )}.`
    });
  }

  // ---- Melhor e pior mês ----------------------------------------------------
  if (comMargem.length >= 2) {
    const ordenados = [...comMargem].sort((a, b) => (b.margin ?? 0) - (a.margin ?? 0));
    const melhor = ordenados[0];
    const pior = ordenados[ordenados.length - 1];
    obs.push({
      tom: "POSITIVO",
      titulo: `Melhor mês: ${MES_LONGO[melhor.month - 1]}, com ${pct(melhor.margin ?? 0)} de margem`,
      texto: `${brl(melhor.revenue ?? 0)} de faturamento e ${brl(melhor.profit ?? 0)} de resultado.`
    });
    if (pior.month !== melhor.month && (pior.profit ?? 0) >= 0) {
      obs.push({
        tom: "ATENCAO",
        titulo: `Pior mês: ${MES_LONGO[pior.month - 1]}, com ${pct(pior.margin ?? 0)} de margem`,
        texto: `${brl(pior.revenue ?? 0)} de faturamento e ${brl(pior.profit ?? 0)} de resultado.`
      });
    }
  }

  // ---- Grupo que mais consome o faturamento do ano --------------------------
  const porGrupo = new Map<string, number>();
  for (const m of meses) for (const g of m.groups) porGrupo.set(g.group, (porGrupo.get(g.group) ?? 0) + g.total);
  const maior = Array.from(porGrupo.entries()).sort((a, b) => b[1] - a[1])[0];
  if (maior && faturamento > 0) {
    const sobre = (maior[1] / faturamento) * 100;
    obs.push({
      tom: sobre >= 45 ? "ATENCAO" : "POSITIVO",
      titulo: `${maior[0]} consome ${pct(sobre)} do faturamento do ano`,
      texto: `${brl(maior[1])} de um total de ${brl(despesas)} em despesas.`
    });
  }

  // ---- Tendência: últimos três meses fechados contra os três anteriores -----
  if (comMargem.length >= 6) {
    const ultimos = comMargem.slice(-3);
    const anteriores = comMargem.slice(-6, -3);
    const mediaU = ultimos.reduce((acc, m) => acc + (m.revenue ?? 0), 0) / 3;
    const mediaA = anteriores.reduce((acc, m) => acc + (m.revenue ?? 0), 0) / 3;
    const v = variacao(mediaU, mediaA);
    if (v != null && Math.abs(v) >= VARIACAO_RELEVANTE) {
      obs.push({
        tom: v > 0 ? "POSITIVO" : "ATENCAO",
        titulo: `Faturamento ${v > 0 ? "em alta" : "em queda"}: ${pct(Math.abs(v))} no trimestre`,
        texto: `Média dos três últimos meses fechados: ${brl(mediaU)}, contra ${brl(mediaA)} nos três anteriores.`
      });
    }
  }

  // ---- Meses sem faturamento informado --------------------------------------
  const semReceita = meses.filter((m) => m.revenue == null);
  if (semReceita.length > 0) {
    obs.push({
      tom: "ATENCAO",
      titulo: `${semReceita.length} mês(es) sem faturamento informado`,
      texto: `${semReceita.map((m) => MES_CURTO[m.month - 1]).join(", ")} entram só com despesa, o que puxa o resultado do ano para baixo.`
    });
  }

  return obs;
}

const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MES_LONGO = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];
