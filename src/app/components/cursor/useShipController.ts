"use client";
import { useEffect, useRef } from "react";
import {
    POS_LERP_BASE, MOUSE_LERP_BASE, MOUSE_LERP_FAST, SPEED_SMOOTH, DIST_DEAD,
    RATE_MAX_BASE, RATE_MAX_FAST, ACCEL_MAX_BASE, ACCEL_MAX_FAST, JERK_MAX_BASE, JERK_MAX_FAST,
    DEAD_RATE, DEAD_ERR, K_BASE, K_FAST,
    TARGET_SELECTOR, LAND_IDLE_SPEED_ENTER, LAND_IDLE_SPEED_EXIT, LAND_IDLE_TIME_ENTER, LAND_IDLE_TIME_EXIT,
    BANK_MAX, BANK_FROM_RATE, PITCH_FROM_DY, LIFT_MAX, BANK_VISUAL_LERP, PITCH_VISUAL_LERP,
    INPUT_SPEED_FOR_BASE, INPUT_SPEED_FOR_FAST,
    IDLE_LOCK_SPEED, IDLE_LOCK_DIST, IDLE_LOCK_AFTER_MS, IDLE_UNLOCK_BOOST
} from "./constants";
import { angWrap, clamp, lerp, unwrapToNear } from "./math";
import { Target, DamageTarget } from "./types";
import { isInside } from "./geometry";

/** 🔔 Wingman: emisor de estado de nave (no altera tu lógica) */
const emitShipState = (d: {
    x: number; y: number; heading: number; vx: number; vy: number;
}) => window.dispatchEvent(new CustomEvent("ship-state", { detail: d }));

export function useShipController(shipRef: React.RefObject<HTMLDivElement>) {
    // posición y seguimiento
    const pos = useRef({ x: typeof window !== "undefined" ? innerWidth / 2 : 0, y: typeof window !== "undefined" ? innerHeight / 2 : 0 });
    const target = useRef({ ...pos.current });
    const filteredTarget = useRef({ ...pos.current });
    const prev = useRef({ ...pos.current });
    const speed = useRef(0);

    // dinámica de rumbo
    const headingCtr = useRef(0);
    const headingRenderRef = useRef(0);
    const turnRate = useRef(0);
    const turnAccel = useRef(0);

    const lastTs = useRef(performance.now());
    const prevRaw = useRef({ x: pos.current.x, y: pos.current.y });

    // visual
    const bankVis = useRef(0);
    const pitchVis = useRef(0);
    const liftRef = useRef(1);
    const shipVel = useRef({ vx: 0, vy: 0 });

    // aterrizaje/histeresis
    const idleSince = useRef<number | null>(null);
    const cachedTargets = useRef<Target[]>([]);
    const landing = useRef(false);
    const landingOnEl = useRef<Element | null>(null);

    // idle lock
    const idleLock = useRef(false);
    const idleLockSince = useRef<number | null>(null);

    // daños
    const damageTargets = useRef<DamageTarget[]>([]);

    const scanTargets = () => {
        const nodes = Array.from(document.querySelectorAll(TARGET_SELECTOR));
        cachedTargets.current = nodes.map((el) => ({ el, rect: (el as HTMLElement).getBoundingClientRect() }));
    };
    const scanDamageTargets = () => {
        const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-damageable="true"]'));
        damageTargets.current = nodes.map((el) => ({ el, rect: el.getBoundingClientRect() }));
    };

    useEffect(() => {
        document.body.classList.add("cursor-none");
        scanTargets(); scanDamageTargets();

        const ro = new ResizeObserver(() => { scanTargets(); scanDamageTargets(); });
        ro.observe(document.documentElement);
        const i1 = window.setInterval(scanTargets, 800);
        const i2 = window.setInterval(scanDamageTargets, 700);

        const onMove = (e: PointerEvent) => {
            target.current.x = e.clientX; target.current.y = e.clientY;
            idleLock.current = false; idleLockSince.current = null;
            filteredTarget.current.x = lerp(filteredTarget.current.x, target.current.x, MOUSE_LERP_FAST * IDLE_UNLOCK_BOOST);
            filteredTarget.current.y = lerp(filteredTarget.current.y, target.current.y, MOUSE_LERP_FAST * IDLE_UNLOCK_BOOST);
        };
        window.addEventListener("pointermove", onMove);

        let raf = 0;
        const tick = (ts: number) => {
            const dt = Math.max(0.001, Math.min(0.033, (ts - (lastTs.current || ts)) / 1000));
            lastTs.current = ts;

            // velocidad de input
            const rawDx = target.current.x - prevRaw.current.x;
            const rawDy = target.current.y - prevRaw.current.y;
            const inputSpeed = Math.hypot(rawDx, rawDy) / dt;
            prevRaw.current = { ...target.current };

            const fFast = clamp((inputSpeed - INPUT_SPEED_FOR_BASE) / (INPUT_SPEED_FOR_FAST - INPUT_SPEED_FOR_BASE), 0, 1);
            const MOUSE_LERP = lerp(MOUSE_LERP_BASE, MOUSE_LERP_FAST, fFast);
            const K_SPRING = lerp(K_BASE, K_FAST, fFast);
            const RATE_MAX = lerp(RATE_MAX_BASE, RATE_MAX_FAST, fFast);
            const ACCEL_MAX = lerp(ACCEL_MAX_BASE, ACCEL_MAX_FAST, fFast);
            const JERK_MAX = lerp(JERK_MAX_BASE, JERK_MAX_FAST, fFast);
            const POS_LERP = lerp(POS_LERP_BASE, 0.24, fFast);

            // seguir objetivo filtrado
            filteredTarget.current.x = lerp(filteredTarget.current.x, target.current.x, MOUSE_LERP);
            filteredTarget.current.y = lerp(filteredTarget.current.y, target.current.y, MOUSE_LERP);
            pos.current.x = lerp(pos.current.x, filteredTarget.current.x, POS_LERP);
            pos.current.y = lerp(pos.current.y, filteredTarget.current.y, POS_LERP);

            const dx = pos.current.x - prev.current.x;
            const dy = pos.current.y - prev.current.y;
            const spd = Math.hypot(dx, dy);
            speed.current = lerp(speed.current, spd, SPEED_SMOOTH);
            shipVel.current.vx = dx / dt; shipVel.current.vy = dy / dt;

            /** Aterrizaje */
            const isIdleEnter = spd < LAND_IDLE_SPEED_ENTER;
            const isIdleExit = spd < LAND_IDLE_SPEED_EXIT;
            if (landing.current) {
                if (!isIdleExit) idleSince.current = null;
            } else {
                if (isIdleEnter) idleSince.current = idleSince.current ?? ts; else idleSince.current = null;
            }
            if (!landing.current) {
                const idleFor = idleSince.current == null ? 0 : ts - idleSince.current;
                if (idleFor >= LAND_IDLE_TIME_ENTER) {
                    const x = pos.current.x, y = pos.current.y;
                    let on: Element | null = null;
                    for (const t of cachedTargets.current) { if (isInside(x, y, t.rect)) { on = t.el; break; } }
                    if (on) { landing.current = true; landingOnEl.current = on; }
                }
            } else {
                const x = pos.current.x, y = pos.current.y;
                const el = landingOnEl.current;
                const t = cachedTargets.current.find(ct => ct.el === el);
                const stillOn = t && isInside(x, y, t.rect);
                if (!stillOn) { landing.current = false; landingOnEl.current = null; idleSince.current = null; }
                else {
                    if (!isIdleExit) {
                        if (idleSince.current == null) idleSince.current = ts;
                        const idleOut = ts - idleSince.current;
                        if (idleOut >= LAND_IDLE_TIME_EXIT) { landing.current = false; landingOnEl.current = null; idleSince.current = null; }
                    } else { idleSince.current = ts; }
                }
            }

            /** Idle lock */
            const distToFiltered = Math.hypot(filteredTarget.current.x - pos.current.x, filteredTarget.current.y - pos.current.y);
            const nearAndSlow = spd < IDLE_LOCK_SPEED && distToFiltered < IDLE_LOCK_DIST;
            if (nearAndSlow) {
                if (idleLockSince.current == null) idleLockSince.current = ts;
                if (!idleLock.current && ts - idleLockSince.current >= IDLE_LOCK_AFTER_MS) {
                    idleLock.current = true; turnRate.current = 0; turnAccel.current = 0;
                }
            } else { idleLock.current = false; idleLockSince.current = null; }

            /** Heading continuo */
            let desiredWrapped: number;
            if (idleLock.current) {
                desiredWrapped = angWrap(headingCtr.current);
            } else {
                desiredWrapped = angWrap((Math.atan2(
                    filteredTarget.current.y - pos.current.y,
                    filteredTarget.current.x - pos.current.x
                ) * 180) / Math.PI);
                const dist = Math.hypot(filteredTarget.current.x - pos.current.x, filteredTarget.current.y - pos.current.y);
                if (dist <= DIST_DEAD && spd > 0.1) {
                    desiredWrapped = angWrap((Math.atan2(dy === 0 && dx === 0 ? 0 : dy, dx === 0 && dy === 0 ? 1 : dx) * 180) / Math.PI);
                }
            }
            const desiredContinuous = unwrapToNear(headingCtr.current, desiredWrapped);
            let err = desiredContinuous - headingCtr.current;
            if (Math.abs(err) < DEAD_ERR) err = 0;

            const C_DAMP = 2 * Math.sqrt(K_SPRING);
            const desiredAccel = idleLock.current ? 0 : K_SPRING * err - C_DAMP * turnRate.current;

            const maxJerkDelta = JERK_MAX * dt;
            const accelDelta = clamp(desiredAccel - turnAccel.current, -maxJerkDelta, maxJerkDelta);
            turnAccel.current += accelDelta;
            turnAccel.current = clamp(turnAccel.current, -ACCEL_MAX, ACCEL_MAX);
            turnRate.current += (idleLock.current ? 0 : turnAccel.current * dt);
            turnRate.current = clamp(turnRate.current, -RATE_MAX, RATE_MAX);

            if ((Math.abs(turnRate.current) < DEAD_RATE && err === 0) || idleLock.current) {
                turnRate.current = 0; if (idleLock.current) turnAccel.current = 0;
            }

            headingCtr.current += turnRate.current * dt;
            const headingRender = angWrap(headingCtr.current);
            headingRenderRef.current = headingRender;

            /** Visual 3D + transform */
            const bankTarget = clamp(turnRate.current * BANK_FROM_RATE, -BANK_MAX, BANK_MAX);
            const pitchTarget = clamp(dy * PITCH_FROM_DY, -9, 9);
            bankVis.current = lerp(bankVis.current, bankTarget, BANK_VISUAL_LERP);
            pitchVis.current = lerp(pitchVis.current, pitchTarget, PITCH_VISUAL_LERP);

            const el = shipRef.current;
            if (el) {
                const HALF = 36;
                const lift = landing.current ? 0.985 : clamp(1 + speed.current * 0.0020, 1, LIFT_MAX);
                liftRef.current = lift;
                el.style.transform =
                    `translate3d(${pos.current.x - HALF}px, ${pos.current.y - HALF}px, 0)` +
                    ` perspective(900px) rotateZ(${headingRender}deg) scale(${lift})`;

                const washScale = clamp(0.95 + speed.current * 0.0018, 0.95, 1.28);
                const washAlpha = clamp(0.20 + speed.current * 0.00045, 0.20, 0.36);
                const washBack = clamp(10 + speed.current * 0.015, 10, 36);
                (el.style as any).setProperty?.("--wash-scale", String(washScale));
                (el.style as any).setProperty?.("--wash-alpha", String(washAlpha));
                (el.style as any).setProperty?.("--wash-offset", `${-washBack}px`);
                (el.style as any).setProperty?.("--wash-rot", `${headingRender}deg`);

                const fly = el.querySelector<SVGElement>(".ship-fly");
                const land = el.querySelector<SVGElement>(".ship-land");
                if (fly && land) {
                    if (landing.current) {
                        fly.style.opacity = "0"; land.style.opacity = "1";
                        land.style.transform = `rotateY(${bankVis.current * 0.3}deg) rotateX(${pitchVis.current * 0.3}deg)`;
                    } else {
                        fly.style.opacity = "1"; land.style.opacity = "0";
                        fly.style.transform = `rotateY(${bankVis.current}deg) rotateX(${pitchVis.current}deg)`;
                    }
                    fly.style.transformStyle = "preserve-3d";
                    land.style.transformStyle = "preserve-3d";
                    (fly.style as any).backfaceVisibility = "hidden";
                    (land.style as any).backfaceVisibility = "hidden";
                }
            }

            /** 🔔 Wingman: emite estado por frame (posición, rumbo y velocidad) */
            emitShipState({
                x: pos.current.x,
                y: pos.current.y,
                heading: headingRenderRef.current,
                vx: shipVel.current.vx,
                vy: shipVel.current.vy,
            });

            prev.current = { ...pos.current };
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("pointermove", onMove);
            clearInterval(i1); clearInterval(i2);
            ro.disconnect();
            document.body.classList.remove("cursor-none");
        };
    }, []);

    return {
        pos, speed, shipVel, headingRenderRef, liftRef,
        cachedTargets, landing,
        damageTargets
    };
}
