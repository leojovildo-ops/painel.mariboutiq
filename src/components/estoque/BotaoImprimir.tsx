"use client";

/**
 * Gera o PDF pelo próprio navegador (Ctrl+P → Salvar como PDF).
 *
 * É de propósito: a página de impressão é a mesma que está na tela, então o
 * PDF sai idêntico ao sistema e acompanha qualquer mudança de layout sozinho.
 * Uma biblioteca de PDF no servidor exigiria remontar todas as tabelas à mão e
 * as duas versões acabariam divergindo.
 */
export function BotaoImprimir() {
  return (
    <button type="button" className="btn-primary print:hidden" onClick={() => window.print()}>
      Salvar em PDF
    </button>
  );
}
