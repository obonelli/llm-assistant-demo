// src/app/components/LandingHero.tsx
"use client";

import PointerFX from "@/app/components/PointerFX";
import CursorShip from "@/app/components/CursorShip";
import DestructibleTitle from "@/app/components/DestructibleTitle";
import Wingman from "@/app/components/Wingman";
import WingmanPrompt from "@/app/components/WingmanPrompt";

export default function LandingHero() {
    return (
        // 👉 ocupa exactamente el alto del viewport menos la navbar (sin scroll)
        <main
            className="relative bg-tech overflow-hidden isolate"
            style={{ minHeight: "calc(100dvh - var(--nav-h))" }}
        >
            <WingmanPrompt
                prompt="Eres un copiloto táctico profesional. Habla poco, en español neutro,
        tono calmado y útil. Solo 'say' cuando aporte algo: máximo 1 frase corta."
            />

            <PointerFX />
            <CursorShip />
            <Wingman />

            <div className="grid-dent" aria-hidden />
            <div className="scanlines" />

            <section className="relative max-w-6xl mx-auto px-6 pt-40 pb-28 text-center">
                <div
                    className="absolute left-1/2 -translate-x-1/2 -top-24 w-[560px] h-[560px] rounded-full blur-3xl opacity-50 animate-[pulse_6s_ease-in-out_infinite]"
                    style={{
                        background:
                            "radial-gradient(circle, rgba(25,200,255,.25), rgba(232,67,147,.16) 45%, rgba(124,58,237,.14) 70%, transparent 75%)",
                    }}
                />

                {/* título más corto + leading mayor para evitar cortes de descendentes */}
                <DestructibleTitle
                    text={"Create modern apps with refined UI"}
                    className="text-balance text-5xl sm:text-7xl font-extrabold leading-[1.12] sm:leading-[1.1] tracking-tight"
                />

                <p className="mt-5 text-white/70 max-w-2xl mx-auto">
                    Modern stack with Next.js, refined UI and senior-level performance.
                    Live demo, dashboards and an in-house component library.
                </p>

                <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
                    {[
                        { k: "SSR/ISR", d: "SEO + speed with App Router and smart caching." },
                        { k: "UI System", d: "MUI + Tailwind, dark theme and pro components." },
                        { k: "AI-ready", d: "Future integration with Vercel AI / OpenAI." },
                    ].map((f) => (
                        <div key={f.k} className="holo-card p-4 rounded-xl">
                            <div className="text-sm text-cyanFx">{f.k}</div>
                            <div className="text-white/80">{f.d}</div>
                        </div>
                    ))}
                </div>
            </section>
        </main>
    );
}
