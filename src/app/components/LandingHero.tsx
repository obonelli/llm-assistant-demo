// src/app/components/LandingHero.tsx
"use client";

import PointerFX from "@/app/components/PointerFX";
import CursorShip from "@/app/components/CursorShip";
import DestructibleTitle from "@/app/components/DestructibleTitle";
import Wingman from "@/app/components/Wingman";
import WingmanPrompt from "@/app/components/WingmanPrompt";

export default function LandingHero() {
    return (
        // 👉 take exactly the viewport height minus the navbar (no scroll)
        <main
            className="relative bg-tech overflow-hidden isolate"
            style={{ minHeight: "calc(100dvh - var(--nav-h))" }}
        >
            <WingmanPrompt
                prompt="You are a professional tactical copilot. Speak little, in calm and neutral English.
        Only 'say' if it adds value: maximum 1 short sentence."
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

                {/* shorter title + bigger leading to avoid clipping descenders */}
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

            {/* ─────────────────────────────────────────────
                HUD / Arcade instructions (bottom-right)
               ───────────────────────────────────────────── */}
            <div
                className="pointer-events-none absolute bottom-4 right-4 sm:bottom-5 sm:right-6"
                aria-live="polite"
            >
                <div
                    className="
                        pointer-events-auto
                        select-none
                        rounded-xl border border-white/15
                        bg-black/45 backdrop-blur-md
                        shadow-[0_0_0_1px_rgba(255,255,255,.06),0_0_30px_rgba(0,255,255,.18)]
                        px-4 py-3 sm:px-5 sm:py-4
                        text-left"
                    role="region"
                    aria-label="Game instructions"
                >
                    <div className="text-[11px] tracking-widest text-cyanFx/90 font-semibold uppercase">
                        How to play
                    </div>

                    <ul className="mt-1.5 space-y-1.5 text-sm leading-tight">
                        <li className="text-white/85">
                            🖱️ <span className="font-medium">Mouse</span> — move your ship.
                        </li>
                        <li className="text-white/85 flex items-center gap-2">
                            <kbd className="rounded border border-white/25 bg-white/10 px-2 py-[2px] text-xs font-semibold shadow-[inset_0_-1px_0_rgba(255,255,255,.2)]">
                                Space
                            </kbd>
                            <span>shoot projectiles.</span>
                            <span className="ml-1 animate-pulse text-cyanFx/90">●</span>
                        </li>
                        <li className="text-white/85">
                            💥 Destroy the title letters to clear the screen.
                        </li>
                    </ul>

                    <div className="mt-2 text-[11px] text-white/50">
                        Tip: hold <kbd className="px-1 border border-white/25 bg-white/10 text-xs rounded">Space</kbd> for bursts.
                    </div>
                </div>
            </div>
        </main>
    );
}
