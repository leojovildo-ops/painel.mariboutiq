import type { Config } from "tailwindcss";

/**
 * Identidade Mari Boutique: fundo escuro quente (terracota queimada),
 * coral como cor de destaque, creme para o texto. Nada de cinza-azulado
 * genérico de SaaS — todos os neutros puxam para o marrom/terracota.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Os valores vivem em variáveis CSS (ver globals.css) para o ambiente de
      // demonstração poder trocar a paleta inteira sem mexer em uma classe
      // sequer das telas.
      colors: {
        base: {
          DEFAULT: "rgb(var(--c-base) / <alpha-value>)", // fundo da página
          800: "rgb(var(--c-base-800) / <alpha-value>)", // cartões
          700: "rgb(var(--c-base-700) / <alpha-value>)", // elevados / hover
          600: "rgb(var(--c-base-600) / <alpha-value>)"  // bordas
        },
        terracota: {
          DEFAULT: "rgb(var(--c-terracota) / <alpha-value>)",
          600: "rgb(var(--c-terracota-600) / <alpha-value>)",
          400: "rgb(var(--c-terracota-400) / <alpha-value>)"
        },
        coral: {
          DEFAULT: "rgb(var(--c-coral) / <alpha-value>)",
          400: "rgb(var(--c-coral-400) / <alpha-value>)",
          300: "rgb(var(--c-coral-300) / <alpha-value>)"
        },
        creme: {
          DEFAULT: "rgb(var(--c-creme) / <alpha-value>)",
          300: "rgb(var(--c-creme-300) / <alpha-value>)",
          500: "rgb(var(--c-creme-500) / <alpha-value>)", // texto secundário
          700: "rgb(var(--c-creme-700) / <alpha-value>)"  // texto de apoio
        },
        nivel: {
          prata: "#CBD1D8",
          ouro: "#E7B84B",
          diamante: "#7ED2E6"
        }
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"]
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(246,235,225,0.04) inset, 0 12px 32px -18px rgba(0,0,0,0.9)",
        glow: "0 0 0 1px rgba(228,113,78,0.35), 0 16px 40px -20px rgba(228,113,78,0.55)"
      }
    }
  },
  plugins: []
};

export default config;
