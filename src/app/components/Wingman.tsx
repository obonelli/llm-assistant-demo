// ./src/app/components/Wingman.tsx
"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { LASER_SPEED, LASER_INHERIT_SHIP_VEL } from "./cursor/constants";
import { clamp } from "./cursor/math";

const SHOT_WINDOW_MS = 3000;
const SHOTS_TO_SPAWN = 8;
const DESPAWN_AFTER_IDLE = 6000;

const NPC_COLOR = "#ff7cf3";
const NPC_SIZE = 56;

// SVG (viewBox 48)
const VIEWBOX = 48, CENTER = 24, NOSE_X = 40;
const NOSE_OFFSET_PX = ((NOSE_X - CENTER) * NPC_SIZE) / VIEWBOX;
const NOSE_FUDGE = 2;

// Offset base (se rota por heading del player)
const OFFSET_X = -120;
const OFFSET_Y = -80;

const POLL_MS = 800; // intervalo del /decide

type Mode = "escort" | "patrol" | "engage" | "evade";

// Acciones que la IA puede devolver
type WingmanAction =
    | { type: "say"; text: string }
    | { type: "set_mode"; mode: Mode }
    | { type: "move_to"; x: number; y: number }
    | { type: "fire_burst"; cadence_ms?: number; duration_ms?: number; spread?: number }
    | {
        type: "engage";
        move_to?: { x: number; y: number };
        fire_burst?: { cadence_ms?: number; duration_ms?: number; spread?: number };
    }
    | { type: "despawn" };

type ShipStateDetail = Partial<{
    x: number;
    y: number;
    heading: number;
    vx: number;
    vy: number;
}>;

export default function Wingman() {
    const [active, setActive] = useState(false);
    const [phrase, setPhrase] = useState<string | null>(null);

    const iw = typeof window !== "undefined" ? window.innerWidth : 0;
    const ih = typeof window !== "undefined" ? window.innerHeight : 0;

    // Player (filtrado)
    const player = useRef({ x: iw / 2, y: ih / 2, heading: 0, vx: 0, vy: 0 });
    const playerFilt = useRef({ x: iw / 2, y: ih / 2 });

    const lastSeenPlayerShot = useRef(0);
    const shots = useRef<number[]>([]);

    // Wingman físico
    const pos = useRef({ x: iw / 2 - 120, y: ih / 2 - 80 });
    const vel = useRef({ vx: 0, vy: 0 });
    const headingVisualDeg = useRef(0);
    const lastStableHeadingDeg = useRef(0);

    const wingRef = useRef<HTMLDivElement | null>(null);

    // IA / destino
    const modeRef = useRef<Mode>("escort");
    const waypointRef = useRef<{ x: number; y: number } | null>(null);
    const lastMoveCmd = useRef(0);

    // Filtros
    const escortOffsetFilt = useRef({ x: OFFSET_X, y: OFFSET_Y });

    // Burst
    const burstRef = useRef<{ endsAt: number; cadence: number; lastShot: number; spread: number } | null>(null);

    // Prompt dinámico del wingman → pedimos inglés y variación
    const wingPromptRef = useRef<string>(
        "Short radio chatter in ENGLISH. Calm, helpful. VARY wording over time. 2–5 words, minimal punctuation."
    );

    const phraseTimeout = useRef<number | null>(null);
    const sayBubble = useCallback((text: string, ms = 1200) => {
        setPhrase(text);
        if (phraseTimeout.current) window.clearTimeout(phraseTimeout.current);
        phraseTimeout.current = window.setTimeout(() => setPhrase(null), ms);
    }, []);

    // ====== VOZ (SpeechSynthesis) ======
    const ttsEnabledRef = useRef(true);
    const ttsReadyRef = useRef(false);
    const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
    const ttsQueueRef = useRef<string[]>([]);
    const ttsSpeakingRef = useRef(false);
    const lastSpokenAtRef = useRef(0);
    const MIN_TTS_COOLDOWN_MS = 1400; // anti-spam

    const pickEnglishVoice = (): SpeechSynthesisVoice | null => {
        const synth = window.speechSynthesis;
        const voices: SpeechSynthesisVoice[] = synth.getVoices();
        const preferred: Array<(v: SpeechSynthesisVoice) => boolean> = [
            (v) => /en-US/i.test(v.lang),
            (v) => /en-GB/i.test(v.lang),
            (v) => /^en/i.test(v.lang),
        ];
        for (const pred of preferred) {
            const found = voices.find(pred);
            if (found) return found;
        }
        return null;
    };

    const warmupTTS = () => {
        if (ttsReadyRef.current) return;
        try {
            const u = new SpeechSynthesisUtterance(" ");
            u.volume = 0;
            window.speechSynthesis.speak(u);
            ttsReadyRef.current = true;
        } catch {
            /* ignore */
        }
    };

    const processTTSQueue = useCallback(() => {
        if (!ttsEnabledRef.current || ttsSpeakingRef.current) return;
        const next = ttsQueueRef.current.shift();
        if (!next) return;

        try {
            warmupTTS();

            // 🔽 mover aquí el contenido de ensureVoiceLoaded
            const v = pickEnglishVoice();
            if (v) {
                voiceRef.current = v;
            } else {
                window.speechSynthesis.onvoiceschanged = () => {
                    voiceRef.current = pickEnglishVoice();
                    processTTSQueue();
                };
            }

            const u = new SpeechSynthesisUtterance(next);
            if (voiceRef.current) u.voice = voiceRef.current;
            u.rate = 1.05;
            u.pitch = 1.0;
            u.volume = 1.0;

            ttsSpeakingRef.current = true;
            u.onend = () => {
                ttsSpeakingRef.current = false;
                lastSpokenAtRef.current = performance.now();
                processTTSQueue();
            };
            u.onerror = () => {
                ttsSpeakingRef.current = false;
            };

            window.speechSynthesis.speak(u);
        } catch {
            /* ignore */
        }
    }, []);

    const enqueueTTS = useCallback(
        (text: string) => {
            if (!ttsEnabledRef.current) return;
            const now = performance.now();
            if (now - lastSpokenAtRef.current < MIN_TTS_COOLDOWN_MS) return;
            const last = ttsQueueRef.current.at(-1);
            if (last === text) return; // evita duplicado inmediato
            ttsQueueRef.current.push(text);
            processTTSQueue();
        },
        [processTTSQueue]
    );

    // ÚNICO canal para hablar: cuando la IA manda {type:"say"}
    const speak = useCallback(
        (text: string, bubbleMs = 1400) => {
            const clean = (text || "").trim();
            if (!clean) return;
            sayBubble(clean, bubbleMs);
            enqueueTTS(clean);
        },
        [enqueueTTS, sayBubble]
    );
    // ====== FIN VOZ ======

    // visibilidad / viewport
    const pageVisibleRef = useRef(true);
    const onScreenRef = useRef(true);
    const aiEnabledRef = useRef(false);
    const recomputeAIEnabled = useCallback(() => {
        aiEnabledRef.current = active && pageVisibleRef.current && onScreenRef.current;
    }, [active]);

    // —— Utils —— 
    const escortTarget = useCallback(() => {
        const ang = (player.current.heading * Math.PI) / 180;
        const cos = Math.cos(ang),
            sin = Math.sin(ang);

        const ox = OFFSET_X * cos - OFFSET_Y * sin;
        const oy = OFFSET_X * sin + OFFSET_Y * cos;

        // filtros
        const kOff = 0.16,
            kPl = 0.18;
        escortOffsetFilt.current.x += (ox - escortOffsetFilt.current.x) * kOff;
        escortOffsetFilt.current.y += (oy - escortOffsetFilt.current.y) * kOff;
        playerFilt.current.x += (player.current.x - playerFilt.current.x) * kPl;
        playerFilt.current.y += (player.current.y - playerFilt.current.y) * kPl;

        return {
            x: playerFilt.current.x + escortOffsetFilt.current.x,
            y: playerFilt.current.y + escortOffsetFilt.current.y,
        };
    }, []);

    const fireOnce = useCallback((dirRad: number) => {
        const dirx = Math.cos(dirRad),
            diry = Math.sin(dirRad);
        const base = pos.current;
        const nose = NOSE_OFFSET_PX + NOSE_FUDGE;
        const baseX = base.x + dirx * nose;
        const baseY = base.y + diry * nose;

        const vx =
            dirx * LASER_SPEED +
            (player.current.vx + vel.current.vx) * LASER_INHERIT_SHIP_VEL * 0.5;
        const vy =
            diry * LASER_SPEED +
            (player.current.vy + vel.current.vy) * LASER_INHERIT_SHIP_VEL * 0.5;

        window.dispatchEvent(
            new CustomEvent("spawn-laser", {
                detail: { x: baseX, y: baseY, vx, vy, owner: "wingman", color: NPC_COLOR },
            })
        );
    }, []);

    // ---- Helpers compartidos para IA ----
    const normalize = (a: unknown): WingmanAction | null => {
        if (!a || typeof a !== "object") return null;
        const obj = a as Record<string, unknown>;

        // formato 1: { type: "say" | "move_to" | ... , ... }
        if ("type" in obj) return obj as WingmanAction;

        // formato 2: { say: "text" }  ó { say: { text: "text" } }
        if ("say" in obj) {
            const say = obj.say as string | { text: string };
            const text = typeof say === "string" ? say : say?.text;
            if (typeof text === "string" && text.trim()) {
                return { type: "say", text: text.trim() };
            }
            return null;
        }

        // formato 3: { move_to: {...} }
        if ("move_to" in obj) return { type: "move_to", ...(obj.move_to as { x: number; y: number }) };

        // formato 4: { fire_burst: {...} }
        if ("fire_burst" in obj) return { type: "fire_burst", ...(obj.fire_burst as object) } as WingmanAction;

        // formato 5: { set_mode: {...} }
        if ("set_mode" in obj) return { type: "set_mode", ...(obj.set_mode as object) } as WingmanAction;

        // formato 6: { despawn: true }  ó { despawn: {} }
        if ("despawn" in obj) return { type: "despawn" };

        // formato 7: { engage: { move_to?, fire_burst? } }
        if ("engage" in obj) return { type: "engage", ...(obj.engage as object) } as WingmanAction;

        return null;
    };

    const applyActions = useCallback(
        (actions: WingmanAction[]) => {
            for (const a of actions) {
                if (!a) continue;
                if (a.type === "set_mode") {
                    modeRef.current = a.mode;
                } else if (a.type === "move_to") {
                    const now = performance.now();
                    if (now - lastMoveCmd.current < 600) continue;
                    lastMoveCmd.current = now;

                    let x = clamp(Number(a.x), 0, window.innerWidth);
                    let y = clamp(Number(a.y), 0, window.innerHeight);
                    const d = Math.hypot(x - pos.current.x, y - pos.current.y);
                    if (d < 24) continue;
                    if (d > 280) {
                        const f = 280 / d;
                        x = pos.current.x + (x - pos.current.x) * f;
                        y = pos.current.y + (y - pos.current.y) * f;
                    }
                    const cur = waypointRef.current ?? { x: pos.current.x, y: pos.current.y };
                    waypointRef.current = { x: (cur.x + x) * 0.5, y: (cur.y + y) * 0.5 };
                } else if (a.type === "fire_burst") {
                    const cadence = clamp(Number(a.cadence_ms) || 160, 80, 400);
                    const duration = clamp(Number(a.duration_ms) || 900, 200, 1800);
                    const spread = Math.max(0, Math.min(0.08, Number(a.spread) ?? 0.02));
                    burstRef.current = { endsAt: performance.now() + duration, cadence, lastShot: 0, spread };
                } else if (a.type === "engage") {
                    if (a.move_to) applyActions([{ type: "move_to", ...a.move_to }]);
                    if (a.fire_burst) applyActions([{ type: "fire_burst", ...a.fire_burst }]);
                } else if (a.type === "say") {
                    if (a.text.trim()) speak(a.text.trim());
                } else if (a.type === "despawn") {
                    setActive(false);
                    waypointRef.current = null;
                    burstRef.current = null;
                }
            }
        },
        [speak]
    );

    // Decide 1 vez (para la activación)
    const decideOnce = useCallback(async () => {
        try {
            const snapshot = {
                time: Date.now(),
                dims: { width: window.innerWidth, height: window.innerHeight },
                player: { ...player.current, firing: performance.now() - lastSeenPlayerShot.current < 300 },
                wingman: { x: pos.current.x, y: pos.current.y, heading: headingVisualDeg.current, mode: modeRef.current },
                enemies: collectDamageableTargets(),
                prompt: wingPromptRef.current, // pide inglés + variación
            };
            const res = await fetch("/api/wingman/decide", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(snapshot),
            });
            const data = (await res.json()) as { actions?: unknown[] };
            const actions = (data?.actions ?? []).map(normalize).filter(Boolean) as WingmanAction[];
            applyActions(actions);
        } catch {
            /* silencioso */
        }
    }, [applyActions]);

    // ======= Despedida vía IA cuando acaba la pelea (idle) =======
    const farewellPendingRef = useRef(false);

    const farewellOnce = useCallback(async () => {
        if (farewellPendingRef.current) return;
        farewellPendingRef.current = true;

        try {
            const snapshot = {
                time: Date.now(),
                dims: { width: window.innerWidth, height: window.innerHeight },
                player: { ...player.current, firing: false },
                wingman: { x: pos.current.x, y: pos.current.y, heading: headingVisualDeg.current, mode: modeRef.current },
                enemies: collectDamageableTargets(),
                // Prompt override: pedir SOLO una despedida breve en inglés
                prompt:
                    'Player is disengaging. Return EXACTLY ONE action: {"type":"say","text":"<short farewell, English, varied>"}. 2–5 words.',
            };

            const res = await fetch("/api/wingman/decide", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(snapshot),
            });
            const data = (await res.json()) as { actions?: unknown[] };
            const actions = (data?.actions ?? []).map(normalize).filter(Boolean) as WingmanAction[];

            // Forzamos a quedarnos solo con 'say' por seguridad
            const sayOnly = actions.find((a) => a?.type === "say") as { type: "say"; text: string } | undefined;
            if (sayOnly?.text) speak(String(sayOnly.text), 1400);
        } catch {
            // (opcional) fallback ultra corto si la IA falla totalmente:
            // speak("Good hunting.", 1200);
        } finally {
            // Desenganche tras dar tiempo a que se oiga la frase
            setTimeout(() => {
                setActive(false);
                waypointRef.current = null;
                burstRef.current = null;
                farewellPendingRef.current = false;
            }, 1200);
        }
    }, [speak]);
    // =============================================================

    // —— Eventos (estado de la nave, disparo del player) —— 
    useEffect(() => {
        const onShipState = (e: Event) => {
            const d = (e as CustomEvent<ShipStateDetail>).detail;
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
                warmupTTS(); // desbloquea voz
                void decideOnce(); // IA decide (incluye 'say' si quiere)
            }
        };

        window.addEventListener("ship-state", onShipState);
        window.addEventListener("laser-fired", onPlayerShot);

        return () => {
            window.removeEventListener("ship-state", onShipState);
            window.removeEventListener("laser-fired", onPlayerShot);
            if (phraseTimeout.current) window.clearTimeout(phraseTimeout.current);
        };
    }, [active, decideOnce]);

    // —— Eventos para prompt/voz desde la UI —— 
    useEffect(() => {
        const onSetPrompt = (e: Event) => {
            const txt = (e as CustomEvent<string>).detail;
            if (typeof txt === "string") wingPromptRef.current = txt;
        };
        const onSay = (e: Event) => {
            const txt = (e as CustomEvent<string>).detail;
            if (typeof txt === "string" && txt.trim()) speak(txt.trim());
        };
        window.addEventListener("wingman:set-prompt", onSetPrompt);
        window.addEventListener("wingman:say", onSay);
        return () => {
            window.removeEventListener("wingman:set-prompt", onSetPrompt);
            window.removeEventListener("wingman:say", onSay);
        };
    }, [speak]);

    // Page Visibility → pausa IA cuando la pestaña está oculta
    useEffect(() => {
        const onVis = () => {
            pageVisibleRef.current = !document.hidden;
            recomputeAIEnabled();
            if (!document.hidden) processTTSQueue();
        };
        document.addEventListener("visibilitychange", onVis);
        onVis();
        return () => document.removeEventListener("visibilitychange", onVis);
    }, [active, recomputeAIEnabled, processTTSQueue]);

    // IntersectionObserver del wingman → pausa IA si no está en viewport
    useEffect(() => {
        if (!active) return;
        const el = wingRef.current;
        if (!el) return;
        const io = new IntersectionObserver(
            (entries) => {
                onScreenRef.current = entries[0]?.isIntersecting ?? true;
                recomputeAIEnabled();
            },
            { root: null, threshold: 0 }
        );
        io.observe(el);
        return () => io.disconnect();
    }, [active, recomputeAIEnabled]);

    // —— Bucle físico/visual —— 
    useEffect(() => {
        let raf = 0;
        let prev = performance.now();
        const HALF = NPC_SIZE / 2;

        const MAX_SPEED = 520; // px/s
        const MAX_ACCEL = 1600; // px/s^2
        const MAX_TURN_RATE = 360; // deg/s
        const ANG_DEADBAND = 3; // deg

        const ARRIVE_START = 160;
        const ARRIVE_END = 36;

        const loop = () => {
            const now = performance.now();
            const dt = Math.min(0.05, (now - prev) / 1000);
            prev = now;

            // —— Inactividad: pedir despedida a la IA y luego despawn
            if (active && now - lastSeenPlayerShot.current > DESPAWN_AFTER_IDLE) {
                if (!farewellPendingRef.current) {
                    farewellOnce(); // IA elige la frase de despedida
                }
            }

            // destino
            const escortPos = escortTarget();
            const dest = waypointRef.current ?? escortPos;

            // física tipo resorte
            const dx = dest.x - pos.current.x;
            const dy = dest.y - pos.current.y;
            const dist = Math.hypot(dx, dy);

            const freq = dist > ARRIVE_START ? 6.0 : 3.2 + 2.8 * (dist / ARRIVE_START);
            const k = (2 * Math.PI * freq) ** 2;
            const c = 2 * Math.sqrt(k);

            const ax = clamp(k * dx - c * vel.current.vx, -MAX_ACCEL, MAX_ACCEL);
            const ay = clamp(k * dy - c * vel.current.vy, -MAX_ACCEL, MAX_ACCEL);

            vel.current.vx = clamp(vel.current.vx + ax * dt, -MAX_SPEED, MAX_SPEED);
            vel.current.vy = clamp(vel.current.vy + ay * dt, -MAX_SPEED, MAX_SPEED);

            if (dist < ARRIVE_START) {
                const t = clamp((dist - ARRIVE_END) / (ARRIVE_START - ARRIVE_END), 0, 1);
                vel.current.vx *= t;
                vel.current.vy *= t;
            }

            pos.current.x += vel.current.vx * dt;
            pos.current.y += vel.current.vy * dt;

            // limpiar waypoint con histéresis
            if (waypointRef.current && dist < ARRIVE_END) waypointRef.current = null;

            // rumbo: anti-spin
            const speed = Math.hypot(vel.current.vx, vel.current.vy);
            const toDestRad = Math.atan2(dest.y - pos.current.y, dest.x - pos.current.x);
            let desiredDeg = (toDestRad * 180) / Math.PI;

            if (dist < ARRIVE_END || speed < 30) {
                desiredDeg = lastStableHeadingDeg.current;
            } else {
                lastStableHeadingDeg.current = desiredDeg;
            }

            const cur = headingVisualDeg.current;
            let delta = ((desiredDeg - cur + 540) % 360) - 180;
            if (Math.abs(delta) <= ANG_DEADBAND) {
                headingVisualDeg.current = desiredDeg;
            } else {
                const maxStep = MAX_TURN_RATE * dt;
                delta = clamp(delta, -maxStep, maxStep);
                headingVisualDeg.current = cur + delta;
            }

            // pintar
            const el = wingRef.current;
            if (el) {
                el.style.transform = `translate3d(${pos.current.x - HALF}px, ${pos.current.y - HALF}px, 0) rotate(${headingVisualDeg.current}deg)`;
            }

            // burst
            const b = burstRef.current;
            if (active && b) {
                if (now < b.endsAt) {
                    if (now - b.lastShot >= b.cadence) {
                        const spread = b.spread || 0;
                        const shotDir = toDestRad + (Math.random() - 0.5) * spread * 2;
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
    }, [active, escortTarget, farewellOnce, fireOnce]);

    // “enemigos” (letras)
    const collectDamageableTargets = () => {
        const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-damageable="true"]'));
        return nodes.map((el, idx) => {
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
    };

    // IA (poll con pausa por visibilidad/viewport)
    useEffect(() => {
        if (!active) return;

        let timer: number | null = null;
        let cancelled = false;
        const lastAbortRef = { current: null as AbortController | null };

        const tickAI = async () => {
            if (cancelled || !aiEnabledRef.current) return;

            const abort = new AbortController();
            lastAbortRef.current?.abort();
            lastAbortRef.current = abort;

            try {
                const snapshot = {
                    time: Date.now(),
                    dims: { width: window.innerWidth, height: window.innerHeight },
                    player: { ...player.current, firing: performance.now() - lastSeenPlayerShot.current < 300 },
                    wingman: { x: pos.current.x, y: pos.current.y, heading: headingVisualDeg.current, mode: modeRef.current },
                    enemies: collectDamageableTargets(),
                    prompt: wingPromptRef.current,
                };

                const res = await fetch("/api/wingman/decide", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(snapshot),
                    signal: abort.signal,
                });
                const data = (await res.json()) as { actions?: unknown[] };

                const actions = (data?.actions ?? []).map(normalize).filter(Boolean) as WingmanAction[];
                applyActions(actions);
            } catch {
                /* silencio */
            } finally {
                const idle = !aiEnabledRef.current || !(performance.now() - lastSeenPlayerShot.current < 300);
                const next = idle ? POLL_MS * 2 : POLL_MS;

                if (!cancelled && aiEnabledRef.current) {
                    timer = window.setTimeout(tickAI, next);
                }
            }
        };

        // arranque
        recomputeAIEnabled();
        if (aiEnabledRef.current) tickAI();

        return () => {
            cancelled = true;
            if (timer) window.clearTimeout(timer);
            lastAbortRef.current?.abort();
        };
    }, [active, applyActions, recomputeAIEnabled]);

    return (
        <>
            {active && (
                <div
                    ref={wingRef}
                    className="wingman-ship"
                    style={{
                        position: "fixed",
                        width: NPC_SIZE,
                        height: NPC_SIZE,
                        left: 0,
                        top: 0,
                        transform: `translate3d(${pos.current.x - NPC_SIZE / 2}px, ${pos.current.y - NPC_SIZE / 2}px, 0) rotate(${headingVisualDeg.current}deg)`,
                        willChange: "transform",
                        transformOrigin: "50% 50%",
                        zIndex: 49,
                        pointerEvents: "none",
                    }}
                    aria-hidden
                >
                    {/* Nave (morado) */}
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
