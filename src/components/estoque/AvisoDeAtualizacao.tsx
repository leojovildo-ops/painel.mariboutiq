import { DIAS_DE_VALIDADE, type AvisoDeEstoque } from "@/lib/data/estoqueAviso";

/**
 * Só aparece quando a foto do estoque passou do prazo — um aviso permanente
 * viraria paisagem e ninguém leria justamente no dia em que importa.
 */
export function AvisoDeAtualizacao({ aviso }: { aviso: AvisoDeEstoque }) {
  if (!aviso.vencido) return null;

  return (
    <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
      <p className="font-semibold">
        {aviso.dias === null
          ? "Nenhuma planilha de estoque foi importada ainda."
          : `A planilha de estoque está há ${aviso.dias} dias sem atualizar.`}
      </p>
      <p className="mt-1 text-amber-100/80">
        Como o estoque gira todos os dias, exporte o levantamento do SISloja a cada{" "}
        {DIAS_DE_VALIDADE} dias e salve na pasta do Drive: a importação acontece sozinha na
        próxima rodada.
      </p>
    </div>
  );
}
