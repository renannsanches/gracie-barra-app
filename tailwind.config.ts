import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

// Cor a partir de um token "R G B" do globals.css — permite bg-brand/10 etc.
const rgb = (token: string) => `rgb(var(${token}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Variáveis shadcn (componentes em src/components/ui)
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        // Tokens semânticos — preferir estes em código novo
        brand: {
          DEFAULT: rgb("--brand"),
          dark: rgb("--brand-dark"),
          light: rgb("--brand-light"),
        },
        ink: rgb("--ink"),
        canvas: rgb("--canvas"),
        surface: rgb("--surface"),
        success: rgb("--success"),
        warning: rgb("--warning"),
        destructive: rgb("--destructive"),
        // Cor oficial do WhatsApp (botões "Falar com a Simone")
        whatsapp: { DEFAULT: "#25D366", dark: "#1EBE5B" },
        // Nomes históricos (gb-blue é o vermelho da marca) — aliases dos tokens acima
        gb: {
          blue: rgb("--brand"),
          "blue-dark": rgb("--brand-dark"),
          "blue-light": rgb("--brand-light"),
          black: rgb("--ink"),
          white: "#FFFFFF",
          gray: rgb("--canvas"),
          "gray-dark": "#6B7280",
        },
      },
      fontFamily: {
        sans: ["var(--font-sf-pro)", "system-ui", "sans-serif"],
        display: ["var(--font-sf-pro)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      transitionTimingFunction: {
        "out-expo": "var(--ease-out)",
      },
      transitionDuration: {
        fast: "var(--dur-fast)",
        base: "var(--dur-base)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
