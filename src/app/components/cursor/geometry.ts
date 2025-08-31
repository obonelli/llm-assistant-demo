import { HIT_PAD } from "./constants";

export const isInside = (x: number, y: number, r: DOMRect) =>
    x >= r.left - HIT_PAD && x <= r.right + HIT_PAD &&
    y >= r.top - HIT_PAD && y <= r.bottom + HIT_PAD;

/** Intersección segmento-rectángulo */
export const segIntersectsRect = (x1: number, y1: number, x2: number, y2: number, r: DOMRect) => {
    const left = r.left, right = r.right, top = r.top, bottom = r.bottom;
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    if (maxX < left || minX > right || maxY < top || minY > bottom) return false;

    const inter = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number) => {
        const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
        if (d === 0) return false;
        const u = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d;
        const v = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
        return u >= 0 && u <= 1 && v >= 0 && v <= 1;
    };
    return (
        inter(x1, y1, x2, y2, left, top, right, top) ||
        inter(x1, y1, x2, y2, right, top, right, bottom) ||
        inter(x1, y1, x2, y2, right, bottom, left, bottom) ||
        inter(x1, y1, x2, y2, left, bottom, left, top) ||
        (x1 >= left && x1 <= right && y1 >= top && y1 <= bottom)
    );
};
