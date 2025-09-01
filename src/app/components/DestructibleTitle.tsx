// ./src/app/components/DestructibleTitle.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";

/** Modo mantequilla: tiempos base + jitter por letra (ms) */
const RESPAWN_DELAY_MS = 2600;          // espera mínima tras caer
const RESPAWN_DELAY_JITTER_MS = 900;    // +0..900ms extra por letra
const RESPAWN_TIME_MS = 1400;           // curación mínima (d→0)
const RESPAWN_TIME_JITTER_MS = 400;     // +0..400ms extra por letra

type Props = { text: string; className?: string };

/** Permite pasar CSS custom properties sin usar `any` */
type CSSVars = React.CSSProperties & { [key: `--${string}`]: string | number };

export default function DestructibleTitle({ text, className }: Props) {
    const rootRef = useRef<HTMLHeadingElement | null>(null);

    const nodes = useMemo(() => {
        const arr: { ch: string; key: string; isSpace: boolean }[] = [];
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            arr.push({ ch, key: `${i}-${ch}`, isSpace: ch === " " });
        }
        return arr;
    }, [text]);

    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;

        const letters = Array.from(
            root.querySelectorAll<HTMLSpanElement>(".damageable-letter")
        );

        // Semillas/umbrales + jitter por letra
        for (let i = 0; i < letters.length; i++) {
            const span = letters[i];
            const r = rng(i + 2025);

            const drift = 10 + r() * 28;
            const dir = r() < 0.5 ? -1 : 1;
            const rot = (10 + r() * 22) * dir;
            const fallThreshold = 0.66 + r() * 0.2;
            const delay = r() * 140;

            const respawnDelay = Math.round(
                RESPAWN_DELAY_MS + r() * RESPAWN_DELAY_JITTER_MS
            );
            const respawnTime = Math.round(
                RESPAWN_TIME_MS + r() * RESPAWN_TIME_JITTER_MS
            );

            span.style.setProperty("--sx", String(drift * dir));
            span.style.setProperty("--rotF", String(rot));
            span.style.setProperty("--fallDelay", `${Math.round(delay)}ms`);
            span.dataset.fallThreshold = fallThreshold.toFixed(3);
            span.dataset.fallen = "0";
            span.dataset.respawning = "0";
            span.dataset.respawnDelay = String(respawnDelay);
            span.dataset.respawnTime = String(respawnTime);
        }

        // Flash + jitter al impacto (lo dispara LaserLayer)
        const onLetterHit = (e: Event) => {
            const { el } = (e as CustomEvent<{ el: unknown }>).detail || {};
            if (!(el instanceof HTMLElement)) return;
            if (!el.classList.contains("damageable-letter")) return;
            el.classList.add("hit");
            window.setTimeout(() => el.classList.remove("hit"), 140);
        };
        window.addEventListener("letter-hit", onLetterHit);

        // Si --d supera el umbral => .fall
        let raf = 0;
        const step = () => {
            for (const span of letters) {
                if (span.dataset.fallen === "1") continue;
                const th = Number(span.dataset.fallThreshold || "0.8");
                const d =
                    parseFloat(getComputedStyle(span).getPropertyValue("--d") || "0") || 0;
                if (d >= th) {
                    span.classList.add("fall");
                    span.dataset.fallen = "1";
                }
            }
            raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);

        // Al terminar la anim de caída → ocultar, esperar y curar (invisible)
        const onAnimEnd = (ev: AnimationEvent) => {
            const t = ev.target as HTMLElement;
            if (!t.classList.contains("damageable-letter")) return;

            if (t.classList.contains("fall") && ev.animationName === "letter-fall") {
                t.classList.add("gone"); // oculta y NO vuelve a mostrarse hasta 100% curada
                if (t.dataset.respawning !== "1") {
                    t.dataset.respawning = "1";
                    const delay = Number(t.dataset.respawnDelay || RESPAWN_DELAY_MS);
                    window.setTimeout(
                        () => healInvisibleAndShow(t as HTMLSpanElement),
                        delay
                    );
                }
            }
        };
        root.addEventListener("animationend", onAnimEnd);

        // 🔑 Curamos --d a 0 mientras sigue oculta (.gone). Solo la mostramos cuando termina.
        function healInvisibleAndShow(span: HTMLSpanElement) {
            // Asegurarnos de que siga oculta durante la curación
            span.classList.add("gone");
            span.classList.remove("fall", "respawning");

            const start = performance.now();
            const startD =
                parseFloat(getComputedStyle(span).getPropertyValue("--d") || "1") || 1;
            const dur = Number(span.dataset.respawnTime || RESPAWN_TIME_MS);

            const heal = (ts: number) => {
                const t = Math.min(1, (ts - start) / dur);
                const e = Math.sin((t * Math.PI) / 2); // easeOutSine
                const dNow = startD * (1 - e);
                span.style.setProperty("--d", dNow.toFixed(3));

                if (t < 1) {
                    requestAnimationFrame(heal);
                } else {
                    // 100% curada -> ahora sí la mostramos con la anim de respawn
                    span.style.setProperty("--d", "0");
                    span.dataset.fallen = "0";
                    span.dataset.respawning = "0";
                    // Mostrar y animar entrada
                    span.classList.add("respawning");
                    span.classList.remove("gone");
                    // Al terminar la anim, limpiar clase
                    const onEnd = (ev: AnimationEvent) => {
                        if (ev.animationName === "letter-respawn") {
                            span.classList.remove("respawning");
                            span.removeEventListener("animationend", onEnd);
                        }
                    };
                    span.addEventListener("animationend", onEnd);
                }
            };
            requestAnimationFrame(heal);
        }

        return () => {
            cancelAnimationFrame(raf);
            root.removeEventListener("animationend", onAnimEnd);
            window.removeEventListener("letter-hit", onLetterHit);
        };
    }, []);

    // Estilo base para inicializar la variable CSS --d
    const letterBaseStyle: CSSVars = { "--d": 0 };

    return (
        <h1 ref={rootRef} className={`destructible-wrap ${className ?? ""}`}>
            {nodes.map((n, idx) =>
                n.isSpace ? (
                    <span key={n.key} className="space" aria-hidden="true" />
                ) : (
                    <span
                        key={n.key}
                        className="damageable-letter"
                        data-damageable="true"
                        data-idx={idx}
                        style={letterBaseStyle}
                    >
                        {n.ch}
                    </span>
                )
            )}
        </h1>
    );
}

/** PRNG simple */
function rng(seed: number) {
    return function () {
        let t = (seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
