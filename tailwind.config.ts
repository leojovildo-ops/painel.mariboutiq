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
      colors: {
        base: {
          DEFAULT: "#160F0D", // fundo da página
          800: "#1F1613",     // cartões
          700: "#2A1E19",     // cartões elevados / hover
          600: "#3A2A23"      // bordas
        },
        terracota: {
          DEFAULT: "#A64B2A",
          600: "#8E3F23",
          400: "#C25F3B"
        },
        coral: {
          DEFAULT: "#E4714E",
          400: "#F08A66",
          300: "#F4A184"
        },
        creme: {
          DEFAULT: "#F6EBE1",
          300: "#E4D3C5",
          500: "#BFA595", // texto secundário
          700: "#8B7266"  // texto de apoio / rótulos
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
