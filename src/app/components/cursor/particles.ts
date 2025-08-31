import { FRAG_LIFE, FRAG_SPEED, GRAVITY, SPARK_LIFE, SPARK_SPEED, SPARKS_PER_HIT, FRAGS_PER_HIT } from "./constants";
import { Spark, Frag } from "./types";
import { lerp, clamp } from "./math";

/** Rellenan los arrays pasados por referencia */
export function spawnHitParticles(
    sparks: Spark[], frags: Frag[],
    x: number, y: number, normalX: number, normalY: number
) {
    // chispas
    const sCount = Math.floor(lerp(SPARKS_PER_HIT[0], SPARKS_PER_HIT[1], Math.random()));
    for (let i = 0; i < sCount; i++) {
        const ang = Math.atan2(normalY, normalX) + (Math.random() - 0.5) * 1.2;
        const sp = lerp(SPARK_SPEED[0], SPARK_SPEED[1], Math.random());
        sparks.push({
            x, y,
            vx: Math.cos(ang) * sp,
            vy: Math.sin(ang) * sp,
            life: 0,
            max: lerp(SPARK_LIFE[0], SPARK_LIFE[1], Math.random()),
        });
    }
    // fragmentos
    const fCount = Math.floor(lerp(FRAGS_PER_HIT[0], FRAGS_PER_HIT[1], Math.random()));
    for (let i = 0; i < fCount; i++) {
        const ang = Math.atan2(normalY, normalX) + (Math.random() - 0.5) * 1.6;
        const sp = lerp(FRAG_SPEED[0], FRAG_SPEED[1], Math.random());
        frags.push({
            x, y,
            vx: Math.cos(ang) * sp,
            vy: Math.sin(ang) * sp,
            ang: Math.random() * Math.PI * 2,
            w: (Math.random() * 1.2 + 0.8),
            life: 0,
            max: lerp(FRAG_LIFE[0], FRAG_LIFE[1], Math.random()),
        });
    }
}

/** Step + render de chispas y fragmentos */
export function stepAndDrawParticles(
    ctx: CanvasRenderingContext2D, dt: number, sparks: Spark[], frags: Frag[]
) {
    // CHISPAS
    const prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = "lighter";
    for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life += dt;
        if (s.life >= s.max) { sparks.splice(i, 1); continue; }
        s.vy += GRAVITY * dt * 0.15;
        s.x += s.vx * dt; s.y += s.vy * dt;

        const a = 1 - (s.life / s.max);
        const r = 2 + 2 * a;
        const grd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 3);
        grd.addColorStop(0, `rgba(124,219,255,${0.55 * a})`);
        grd.addColorStop(1, `rgba(124,219,255,0)`);
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(s.x, s.y, r * 3, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = `rgba(24,200,255,${0.9 * a})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = prev;

    // FRAGMENTOS
    ctx.save();
    ctx.fillStyle = "rgba(160,235,255,.9)";
    for (let i = frags.length - 1; i >= 0; i--) {
        const f = frags[i];
        f.life += dt;
        if (f.life >= f.max) { frags.splice(i, 1); continue; }
        const tnorm = 1 - f.life / f.max;
        f.vy += GRAVITY * dt * 0.35;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.ang += (0.6 + Math.random() * 0.5) * dt;

        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.ang);
        ctx.globalAlpha = clamp(tnorm, 0, 1);
        ctx.beginPath();
        ctx.moveTo(-1.2 * f.w, -0.6 * f.w);
        ctx.lineTo(1.4 * f.w, -0.3 * f.w);
        ctx.lineTo(0.6 * f.w, 0.9 * f.w);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
    ctx.restore();
}
