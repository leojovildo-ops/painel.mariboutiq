/**
 * Identidade exibida no painel.
 *
 * O mesmo código roda no painel da loja e no ambiente de demonstração. Na demo
 * a marca é genérica e os números são fictícios, então nada da Mari Boutique
 * pode aparecer lá — nem o logotipo, nem o nome.
 */
export const ehDemonstracao = process.env.NEXT_PUBLIC_DEMO === "1";

export const marca = {
  /** Nome do sistema, no topo e no título da aba. */
  sistema: ehDemonstracao ? "Painel 360" : "Painel Mariboutique 360",
  /** Nome da loja, usado nos textos das telas. */
  loja: ehDemonstracao ? "Sua Marca" : "Mari Boutique",
  /** O logotipo é da Mari Boutique; a demo usa um monograma neutro. */
  usarLogotipo: !ehDemonstracao
};
