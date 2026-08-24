import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import { Providers } from "./providers";
import { marca, ehDemonstracao } from "@/lib/marca";
import { AvisoDemo } from "@/components/brand/AvisoDemo";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap", weight: ["600", "700"] });

export const metadata: Metadata = {
  title: marca.sistema,
  description: `Painel de vendas da ${marca.loja} — metas, ranking e níveis da equipe.`,
  // Instalação na tela de início. No iPhone o ícone e o modo tela cheia vêm
  // destas marcações, e não do manifesto — o Safari ainda usa as próprias.
  appleWebApp: {
    capable: true,
    title: marca.nomeDoApp,
    statusBarStyle: "black-translucent"
  },
  icons: {
    icon: ehDemonstracao
      ? [
          { url: "/icone-demo-192.png", sizes: "192x192", type: "image/png" },
          { url: "/icone-demo-512.png", sizes: "512x512", type: "image/png" }
        ]
      : [
          { url: "/icone-192.png", sizes: "192x192", type: "image/png" },
          { url: "/icone-512.png", sizes: "512x512", type: "image/png" }
        ],
    apple: ehDemonstracao ? "/apple-touch-icon-demo.png" : "/apple-touch-icon.png"
  },
  // O painel é interno: não deve aparecer em busca do Google.
  robots: { index: false, follow: false }
};

export const viewport: Viewport = {
  themeColor: ehDemonstracao ? "#090C11" : "#160F0D",
  // Sem isto, o conteúdo passa por baixo do notch e da barra inferior do iPhone
  // quando o painel abre em tela cheia.
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      data-tema={ehDemonstracao ? "demo" : undefined}
      className={`${sans.variable} ${display.variable}`}
    >
      <body>
        <AvisoDemo />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
