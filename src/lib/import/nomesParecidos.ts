/**
 * Erro de digitação no nome da aba (ex.: "RAFELA" em vez de "RAFAELA") cria
 * uma segunda vendedora no sistema e divide o histórico dela em duas: o
 * ranking do ano passa a contar meses separados para a mesma pessoa. Não dá
 * para corrigir sozinho — o nome certo pode ser qualquer um dos dois —, mas
 * dá para avisar antes de salvar.
 */
function distancia(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const linha = Array.from({ length: n + 1 }, (_, i) => i);

  for (let i = 1; i <= m; i++) {
    let anterior = linha[0];
    linha[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = linha[j];
      linha[j] = Math.min(
        linha[j] + 1,
        linha[j - 1] + 1,
        anterior + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      anterior = temp;
    }
  }
  return linha[n];
}

export function avisosDeNomesParecidos(
  abasDoArquivo: string[],
  vendedorasExistentes: string[]
): string[] {
  const avisos: string[] = [];

  for (const aba of abasDoArquivo) {
    if (vendedorasExistentes.includes(aba)) continue;

    const parecida = vendedorasExistentes.find((nome) => {
      const d = distancia(aba, nome);
      // Uma ou duas letras de diferença em nomes de tamanho parecido.
      return d > 0 && d <= 2 && Math.abs(aba.length - nome.length) <= 2 && Math.min(aba.length, nome.length) >= 4;
    });

    if (parecida) {
      avisos.push(
        `A aba "${aba}" parece ser a mesma pessoa que "${parecida}", que já existe no sistema. Se for erro de digitação, corrija o nome da aba na planilha antes de salvar — senão ela vira uma segunda vendedora e o histórico do ano fica dividido em duas.`
      );
    }
  }

  return avisos;
}
