// src/app/components/DestructibleText.tsx
"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/** Ajustes “de juego” */
const DAMAGE_RADIUS = 22;           // radio del impacto (px)
const DAMAGE_STRENGTH = 0.45;       // cuánto resta el splat (0..1)
const REGEN_SPEED = 0.045;          // 0..1 por segundo (sube opacidad de la máscara)
const BIG_HIT_THRESHOLD = 0.85;     // si entra un splat muy fuerte, genera más fragmentos
const SPARKS_PER_HIT = 26;          // chispas por impacto base
const SHARDS_PER_HIT = 8;           // fragmentos (triángulos) por impacto base
const SPARK_COLOR_CORE = "rgba(24,200,255,1)";
const SPARK_COLOR_GLOW = "rgba(124,219,255,0.6)";
const TEXT_FILL = "#fff";

/** Partículas muy simples */
type P = {
    x: number; y: number;
    vx: number; vy: number;
    life: number; max: number;
    r: number; tri?: boolean; rot?: number; vr?: number;
};

type LaserLineDetail = {
    x1: number; y1: number; x2: number; y2: number; alpha?: number;
};

export default function DestructibleText({
    text,
    className = "",
}: { text: string; className?: string }) {
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const maskRef = useRef<HTMLCanvasElement | null>(null);      // máscara de “vida”
    const sparkRef = useRef<HTMLCanvasElement | null>(null);     // capa de chispas/fragmentos
    const [ready, setReady] = useState(false);

    const particles = useRef<P[]>([]);

    // estado para tipografía y layout
    const fontRef = useRef({
        family: `Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji","Segoe UI Emoji"`,
        weight: 900,
        size: 88,      // se recalcula según ancho
        lineHeight: 1.1
    });

    // util
    const fitText = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
        const padX = 24;
        let size = 240; // empieza grande y baja
        ctx.textBaseline = "top";
        ctx.textAlign = "center";
        while (size > 24) {
            ctx.font = `${fontRef.current.weight} ${size}px ${fontRef.current.family}`;
            const m = ctx.measureText(text);
            const tw = m.width;
            const th = size * fontRef.current.lineHeight;
            if (tw <= w - padX * 2 && th <= h) break;
            size -= 2;
        }
        fontRef.current.size = size;
        ctx.font = `${fontRef.current.weight} ${size}px ${fontRef.current.family}`;
    }, [text]);

    const drawBaseText = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
        ctx.clearRect(0, 0, w, h);
        ctx.save();
        ctx.shadowBlur = 18;
        ctx.shadowColor = "rgba(0,0,0,.35)";
        ctx.fillStyle = TEXT_FILL;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `${fontRef.current.weight} ${fontRef.current.size}px ${fontRef.current.family}`;
        const cx = w / 2;
        const cy = h / 2 + 6;
        ctx.fillText(text, cx, cy);
        ctx.restore();

        // brillo encima
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.shadowBlur = 26;
        ctx.shadowColor = "rgba(124,219,255,.28)";
        ctx.fillStyle = "rgba(255,255,255,.08)";
        ctx.fillText(text, cx, cy);
        ctx.restore();
    }, [text]);

    const makeSplat = (mx: number, my: number, strength = DAMAGE_STRENGTH) => {
        const mask = maskRef.current!;
        const mctx = mask.getContext("2d")!;
        const r = DAMAGE_RADIUS * (0.85 + Math.random() * 0.3);
        const grad = mctx.createRadialGradient(mx, my, 0, mx, my, r);
        // en máscara: blanco = sano; negro = agujero ⇒ usamos destination-out con alpha
        grad.addColorStop(0, `rgba(0,0,0,${strength})`);
        grad.addColorStop(1, `rgba(0,0,0,0)`);
        mctx.globalCompositeOperation = "destination-out";
        mctx.fillStyle = grad;
        mctx.beginPath();
        mctx.arc(mx, my, r, 0, Math.PI * 2);
        mctx.fill();
        mctx.globalCompositeOperation = "source-over";
    };

    const spawnSparks = (x: number, y: number, amount = SPARKS_PER_HIT, big = false) => {
        const base = big ? amount * 1.4 : amount;
        for (let i = 0; i < base; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = 120 + Math.random() * 340;
            particles.current.push({
                x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                life: 0, max: 0.35 + Math.random() * 0.6,
                r: 1 + Math.random() * 1.8
            });
        }
        // fragmentos triangulares (como “shards” del texto)
        for (let i = 0; i < (big ? SHARDS_PER_HIT * 2 : SHARDS_PER_HIT); i++) {
            const a = Math.random() * Math.PI * 2;
            const s = 80 + Math.random() * 260;
            particles.current.push({
                x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                life: 0, max: 0.6 + Math.random() * 0.8,
                r: 4 + Math.random() * 8,
                tri: true,
                rot: Math.random() * Math.PI,
                vr: (-1 + Math.random() * 2) * 6
            });
        }
    };

    /** recibe trazos de láser y aplica daño si pasan sobre el canvas */
    useEffect(() => {
        const onLaser = (e: CustomEvent<LaserLineDetail>) => {
            const { x1, y1, x2, y2, alpha } = e.detail || {};
            const wrap = wrapRef.current!;
            const rect = wrap.getBoundingClientRect();
            // recorte rápido
            if (x1 < rect.left - 40 && x2 < rect.left - 40) return;
            if (x1 > rect.right + 40 && x2 > rect.right + 40) return;
            if (y1 < rect.top - 40 && y2 < rect.top - 40) return;
            if (y1 > rect.bottom + 40 && y2 > rect.bottom + 40) return;

            // muestreo a lo largo del segmento cada ~8px
            const local = (x: number, y: number) => ({ lx: x - rect.left, ly: y - rect.top });
            const dx = x2 - x1, dy = y2 - y1;
            const len = Math.hypot(dx, dy);
            const steps = Math.max(1, Math.floor(len / 8));
            const big = (alpha ?? 1) > BIG_HIT_THRESHOLD;
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const { lx, ly } = local(x1 + dx * t, y1 + dy * t);
                makeSplat(lx, ly, DAMAGE_STRENGTH * (0.6 + (alpha ?? 1) * 0.7));
                if (i % 3 === 0) spawnSparks(lx, ly, 8, big);
            }
        };
        // TS no conoce el tipo del CustomEvent; casteamos solo en add/remove
        const asListener: EventListener = (e) => onLaser(e as CustomEvent<LaserLineDetail>);
        window.addEventListener("laser-line", asListener);
        return () => window.removeEventListener("laser-line", asListener);
    }, []);

    /** layout + render principal */
    useEffect(() => {
        const wrap = wrapRef.current!;
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
        const mask = maskRef.current!;
        const mctx = mask.getContext("2d")!;
        const sparks = sparkRef.current!;
        const sctx = sparks.getContext("2d")!;

        const resize = () => {
            const w = Math.max(200, Math.floor(wrap.clientWidth));
            const h = Math.max(140, Math.floor(wrap.clientHeight));
            for (const c of [canvas, mask, sparks]) {
                c.width = w; c.height = h;
            }
            // prepara base: texto y máscara llena (blanco=100% sano)
            fitText(ctx, w, h);
            drawBaseText(ctx, w, h);
            mctx.clearRect(0, 0, w, h);
            mctx.fillStyle = "#fff";
            mctx.fillRect(0, 0, w, h);
        };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(wrap);

        let raf = 0;
        let last = performance.now();
        const tick = (ts: number) => {
            const dt = Math.min(0.033, (ts - last) / 1000);
            last = ts;

            const w = canvas.width, h = canvas.height;

            // 1) Regeneración de la máscara (cura globalmente)
            const regen = Math.min(1, REGEN_SPEED * dt);
            if (regen > 0) {
                mctx.globalCompositeOperation = "source-over";
                mctx.fillStyle = `rgba(255,255,255,${regen})`;
                mctx.fillRect(0, 0, w, h);
            }

            // 2) Redibuja texto base en un buffer temporal
            const tmp = document.createElement("canvas");
            tmp.width = w; tmp.height = h;
            const tctx = tmp.getContext("2d")!;
            tctx.font = `${fontRef.current.weight} ${fontRef.current.size}px ${fontRef.current.family}`;
            drawBaseText(tctx, w, h);

            // 3) Aplica máscara: destino = texto; “destination-in” con la máscara
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(tmp, 0, 0);
            ctx.globalCompositeOperation = "destination-in";
            ctx.drawImage(mask, 0, 0);
            ctx.globalCompositeOperation = "source-over";

            // 4) Actualiza chispas/fragmentos
            sctx.clearRect(0, 0, w, h);
            for (let i = particles.current.length - 1; i >= 0; i--) {
                const p = particles.current[i];
                p.life += dt;
                const t = p.life / p.max;
                if (t >= 1) { particles.current.splice(i, 1); continue; }
                // física simple
                p.vy += 620 * dt;                 // gravedad
                p.vx *= Math.pow(0.985, dt * 60); // leve rozamiento
                p.vy *= Math.pow(0.985, dt * 60);
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                if (p.tri) p.rot! += (p.vr || 0) * dt;

                // render
                const a = 1 - t;
                if (p.tri) {
                    sctx.save();
                    sctx.translate(p.x, p.y);
                    sctx.rotate(p.rot || 0);
                    sctx.beginPath();
                    sctx.moveTo(0, -p.r);
                    sctx.lineTo(p.r * 0.9, p.r * 0.7);
                    sctx.lineTo(-p.r, p.r * 0.5);
                    sctx.closePath();
                    sctx.fillStyle = `rgba(180,230,255,${0.28 * a})`;
                    sctx.fill();
                    sctx.lineWidth = 1;
                    sctx.strokeStyle = `rgba(124,219,255,${0.6 * a})`;
                    sctx.stroke();
                    sctx.restore();
                } else {
                    // chispa circular + glow
                    sctx.save();
                    sctx.globalCompositeOperation = "lighter";
                    sctx.fillStyle = SPARK_COLOR_CORE.replace("1)", `${0.9 * a})`);
                    sctx.beginPath();
                    sctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                    sctx.fill();
                    const g = sctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
                    g.addColorStop(0, SPARK_COLOR_GLOW);
                    g.addColorStop(1, "rgba(124,219,255,0)");
                    sctx.fillStyle = g;
                    sctx.beginPath();
                    sctx.arc(p.x, p.y, p.r * 5, 0, Math.PI * 2);
                    sctx.fill();
                    sctx.restore();
                }
            }

            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);

        setReady(true);
        return () => { cancelAnimationFrame(raf); ro.disconnect(); };
    }, [text, fitText, drawBaseText]);

    return (
        <div ref={wrapRef} className={`destructible-wrap ${ready ? "is-ready" : ""} ${className}`}>
            {/* capa principal: el texto ya “recortado” por la máscara */}
            <canvas ref={canvasRef} className="destructible-text" />
            {/* máscara de vida (no visible) */}
            <canvas ref={maskRef} className="destructible-mask" />
            {/* chispas/fragmentos (encima) */}
            <canvas ref={sparkRef} className="destructible-sparks" />
        </div>
    );
}
