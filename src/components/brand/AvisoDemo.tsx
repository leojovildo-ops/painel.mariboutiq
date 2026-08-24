import { ehDemonstracao } from "@/lib/marca";

/**
 * Faixa fixa de demonstração.
 *
 * Um painel de gestão sem aviso é indistinguível de um real: quem vir a tela
 * numa apresentação pode sair achando que aqueles são números de uma loja de
 * verdade. A faixa fica sempre visível, inclusive impressa.
 */
export function AvisoDemo() {
  if (!ehDemonstracao) return null;

  return (
    <div className="sticky top-0 z-50 bg-coral px-4 py-1.5 text-center text-xs font-bold uppercase tracking-wider text-base">
      Demonstração · todos os números desta tela são fictícios
    </div>
  );
}
