// src/app/components/AirportFooter.tsx (o donde lo tengas)
"use client";
import React, { useMemo, useRef, useState } from "react";

/** Permite usar custom properties CSS con tipado seguro */
type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>;

export default function AirportFooter() {
    const H = "clamp(200px, 26vh, 360px)";
    const lights = useMemo(() => Array.from({ length: 22 }), []);
    const [active, setActive] = useState(false);

    // Flechas
    const RIGHT_N = 16; // abajo → derecha
    const LEFT_N = 16;  // arriba ← izquierda

    // ---- Proximidad para 2 hangares (lado izquierdo) ----
    const hangarsRef = useRef<Array<HTMLDivElement | null>>([]);
    const [near, setNear] = useState<boolean[]>([false, false]);

    const handleMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
        const threshold = 120; // px para encender glow
        const x = e.clientX;
        const y = e.clientY;

        const updated = hangarsRef.current.map((el) => {
            if (!el) return false;
            const r = el.getBoundingClientRect();
            const cx = Math.max(r.left, Math.min(x, r.right));
            const cy = Math.max(r.top, Math.min(y, r.bottom));
            return Math.hypot(x - cx, y - cy) < threshold;
        });
        setNear(updated);
    };

    const clearNear = () => setNear([false, false]);

    return (
        <>
            <div
                className="airport-spacer"
                style={{ height: `calc(${H} + env(safe-area-inset-bottom, 0px))` }}
                aria-hidden
            />

            <footer
                className="airport-footer"
                style={{ "--airport-h": H } as CSSVars}
                aria-hidden={false}
            >
                <div className="airport-glow" />

                <div className={`runway ${active ? "active" : ""}`}>
                    {/* Glow y borde principal */}
                    <div className="runway-edgeglow" />

                    {/* === Wings: dos rectángulos redondeados pegados a las esquinas === */}
                    <div className="runway-wings" aria-hidden>
                        <div className="runway-wing runway-wing--left" />
                        <div className="runway-wing runway-wing--right" />
                    </div>

                    {/* Contenido de la pista */}
                    <div
                        className="runway-inset"
                        onMouseEnter={() => setActive(true)}
                        onMouseLeave={() => {
                            setActive(false);
                            clearNear();
                        }}
                        onMouseMove={handleMove}
                    >
                        {/* Línea central */}
                        <div className="runway-centerline" />

                        {/* Luces */}
                        <div className="edge edge-left">
                            {lights.map((_, i) => (
                                <span key={`L${i}`} className="edge-light" />
                            ))}
                        </div>
                        <div className="edge edge-right">
                            {lights.map((_, i) => (
                                <span key={`R${i}`} className="edge-light" />
                            ))}
                        </div>

                        {/* SOLO 2 hangares al lado izquierdo */}
                        <div className="hangarsL" aria-hidden>
                            {Array.from({ length: 2 }).map((_, i) => (
                                <div
                                    key={`HL${i}`}
                                    ref={(el) => {
                                        hangarsRef.current[i] = el;
                                    }}
                                    className={`hangar ${near[i] ? "is-near" : ""}`}
                                />
                            ))}
                        </div>

                        {/* Flechas guía (derecha) */}
                        <div className="guidance guidance--right" aria-hidden>
                            {Array.from({ length: RIGHT_N }).map((_, i) => (
                                <span key={i} className="arrow" style={{ "--i": i } as CSSVars}>
                                    <svg width="22" height="12" viewBox="0 0 18 10" aria-hidden>
                                        <path d="M1 5 H13" stroke="#7CD8FF" strokeWidth="1.6" strokeLinecap="round" />
                                        <path d="M13 2 L17 5 L13 8" fill="none" stroke="#7CD8FF" strokeWidth="1.6" strokeLinecap="round" />
                                    </svg>
                                </span>
                            ))}
                        </div>

                        {/* Flechas guía (arriba, a la izquierda) */}
                        <div
                            className="guidance guidance--left"
                            style={{ "--n": LEFT_N } as CSSVars}
                            aria-hidden
                        >
                            {Array.from({ length: LEFT_N }).map((_, i) => (
                                <span
                                    key={i}
                                    className="arrow arrow--left"
                                    style={{ "--i": i } as CSSVars}
                                >
                                    <svg width="22" height="12" viewBox="0 0 18 10" aria-hidden>
                                        <path d="M1 5 H13" stroke="#7CD8FF" strokeWidth="1.6" strokeLinecap="round" />
                                        <path d="M13 2 L17 5 L13 8" fill="none" stroke="#7CD8FF" strokeWidth="1.6" strokeLinecap="round" />
                                    </svg>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </footer>
        </>
    );
}
