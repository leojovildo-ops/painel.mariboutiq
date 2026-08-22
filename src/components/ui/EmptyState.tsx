import Link from "next/link";

/**
 * Primeira tela de verdade do sistema: sem planilha importada não existe dado
 * nenhum (nada de exemplo fictício), então o painel orienta o Administrador a
 * subir a primeira planilha e explica aos demais perfis o que está faltando.
 */
export function EmptyState({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="card p-8 text-center sm:p-12">
      <h2 className="font-display text-2xl font-bold text-creme">Nenhum mês importado ainda</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-creme-500">
        {isAdmin
          ? "O painel é alimentado pelas planilhas mensais da loja. Envie o arquivo .xlsx do mês para ver as metas, o ranking e os níveis da equipe."
          : "Assim que a planilha do mês for enviada pela administração, o ranking e as metas aparecem aqui."}
      </p>
      {isAdmin && (
        <Link href="/admin" className="btn-primary mt-6">
          Enviar a primeira planilha
        </Link>
      )}
    </div>
  );
}
