// src/app/components/cursor/events.ts
export type ShipState = {
    x: number;
    y: number;
    heading: number; // degrees
    vx: number;
    vy: number;
    lastShot?: number;
};

export function emitShipState(state: ShipState) {
    window.dispatchEvent(new CustomEvent<ShipState>("ship-state", { detail: state }));
}

export function emitLaserFired(time = performance.now()) {
    window.dispatchEvent(new CustomEvent("laser-fired", { detail: { time } }));
}

export type SpawnLaserDetail = { x: number; y: number; vx: number; vy: number };
export function emitSpawnLaser(d: SpawnLaserDetail) {
    window.dispatchEvent(new CustomEvent<SpawnLaserDetail>("spawn-laser", { detail: d }));
}
