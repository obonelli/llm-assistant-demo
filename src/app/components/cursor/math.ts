export const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const angWrap = (x: number) => (x % 360 + 360) % 360;

/** Desenvuelve heading deseado cerca del heading continuo actual */
export function unwrapToNear(currentContinuousDeg: number, desiredWrappedDeg: number) {
    const base = desiredWrappedDeg + 360 * Math.round((currentContinuousDeg - desiredWrappedDeg) / 360);
    const c1 = base + 360, c2 = base - 360;
    let best = base;
    if (Math.abs(c1 - currentContinuousDeg) < Math.abs(best - currentContinuousDeg)) best = c1;
    if (Math.abs(c2 - currentContinuousDeg) < Math.abs(best - currentContinuousDeg)) best = c2;
    return best;
}
