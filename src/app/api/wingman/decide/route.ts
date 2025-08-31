import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/** Tipos de entrada/salida (simple) */
type Snapshot = {
    time: number;
    dims: { width: number; height: number };
    player: { x: number; y: number; heading: number; vx: number; vy: number; firing?: boolean };
    wingman: { x: number; y: number; heading: number; mode: string };
    enemies: Array<{ id: string; x: number; y: number; vx: number; vy: number; size?: number; visible?: boolean; threat?: number }>;
};

type Action =
    | { type: "set_mode"; mode: "patrol" | "escort" | "engage" | "evade" }
    | { type: "move_to"; x: number; y: number }
    | { type: "fire_burst"; cadence_ms: number; duration_ms: number; spread?: number }
    | { type: "say"; text: string }
    | { type: "despawn" };

type Decision = { actions: Action[] };

export async function POST(req: NextRequest) {
    if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({ actions: [] }, { status: 200 });
    }

    const snap = (await req.json()) as Snapshot;

    // Prompt muy concreto + JSON estricto
    const system = `
Eres el "cerebro táctico" de un wingman en un minijuego 2D.
Respondes SOLO con JSON válido, sin texto extra, con el shape:
{ "actions": [ ... ] }

Reglas:
- Mantén al wingman útil pero seguro.
- Si no hay enemigos, alterna entre "patrol" (delante/detrás del jugador) y "escort".
- Si hay enemigo visible cerca, "engage": decide "move_to" hacia un punto razonable (sin salir del mapa) y "fire_burst".
- No inundes de órdenes: 1-3 acciones por llamada.
- Coordenadas dentro de (0..width, 0..height).
- Si el jugador dejó de disparar por mucho tiempo, puedes recomendar "despawn".
- Frases cortas y poco frecuentes con "say".
- "fire_burst": usa "cadence_ms" 120–240 y "duration_ms" 400–1600. "spread" 0–0.05.
- Si no tienes nada mejor, devuelve { "actions": [] }.
`;

    const user = JSON.stringify({
        snapshot: snap,
    });

    // Llamada HTTP directa a Chat Completions con JSON mode
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0.6,
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: system },
                { role: "user", content: user },
            ],
        }),
    });

    if (!r.ok) {
        // en caso de fallo, devolvemos sin acciones
        return NextResponse.json({ actions: [] } as Decision, { status: 200 });
    }

    const data = await r.json();
    let out: Decision = { actions: [] };
    try {
        const content = data.choices?.[0]?.message?.content || "{}";
        out = JSON.parse(content);
        if (!out || !Array.isArray(out.actions)) out = { actions: [] };
    } catch {
        out = { actions: [] };
    }

    return NextResponse.json(out, { status: 200 });
}
