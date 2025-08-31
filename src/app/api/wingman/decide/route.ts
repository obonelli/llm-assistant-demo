import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/** I/O types */
type Snapshot = {
    time: number;
    dims: { width: number; height: number };
    player: { x: number; y: number; heading: number; vx: number; vy: number; firing?: boolean };
    wingman: { x: number; y: number; heading: number; mode: string };
    enemies: Array<{ id: string; x: number; y: number; vx?: number; vy?: number; size?: number; visible?: boolean; threat?: number }>;
    prompt?: string; // optional, overrides style/voice if provided
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

    // ---- Base system prompt (EN) + optional runtime style override ----
    const style = (snap.prompt || "").trim();
    const system = `
You are the "tactical brain" of a wingman in a 2D mini-game.
You must reply ONLY with valid JSON (no extra text) of the form:
{ "actions": [ ... ] }

Style/voice${style ? ` (runtime override provided below)` : ""}:
${style || `Short, professional radio chatter in ENGLISH.
Keep messages varied across calls. 2–5 words, no punctuation if possible.
Examples (just style, do NOT copy every time): On your six | Covering left | Bandit spotted | Reloading | Pushing up | Holding high.`}

Rules:
- Keep the wingman useful but safe.
- If there are no visible enemies, alternate between "patrol" and "escort".
- If a visible enemy is near: "engage" and include exactly 1 "move_to" (on-screen coords) and 1 "fire_burst".
- Do NOT flood orders: return 1–3 actions per call.
- "fire_burst": cadence_ms 120–240, duration_ms 400–1600, spread 0–0.05.
- "say": English, short, at most 1 per response; VARY wording over time.
- If nothing relevant, return { "actions": [] }.
`;

    const user = JSON.stringify({ snapshot: snap });

    // Chat Completions in JSON mode
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0.9,                 // a little more randomness for varied lines
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: system },
                { role: "user", content: user },
            ],
        }),
    });

    if (!r.ok) {
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
