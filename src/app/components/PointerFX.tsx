'use client';
import { useEffect, useRef } from 'react';

/** ===== Config ===== */
const BANK_MULT = 2.0;          // qué tanto se inclina por velocidad en X
const MAX_BANK_DEG = 45;        // límite de inclinación
const DAMP_POS = 0.12;          // suavizado de posición
const DAMP_VEL = 0.18;          // suavizado de velocidad
const SHIP_TAIL_OFFSET = 12;    // distancia desde el centro hacia la cola
const ACCEL_THRESHOLD = 0.12;   // umbral para emitir partículas

type Particle = { x: number; y: number; vx: number; vy: number; life: number };

export default function PointerFX() {
    const containerRef = useRef<HTMLDivElement>(null);
    const shipRef = useRef<HTMLDivElement>(null);
    const trailRef = useRef<HTMLCanvasElement>(null);

    // Estado inercial
    const targRef = useRef({ x: 0, y: 0 });
    const posRef = useRef({ x: 0, y: 0 });
    const velRef = useRef({ x: 0, y: 0 });
    const lastVelRef = useRef({ vx: 0, vy: 0 });

    // Partículas
    const particlesRef = useRef<Particle[]>([]);
    const rafRef = useRef<number | null>(null);
    const lastTS = useRef<number>(0);

    useEffect(() => {
        const el = containerRef.current!;
        const ship = shipRef.current!;
        const canvas = trailRef.current!;
        const ctx = canvas.getContext('2d')!;

        // target/pos inicial al centro del contenedor
        const r0 = el.getBoundingClientRect();
        targRef.current = { x: r0.width * 0.5, y: r0.height * 0.5 };
        posRef.current = { ...targRef.current };

        // Canvas DPR
        const resizeCanvas = () => {
            const r = el.getBoundingClientRect();
            const dpr = Math.max(1, window.devicePixelRatio || 1);
            canvas.style.width = `${r.width}px`;
            canvas.style.height = `${r.height}px`;
            canvas.width = Math.floor(r.width * dpr);
            canvas.height = Math.floor(r.height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
            ctx.clearRect(0, 0, r.width, r.height);
        };
        resizeCanvas();
        const ro = new ResizeObserver(resizeCanvas);
        ro.observe(el);

        // Pointer → target (y variables para parallax global si las usas)
        const onMove = (e: PointerEvent | MouseEvent) => {
            const r = el.getBoundingClientRect();
            const x = (e as PointerEvent).clientX - r.left;
            const y = (e as PointerEvent).clientY - r.top;
            targRef.current.x = x;
            targRef.current.y = y;

            // opcional: alimentar --mx/--my para tu fondo
            const mx = (e as PointerEvent).clientX / window.innerWidth;
            const my = (e as PointerEvent).clientY / window.innerHeight;
            document.documentElement.style.setProperty('--mx', String(mx));
            document.documentElement.style.setProperty('--my', String(my));
        };
        el.addEventListener('pointermove', onMove);
        el.addEventListener('mousemove', onMove);

        // ===== Particles helpers =====
        const spawnTrail = (x: number, y: number, dirRad: number, speed: number) => {
            const n = 6 + (speed > 1.2 ? 4 : 0);
            for (let i = 0; i < n; i++) {
                const spread = (Math.random() - 0.5) * 0.6;
                const ang = dirRad + Math.PI + spread;
                const v = 40 + Math.random() * 80;
                particlesRef.current.push({
                    x, y,
                    vx: Math.cos(ang) * v * 0.016,
                    vy: Math.sin(ang) * v * 0.016,
                    life: 0.35 + Math.random() * 0.25
                });
            }
            if (particlesRef.current.length > 500) {
                particlesRef.current.splice(0, particlesRef.current.length - 500);
            }
        };

        const drawTrail = (dt: number) => {
            const r = el.getBoundingClientRect();
            // desvanecer el frame anterior (trail)
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 0.18;
            ctx.fillStyle = 'rgba(0,0,0,1)';
            ctx.fillRect(0, 0, r.width, r.height);

            // partículas aditivas
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'lighter';
            for (let i = particlesRef.current.length - 1; i >= 0; i--) {
                const p = particlesRef.current[i];
                p.x += p.vx;
                p.y += p.vy;
                p.life -= dt;
                if (p.life <= 0) { particlesRef.current.splice(i, 1); continue; }

                const a = Math.max(0, Math.min(1, p.life * 2));
                ctx.globalAlpha = a * 0.9;
                const rad = 1.2 + (1 - a) * 2.2;
                const hue = 12 + Math.random() * 20; // naranja-rojizo
                ctx.fillStyle = `hsl(${hue} 90% 60%)`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
        };

        // ===== Loop =====
        const tick = (ts: number) => {
            const dt = Math.min(0.033, (ts - (lastTS.current || ts)) / 1000);
            lastTS.current = ts;

            // Física suave
            const t = targRef.current;
            const p = posRef.current;
            const v = velRef.current;

            const ax = (t.x - p.x) * DAMP_POS;
            const ay = (t.y - p.y) * DAMP_POS;
            v.x = v.x * (1 - DAMP_VEL) + ax;
            v.y = v.y * (1 - DAMP_VEL) + ay;

            p.x += v.x;
            p.y += v.y;

            // Bank: según velocidad X (x2.0 y clamp ±45°)
            const bankDeg = clamp(v.x * BANK_MULT, -MAX_BANK_DEG, MAX_BANK_DEG);
            ship.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) rotateZ(${bankDeg}deg)`;

            // Downwash intensifica con la velocidad
            const spd = Math.hypot(v.x, v.y);
            ship.style.setProperty('--wash', `${clamp(spd * 1.2, 0, 18)}px`);

            // Aceleración → estela
            const lv = lastVelRef.current;
            const axi = v.x - lv.vx;
            const ayi = v.y - lv.vy;
            const accel = Math.hypot(axi, ayi);
            lastVelRef.current = { vx: v.x, vy: v.y };

            const dir = Math.atan2(v.y, v.x) || 0;

            if (accel > ACCEL_THRESHOLD) {
                const tailX = p.x - Math.cos(dir) * SHIP_TAIL_OFFSET;
                const tailY = p.y - Math.sin(dir) * SHIP_TAIL_OFFSET;
                spawnTrail(tailX, tailY, dir, spd);
            }

            drawTrail(dt);
            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            ro.disconnect();
            el.removeEventListener('pointermove', onMove);
            el.removeEventListener('mousemove', onMove);
        };
    }, []);

    return (
        <div ref={containerRef} className="relative pointerfx-container">
            {/* Canvas de estela */}
            <canvas ref={trailRef} className="pointer-trail" />
            {/* Nave (estilada via CSS .pointer-ship) */}
            <div ref={shipRef} className="pointer-ship" aria-label="ship" />
        </div>
    );
}

/** Util */
function clamp(n: number, a: number, b: number) {
    return Math.max(a, Math.min(b, n));
}
