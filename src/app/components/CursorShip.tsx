"use client";
import { useRef } from "react";
import LaserLayer from "./cursor/LaserLayer";
import { useShipController } from "./cursor/useShipController";

export default function CursorShip() {
    const shipRef = useRef<HTMLDivElement>(null!);
    const {
        pos, shipVel, headingRenderRef, liftRef, damageTargets
    } = useShipController(shipRef);

    return (
        <>
            <LaserLayer
                posRef={pos}
                shipVelRef={shipVel}
                headingRenderRef={headingRenderRef}
                liftRef={liftRef}
                damageTargetsRef={damageTargets}
            />

            {/* Contenedor 72×72 */}
            <div
                ref={shipRef}
                className="ship-cursor"
                aria-hidden
                style={{
                    willChange: "transform",
                    width: 72, height: 72, position: "fixed", left: 0, top: 0,
                    transformOrigin: "50% 50%", zIndex: 50
                }}
            >
                <div className="ship-downwash" />

                {/* Volando */}
                <svg width="72" height="72" viewBox="0 0 48 48" className="ship-fly"
                    style={{ position: "absolute", inset: 0, opacity: 1, transition: "opacity .18s ease" }}>
                    <defs>
                        <linearGradient id="cyanglow1" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#18C8FF" stopOpacity="0.22" />
                            <stop offset="60%" stopColor="#18C8FF" stopOpacity="0.85" />
                            <stop offset="100%" stopColor="#7CDBFF" stopOpacity="1" />
                        </linearGradient>
                        <radialGradient id="halo1" cx="50%" cy="52%" r="56%">
                            <stop offset="0%" stopColor="#18C8FF" stopOpacity="0.18" />
                            <stop offset="100%" stopColor="#18C8FF" stopOpacity="0" />
                        </radialGradient>
                    </defs>
                    <circle cx="24" cy="24" r="12" fill="url(#halo1)" />
                    <path d="M9 24 L33 24" stroke="url(#cyanglow1)" strokeWidth="1.6" strokeLinecap="round" />
                    <path d="M18 18 L26 24 L18 30" fill="none" stroke="rgba(24,200,255,.7)" strokeWidth="1.35" />
                    <path d="M11 22 L15 24 L11 26" fill="none" stroke="rgba(24,200,255,.5)" strokeWidth="1.1" />
                    <path d="M33 22.2 L40 24 L33 25.8 Z"
                        fill="url(#cyanglow1)" stroke="#A6E9FF" strokeWidth="0.85" />
                </svg>

                {/* Aterrizando */}
                <svg width="72" height="72" viewBox="0 0 48 48" className="ship-land"
                    style={{ position: "absolute", inset: 0, opacity: 0, transition: "opacity .18s ease" }}>
                    <defs>
                        <linearGradient id="cyanglow2" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#18C8FF" stopOpacity="0.2" />
                            <stop offset="55%" stopColor="#18C8FF" stopOpacity="0.8" />
                            <stop offset="100%" stopColor="#7CDBFF" stopOpacity="1" />
                        </linearGradient>
                        <radialGradient id="halo2" cx="50%" cy="62%" r="62%">
                            <stop offset="0%" stopColor="#18C8FF" stopOpacity="0.16" />
                            <stop offset="100%" stopColor="#18C8FF" stopOpacity="0" />
                        </radialGradient>
                    </defs>
                    <ellipse cx="24" cy="28" rx="14" ry="8" fill="url(#halo2)" />
                    <path d="M12 24 L32 24" stroke="url(#cyanglow2)" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M22 26 L22 30 M26 26 L26 30" stroke="#7CDBFF"
                        strokeWidth="1.1" strokeLinecap="round" />
                    <circle cx="22" cy="31.2" r="1.6" fill="#9BE7FF" />
                    <circle cx="26" cy="31.2" r="1.6" fill="#9BE7FF" />
                    <path d="M24 20 L24 23" stroke="rgba(124,219,255,.9)" strokeWidth="1.1" strokeLinecap="round" />
                    <path d="M22.5 22 L24 23.5 L25.5 22"
                        fill="none" stroke="rgba(124,219,255,.9)" strokeWidth="1.1" />
                </svg>
            </div>
        </>
    );
}
