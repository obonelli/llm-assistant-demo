"use client";
import { useEffect, useRef, useState } from "react";
import { LASER_SPEED, LASER_INHERIT_SHIP_VEL } from "./cursor/constants";
import { clamp } from "./cursor/math";

const SHOT_WINDOW_MS = 3000;
const SHOTS_TO_SPAWN = 8;
const DESPAWN_AFTER_IDLE = 6000;

const NPC_COLOR = "#ff7cf3";
const NPC_SIZE = 56;

// Geometría del SVG (viewBox 48)
const VIEWBOX = 48, CENTER = 24, NOSE_X = 40;
const NOSE_OFFSET_PX = ((NOSE_X - CENTER) * NPC_SIZE) / VIEWBOX; // ≈18.7px
const NOSE_FUDGE = 2;

// Escort offset RELATIVO a la nave (se rota por heading)
const OFFSET_X = -120;
const OFFSET_Y = -80;

type Mode = "escort" | "patrol" | "engage" | "evade";

export default function Wingman() {
    const [active, setActive] = useState(false);
    const [phrase, setPhrase] = useState<string | null>(null);

    const iw = typeof window !== "undefined" ? window.innerWidth : 0;
    const ih = typeof window !== "undefined" ? window.innerHeight : 0;

    // Player
    const player = useRef({ x: iw / 2, y: ih / 2, heading: 0, vx: 0, vy: 0 });
    const lastSeenPlayerShot = useRef(0);
    const shots = useRef<number[]>([]);

    // Wingman (visual y control)
    const pos = useRef({ x: iw / 2 - 120, y: ih / 2 - 80 });
    const vel = useRef({ vx: 0, vy: 0 });
    const headingVisualDeg = useRef(0); // para rotar el sprite

    // FSM/IA
    const modeRef = useRef<Mode>("escort");
    const waypointRef = useRef<{ x: number; y: number } | null>(null);

    // Burst autónomo
    const burstRef = useRef<{ endsAt: number; cadence: number; lastShot: number; spread: number } | null>(null);

    const phraseTimeout = useRef<number | null>(null);
    const say = (text: string, ms = 1200) => {
        setPhrase(text);
        if (phraseTimeout.current) window.clearTimeout(phraseTimeout.current);
        phraseTimeout.current = window.setTimeout(() => setPhrase(null), ms);
    };

    // Pos instantánea (offset rotado por heading del player)
    const escortInstant = () => {
        const ang = (player.current.heading * Math.PI) / 180;
        const cos = Math.cos(ang), sin = Math.sin(ang);
        const rx = OFFSET_X * cos - OFFSET_Y * sin;
        const ry = OFFSET_X * sin + OFFSET_Y * cos;
        return { x: player.current.x + rx, y: player.current.y + ry };
    };

    // Disparo 1× (función común)
    const fireOnce = (dirRad: number) => {
        const dirx = Math.cos(dirRad), diry = Math.sin(dirRad);
        // origen: punta del wingman; si hay waypoint, usa su posición visual actual
        const base = waypointRef.current ? { x: pos.current.x, y: pos.current.y } : escortInstant();
        const nose = NOSE_OFFSET_PX + NOSE_FUDGE;
        const baseX = base.x + dirx * nose;
        const baseY = base.y + diry * nose;

        const vx =
            dirx * LASER_SPEED +
            (player.current.vx + vel.current.vx) * LASER_INHERIT_SHIP_VEL * 0.5;
        const vy =
            diry * LASER_SPEED +
            (player.current.vy + vel.current.vy) * LASER_INHERIT_SHIP_VEL * 0.5;

        window.dispatchEvent(new CustomEvent("spawn-laser", { detail: { x: baseX, y: baseY, vx, vy } }));
    };

    // 1) Eventos básicos (seguir player, activar por ráfaga tuya)
    useEffect(() => {
        const onShipState = (e: Event) => {
            const d = (e as CustomEvent<any>).detail;
            if (!d) return;
            player.current = { ...player.current, ...d };
        };

        const onPlayerShot = (e: Event) => {
            const t = (e as CustomEvent<{ time: number }>).detail?.time ?? performance.now();
            lastSeenPlayerShot.current = t;
            shots.current.push(t);
            const cutoff = t - SHOT_WINDOW_MS;
            while (shots.current.length && shots.current[0] < cutoff) shots.current.shift();

            if (!active && shots.current.length >= SHOTS_TO_SPAWN) {
                setActive(true);
                say("¡Refuerzos llegando!");
            }
            // Ya NO disparamos aquí: wingman dispara por su cuenta con bursts de la IA
        };

        window.addEventListener("ship-state", onShipState);
        window.addEventListener("laser-fired", onPlayerShot);

        return () => {
            window.removeEventListener("ship-state", onShipState);
            window.removeEventListener("laser-fired", onPlayerShot);
            if (phraseTimeout.current) window.clearTimeout(phraseTimeout.current);
        };
    }, [active]);

    // 2) Bucle visual/mecánico (RAF): movimiento + burst autónomo + despawn
    useEffect(() => {
        let raf = 0;
        const loop = () => {
            // despawn si tú dejas de disparar un rato
            if (active && performance.now() - lastSeenPlayerShot.current > DESPAWN_AFTER_IDLE) {
                setActive(false);
                waypointRef.current = null;
                burstRef.current = null;
            }

            // target: waypoint IA o escolta instantánea
            const escortPos = escortInstant();
            const target = waypointRef.current ?? escortPos;

            // mover suavizado hacia el target (visual)
            const dx = target.x - pos.current.x;
            const dy = target.y - pos.current.y;
            const sp = Math.hypot(dx, dy);
            const a = clamp(0.22 + sp * 0.0010, 0.22, 0.42); // un poco más reactivo
            pos.current.x += dx * a;
            pos.current.y += dy * a;

            vel.current.vx = dx * a * 60;
            vel.current.vy = dy * a * 60;

            // limpiar waypoint si “llegó”
            if (waypointRef.current && sp < 14) {
                waypointRef.current = null;
            }

            // heading visual: hacia el waypoint si existe; si no, tu mismo heading
            const dirRad = waypointRef.current
                ? Math.atan2(waypointRef.current.y - pos.current.y, waypointRef.current.x - pos.current.x)
                : (player.current.heading * Math.PI) / 180;
            headingVisualDeg.current = (dirRad * 180) / Math.PI;

            // burst autónomo (si está programado por la IA)
            const b = burstRef.current;
            if (active && b) {
                const now = performance.now();
                if (now < b.endsAt) {
                    if (now - b.lastShot >= b.cadence) {
                        const spread = b.spread || 0;
                        const shotDir = dirRad + (Math.random() - 0.5) * spread * 2;
                        fireOnce(shotDir);
                        b.lastShot = now;
                    }
                } else {
                    burstRef.current = null;
                }
            }

            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [active]);

    // —— Util: tomar letras destructibles como “enemigos” ——
    const collectDamageableTargets = () => {
        const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-damageable="true"]'));
        const enemies = nodes.map((el, idx) => {
            const r = el.getBoundingClientRect();
            return {
                id: el.id || `letter-${idx}`,
                x: r.left + r.width / 2,
                y: r.top + r.height / 2,
                size: Math.max(r.width, r.height),
                visible: r.width > 0 && r.height > 0,
                threat: 0.5,
            };
        });
        return enemies;
    };

    // 3) Cerebro IA: consulta al backend cada ~0.8s y aplica acciones (con letras como enemigos)
    useEffect(() => {
        if (!active) return;

        let timer: number | null = null;

        const tickAI = async () => {
            try {
                const snapshot = {
                    time: Date.now(),
                    dims: { width: window.innerWidth, height: window.innerHeight },
                    player: { ...player.current, firing: performance.now() - lastSeenPlayerShot.current < 300 },
                    wingman: { x: pos.current.x, y: pos.current.y, heading: headingVisualDeg.current, mode: modeRef.current },
                    enemies: collectDamageableTargets(), // 👈 letras destructibles como blancos
                };

                const res = await fetch("/api/wingman/decide", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(snapshot),
                });
                const data = (await res.json()) as { actions?: any[] };

                // — Normalización de acciones: acepta formato A (keys anidadas) o B (type plano)
                const normalize = (a: any) => {
                    if (!a) return null;
                    if (a.type) return a;
                    if (a.move_to) return { type: "move_to", ...a.move_to };
                    if (a.fire_burst) return { type: "fire_burst", ...a.fire_burst };
                    if (a.set_mode) return { type: "set_mode", ...a.set_mode };
                    if (a.say) return { type: "say", ...a.say };
                    if (a.despawn) return { type: "despawn" };
                    return null;
                };

                const actions = (data?.actions ?? [])
                    .map(normalize)
                    .filter(Boolean) as any[];

                for (const a of actions) {
                    if (a.type === "set_mode") {
                        modeRef.current = a.mode;
                    } else if (a.type === "move_to") {
                        const x = clamp(Number(a.x), 0, window.innerWidth);
                        const y = clamp(Number(a.y), 0, window.innerHeight);
                        waypointRef.current = { x, y };
                    } else if (a.type === "fire_burst") {
                        const cadence = clamp(Number(a.cadence_ms) || 160, 60, 400);
                        const duration = clamp(Number(a.duration_ms) || 900, 200, 2400);
                        const spread = Math.max(0, Math.min(0.08, Number(a.spread) ?? 0.02));
                        burstRef.current = { endsAt: performance.now() + duration, cadence, lastShot: 0, spread };
                    } else if (a.type === "say") {
                        if (typeof a.text === "string" && a.text.trim()) say(a.text.trim());
                    } else if (a.type === "despawn") {
                        setActive(false);
                        waypointRef.current = null;
                        burstRef.current = null;
                    }
                }
            } catch {
                // fallo silencioso → heurística local mantiene escort/patrol
            } finally {
                timer = window.setTimeout(tickAI, 800); // siguiente tick (más ágil)
            }
        };

        tickAI();
        return () => { if (timer) window.clearTimeout(timer); };
    }, [active]);

    return (
        <>
            {active && (
                <div
                    className="wingman-ship"
                    style={{
                        position: "fixed",
                        width: NPC_SIZE,
                        height: NPC_SIZE,
                        left: pos.current.x - NPC_SIZE / 2,
                        top: pos.current.y - NPC_SIZE / 2,
                        transform: `rotate(${headingVisualDeg.current}deg)`,
                        transformOrigin: "50% 50%",
                        zIndex: 49,
                        pointerEvents: "none",
                    }}
                    aria-hidden
                >
                    <svg width={NPC_SIZE} height={NPC_SIZE} viewBox="0 0 48 48" style={{ position: "absolute", inset: 0 }}>
                        <defs>
                            <linearGradient id="npcGlow" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor={NPC_COLOR} stopOpacity="0.22" />
                                <stop offset="60%" stopColor={NPC_COLOR} stopOpacity="0.85" />
                                <stop offset="100%" stopColor="#fff" stopOpacity="0.9" />
                            </linearGradient>
                            <radialGradient id="npcHalo" cx="50%" cy="52%" r="56%">
                                <stop offset="0%" stopColor={NPC_COLOR} stopOpacity="0.18" />
                                <stop offset="100%" stopColor={NPC_COLOR} stopOpacity="0" />
                            </radialGradient>
                        </defs>
                        <circle cx="24" cy="24" r="12" fill="url(#npcHalo)" />
                        <path d="M9 24 L33 24" stroke="url(#npcGlow)" strokeWidth="1.6" strokeLinecap="round" />
                        <path d="M18 18 L26 24 L18 30" fill="none" stroke={NPC_COLOR} strokeWidth="1.25" />
                        <path d="M33 22.2 L40 24 L33 25.8 Z" fill="url(#npcGlow)" stroke="#ffd6f9" strokeWidth="0.8" />
                    </svg>

                    {phrase && (
                        <div
                            style={{
                                position: "absolute",
                                left: "50%",
                                top: -18,
                                transform: "translateX(-50%)",
                                background: "rgba(255, 124, 243, .14)",
                                border: "1px solid rgba(255,124,243,.35)",
                                color: "rgba(255,255,255,.9)",
                                padding: "2px 6px",
                                borderRadius: 8,
                                fontSize: 11,
                                whiteSpace: "nowrap",
                                backdropFilter: "blur(2px)",
                            }}
                        >
                            {phrase}
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
