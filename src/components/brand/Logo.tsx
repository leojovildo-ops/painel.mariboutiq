import Image from "next/image";
import logo from "../../../public/logo-mari-boutique.png";

/**
 * Logotipo oficial da Mari Boutique, na variação clara.
 *
 * O arquivo do kit da marca é preto sobre branco e sumiria no fundo escuro do
 * painel; a versão creme foi gerada a partir dele por `scripts/gerarLogo.ts`,
 * preservando os traços originais. Como o logotipo já diz "Mari boutique", o
 * texto ao lado se limita a nomear o sistema, sem repetir a marca.
 */
export function Logo({ width = 150 }: { width?: number }) {
  return (
    <Image
      src={logo}
      alt="Mari Boutique"
      width={width}
      height={Math.round((width * 1094) / 2310)}
      priority
      className="h-auto"
    />
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex flex-col gap-1.5">
      <Logo width={compact ? 116 : 152} />
      <span className="label pl-0.5">
        Painel <span className="text-coral">360</span>
      </span>
    </span>
  );
}
