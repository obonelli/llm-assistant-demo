// tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
    content: ["./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                // Base dark
                ink: "#0B0B0F",
                noir: "#0F1218",
                slate: "#1A1F29",
                // Accents tech
                cyanFx: "#19C8FF",
                violetFx: "#7C3AED",
                magentaFx: "#E84393",
                limeFx: "#9BE15D",
                crimson: "#DF1B3F",
            },
            boxShadow: {
                glow: "0 0 60px rgba(25,200,255,0.25)",
                glow2: "0 0 140px rgba(124,58,237,0.18)",
            },
        },
    },
    plugins: [],
} satisfies Config;
