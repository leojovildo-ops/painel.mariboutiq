import type { MetadataRoute } from "next";
import { marca } from "@/lib/marca";

/**
 * Manifesto do app. É o que permite instalar o painel na tela de início do
 * celular: ele abre em tela cheia, com ícone próprio e sem a barra do
 * navegador, do mesmo jeito que um aplicativo baixado da loja.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: marca.sistema,
    short_name: marca.loja,
    description: `Metas, ranking, níveis e resultados da ${marca.loja}.`,
    lang: "pt-BR",
    // Abre direto no ranking: é a tela que a equipe mais consulta no celular.
    start_url: "/ranking",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#160F0D",
    theme_color: "#160F0D",
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png" },
      // O Android recorta o ícone num círculo; o "maskable" tem margem para isso.
      { src: "/icone-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}
