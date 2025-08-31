export type Target = { el: Element; rect: DOMRect };
export type DamageTarget = { el: HTMLElement; rect: DOMRect };

export type Laser = { x: number; y: number; vx: number; vy: number; dist: number };
export type Flash = { x: number; y: number; life: number };

export type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number };
export type Frag = { x: number; y: number; vx: number; vy: number; ang: number; w: number; life: number; max: number };
