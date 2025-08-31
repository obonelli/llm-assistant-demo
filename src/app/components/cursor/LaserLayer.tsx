"use client";
import { useEffect, useRef } from "react";
import {
    LASER_COOLDOWN_MS, LASER_SPEED, LASER_MAX_DIST, LASER_WIDTH,
    LASER_ORIGIN_TWEAK_X, LASER_ORIGIN_TWEAK_Y, NOSE_OFFSET, CANNON_OFFSET,
    LASER_START_FWD, LASER_FADE_TAIL, LASER_INHERIT_SHIP_VEL, LASER_SPAWN_LEAD,
    DAMAGE_ADD_PER_HIT
} from "./constants";
import { clamp } from "./math";
import { segIntersectsRect } from "./geometry";
import { spawnHitParticles, stepAndDrawParticles } from "./particles";
import { DamageTarget, Flash, Laser, Spark, Frag } from "./types";

type Props = {
    posRef: React.MutableRefObject<{ x: number; y: number }>;
    shipVelRef: React.MutableRefObject<{ vx: number; vy: number }>;
    headingRenderRef: React.MutableRefObject<number>;
    liftRef: React.MutableRefObject<number>;
    damageTargetsRef: React.MutableRefObject<DamageTarget[]>;
};

type SpawnLaserDetail = { x: number; y: number; vx: number; vy: number };

export default function LaserLayer({
    posRef, shipVelRef, headingRenderRef, liftRef, damageTargetsRef
}: Props) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const lasers = useRef<Laser[]>([]);
    const flashes = useRef<Flash[]>([]);
    const sparks = useRef<Spark[]>([]);
    const frags = useRef<Frag[]>([]);
    const lastShotAt = useRef(0);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const cv = canvasRef.current!;
        const ctx = cv.getContext("2d")!;
        ctx.lineCap = "round"; ctx.lineJoin = "round";

        const setupCanvasSize = () => {
            const DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));
            cv.width = Math.floor(innerWidth * DPR);
            cv.height = Math.floor(innerHeight * DPR);
            // escala para dibujar en px lógicos
            ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        };
        setupCanvasSize();
        const onResize = () => setupCanvasSize();
        window.addEventListener("resize", onResize);

        // Disparo principal (player) con Espacio
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.code !== "Space") return;
            e.preventDefault();
            const now = performance.now();
            if (now - lastShotAt.current < LASER_COOLDOWN_MS) return;
            lastShotAt.current = now;

            const ang = (headingRenderRef.current * Math.PI) / 180;
            const dirx = Math.cos(ang), diry = Math.sin(ang);
            const lift = liftRef.current;
            const nose = (NOSE_OFFSET + LASER_START_FWD) * lift;
            const lateral = CANNON_OFFSET * lift;

            let baseX = posRef.current.x + LASER_ORIGIN_TWEAK_X;
            let baseY = posRef.current.y + LASER_ORIGIN_TWEAK_Y;
            if (LASER_SPAWN_LEAD > 0) {
                baseX += shipVelRef.current.vx * LASER_SPAWN_LEAD;
                baseY += shipVelRef.current.vy * LASER_SPAWN_LEAD;
            }
            const noseX = baseX + dirx * nose;
            const noseY = baseY + diry * nose;
            const nx = -diry, ny = dirx;

            const vx = dirx * LASER_SPEED + shipVelRef.current.vx * LASER_INHERIT_SHIP_VEL;
            const vy = diry * LASER_SPEED + shipVelRef.current.vy * LASER_INHERIT_SHIP_VEL;

            // dos cañones
            lasers.current.push(
                { x: noseX + nx * lateral, y: noseY + ny * lateral, vx, vy, dist: 0 },
                { x: noseX - nx * lateral, y: noseY - ny * lateral, vx, vy, dist: 0 },
            );
            flashes.current.push({ x: noseX, y: noseY, life: 0.08 });

            // 👉 avisa al Wingman que el player disparó
            window.dispatchEvent(new CustomEvent("laser-fired", { detail: { time: now } }));
        };
        window.addEventListener("keydown", onKeyDown);

        // 👉 Soporte: otros (NPC) pueden inyectar disparos aquí
        const onSpawnLaser = (e: CustomEvent<SpawnLaserDetail>) => {
            const d = e.detail;
            if (!d || typeof d.x !== "number") return;
            lasers.current.push({ x: d.x, y: d.y, vx: d.vx, vy: d.vy, dist: 0 });
            flashes.current.push({ x: d.x, y: d.y, life: 0.06 }); // flash sutil
        };
        // TS: castear para addEventListener tipado
        const spawnListener: EventListener = (e) => onSpawnLaser(e as CustomEvent<SpawnLaserDetail>);
        window.addEventListener("spawn-laser", spawnListener);

        let last = performance.now();
        let raf = 0;
        const loop = (ts: number) => {
            const dt = Math.max(0.001, Math.min(0.033, (ts - last) / 1000));
            last = ts;

            // Actualizar láseres (y eliminar los que excedieron distancia)
            for (let i = lasers.current.length - 1; i >= 0; i--) {
                const l = lasers.current[i];
                l.x += l.vx * dt; l.y += l.vy * dt; l.dist += LASER_SPEED * dt;
                if (l.dist >= LASER_MAX_DIST) lasers.current.splice(i, 1);
            }

            ctx.clearRect(0, 0, cv.width, cv.height);

            // Flashes del cañón
            const prevOp = ctx.globalCompositeOperation;
            ctx.globalCompositeOperation = "lighter";
            for (let i = flashes.current.length - 1; i >= 0; i--) {
                const f = flashes.current[i];
                f.life -= dt;
                if (f.life <= 0) { flashes.current.splice(i, 1); continue; }
                const a = clamp(f.life / 0.08, 0, 1);
                const r = 10 + (1 - a) * 10;
                const grd = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
                grd.addColorStop(0, `rgba(124,219,255,${0.55 * a})`);
                grd.addColorStop(1, `rgba(124,219,255,0)`);
                ctx.fillStyle = grd;
                ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = `rgba(24,200,255,${0.9 * a})`;
                ctx.beginPath(); ctx.arc(f.x, f.y, 2.2, 0, Math.PI * 2); ctx.fill();
            }
            ctx.globalCompositeOperation = prevOp;

            // Trazado + impactos
            ctx.lineWidth = LASER_WIDTH;
            for (const l of lasers.current) {
                const tail = Math.min(LASER_MAX_DIST * LASER_FADE_TAIL, l.dist);
                const tx = l.x - (l.vx / LASER_SPEED) * tail;
                const ty = l.y - (l.vy / LASER_SPEED) * tail;
                const alpha = clamp(1 - l.dist / LASER_MAX_DIST, 0, 1);

                // hook para otros efectos (opcional)
                window.dispatchEvent(new CustomEvent("laser-line", {
                    detail: { x1: tx, y1: ty, x2: l.x, y2: l.y, alpha, time: ts }
                }));

                // refrescar rects por si cambió layout
                for (const t of damageTargetsRef.current) {
                    if (t.el.isConnected) t.rect = t.el.getBoundingClientRect();
                }

                // detección de impacto contra elementos dañables
                for (const t of damageTargetsRef.current) {
                    const r = t.rect;
                    if (segIntersectsRect(tx, ty, l.x, l.y, r)) {
                        const hitX = clamp((l.x - r.left) / r.width, 0, 1);
                        const hitY = clamp((l.y - r.top) / r.height, 0, 1);
                        const el = t.el;

                        const cur = parseFloat(getComputedStyle(el).getPropertyValue("--d") || "0") || 0;
                        const nd = Math.min(1, cur + DAMAGE_ADD_PER_HIT);
                        el.style.setProperty("--d", nd.toFixed(3));
                        el.style.setProperty("--hx", `${(hitX * 100).toFixed(2)}%`);
                        el.style.setProperty("--hy", `${(hitY * 100).toFixed(2)}%`);
                        (el as any).dataset.lastHit = String(performance.now());

                        window.dispatchEvent(new CustomEvent("letter-hit", { detail: { el } }));

                        const nrmx = -(l.vx / Math.hypot(l.vx, l.vy));
                        const nrmy = -(l.vy / Math.hypot(l.vx, l.vy));
                        spawnHitParticles(sparks.current, frags.current, l.x, l.y, nrmx, nrmy);
                    }
                }

                // Glow exterior + núcleo
                ctx.strokeStyle = `rgba(124,219,255,${alpha * 0.45})`;
                ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(l.x, l.y); ctx.stroke();
                ctx.strokeStyle = `rgba(24,200,255,${alpha})`;
                ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(l.x, l.y); ctx.stroke();
            }

            // partículas
            stepAndDrawParticles(ctx, dt, sparks.current, frags.current);

            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", onResize);
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("spawn-laser", spawnListener);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="laser-layer"
            style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 45 }}
        />
    );
}
