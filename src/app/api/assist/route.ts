// src/app/api/assist/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { PEOPLE } from "@/mock/people";
import { ACTIVITY } from "@/mock/activity";
import { COMPANIES } from "@/mock/companies";

/* =============== Types =============== */
type Action = { type: "SAY"; text: string };

/* =============== Utils =============== */
const norm = (s: string) =>
    (s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\p{L}\p{N}@.\s-]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();

/* =============== Short-term memory (5 turns) =============== */
type MemoryMetric = "credit" | "debit" | "balance";
type MemoryTurn = { q: string; a: string; metric?: MemoryMetric; personId?: string };
const HISTORY_LIMIT = 5;
let chatHistory: MemoryTurn[] = [];

function pushHistory(t: MemoryTurn) {
    chatHistory.push(t);
    if (chatHistory.length > HISTORY_LIMIT) chatHistory.shift();
}
function lastMetric(): MemoryMetric | undefined {
    for (let i = chatHistory.length - 1; i >= 0; i--) if (chatHistory[i].metric) return chatHistory[i].metric;
}

/* =============== Data helpers =============== */
type PersonRow = {
    id: string;
    name: string;
    email: string;
    role: string;
    company: string;
    debit?: number;
    credit?: number;
    balance?: number;
};
type ActivityRow = {
    personId: string;
    date: string;
    action: string;
    notes?: string;
    amount?: number;
    kind?: "debit" | "credit";
    account?: string;
    category?: string;
    ref?: string;
};
type CompanyRow = (typeof COMPANIES)[number];

async function getAllPeople(): Promise<PersonRow[]> {
    return PEOPLE as PersonRow[];
}

/* Aggregate debit/credit/balance from ACTIVITY when PEOPLE doesn't include totals */
function totalsFromActivity(): Record<string, { debit: number; credit: number; balance: number }> {
    const agg: Record<string, { debit: number; credit: number }> = {};
    for (const a of (ACTIVITY as ActivityRow[]) || []) {
        if (!a.personId || !a.amount || !a.kind) continue;
        const bag = (agg[a.personId] ||= { debit: 0, credit: 0 });
        if (a.kind === "debit") bag.debit += Math.max(0, a.amount);
        if (a.kind === "credit") bag.credit += Math.max(0, a.amount);
    }
    const out: Record<string, { debit: number; credit: number; balance: number }> = {};
    for (const [pid, { debit, credit }] of Object.entries(agg))
        out[pid] = { debit, credit, balance: credit - debit };
    return out;
}

async function getPeopleWithTotals(): Promise<PersonRow[]> {
    const base = await getAllPeople();
    const hasTotals = base.some((p) => "debit" in p || "credit" in p || "balance" in p);
    if (hasTotals) {
        return base.map((p) => {
            const debit = Number(p.debit ?? 0);
            const credit = Number(p.credit ?? 0);
            const balance = Number(p.balance ?? credit - debit);
            return { ...p, debit, credit, balance };
        });
    }
    const totals = totalsFromActivity();
    return base.map((p) => ({ ...p, ...(totals[p.id] || { debit: 0, credit: 0, balance: 0 }) }));
}

/* ===== context chunks (ranking por query para señal al modelo) ===== */
function scorePerson(qRaw: string, p: PersonRow) {
    const q = norm(qRaw);
    if (!q) return 0;
    const hay = `${p.name} ${p.email} ${p.company} ${p.role}`.toLowerCase();
    let s = 0;
    const nq = q.replace(/\s+/g, " ").trim();
    const np = norm(p.name);
    if (np === nq) s += 10;
    if (np.startsWith(nq)) s += 6;
    if (hay.includes(nq)) s += 3;
    return s;
}
async function peopleContextTopK(query: string, k = 60) {
    const all = await getPeopleWithTotals();
    const mapRow = (p: PersonRow) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        company: p.company,
        role: p.role,
        debit: p.debit,
        credit: p.credit,
        balance: p.balance,
    });
    if (!query) return all.slice(0, k).map(mapRow);
    return all
        .map((p) => ({ p, s: scorePerson(query, p) }))
        .sort((a, b) => b.s - a.s)
        .slice(0, k)
        .map(({ p }) => mapRow(p));
}

function scoreActivity(qRaw: string, a: ActivityRow, personLookup: Record<string, string>) {
    const q = norm(qRaw);
    if (!q) return 0;
    const personName = personLookup[a.personId] ?? "";
    const hay = `${personName} ${a.action} ${a.notes ?? ""} ${a.date} ${a.ref ?? ""}`.toLowerCase();
    let s = 0;
    if (norm(personName) === q) s += 4;
    if (hay.includes(q)) s += 3;
    return s;
}
async function activitiesContextTopK(query: string, k = 120) {
    const personLookup: Record<string, string> = {};
    for (const p of PEOPLE as PersonRow[]) personLookup[p.id] = p.name;
    const all = (ACTIVITY as ActivityRow[]) ?? [];
    const mapRow = (a: ActivityRow) => ({
        personId: a.personId,
        personName: personLookup[a.personId] ?? "",
        date: a.date,
        action: a.action,
        notes: a.notes,
        amount: a.amount,
        kind: a.kind,
        account: a.account,
        category: a.category,
        ref: a.ref,
    });
    if (!query) return all.slice(0, k).map(mapRow);
    return all
        .map((a) => ({ a, s: scoreActivity(query, a, personLookup) }))
        .sort((a, b) => b.s - a.s)
        .slice(0, k)
        .map(({ a }) => mapRow(a));
}

function scoreCompany(qRaw: string, c: CompanyRow) {
    const q = norm(qRaw);
    if (!q) return 0;
    const hay = `${c.name} ${c.industry} ${c.city} ${c.country}`.toLowerCase();
    let s = 0;
    const nq = q.replace(/\s+/g, " ").trim();
    const nc = norm(c.name);
    if (nc === nq) s += 10;
    if (nc.startsWith(nq)) s += 6;
    if (hay.includes(nq)) s += 3;
    return s;
}
async function companiesContextTopK(query: string, k = 60) {
    const all = COMPANIES;
    const mapRow = (c: CompanyRow) => ({
        id: c.id,
        name: c.name,
        industry: c.industry,
        city: c.city,
        country: c.country,
        employees: c.employees,
        website: c.website,
    });
    if (!query) return all.slice(0, k).map(mapRow);
    return all
        .map((c) => ({ c, s: scoreCompany(query, c) }))
        .sort((a, b) => b.s - a.s)
        .slice(0, k)
        .map(({ c }) => mapRow(c));
}

/* ===== schemas ===== */
function schemaFromRows(rows: Array<Record<string, any>>): string[] {
    const keys = new Set<string>();
    for (const r of rows || []) Object.keys(r || {}).forEach((k) => keys.add(k));
    return Array.from(keys).sort();
}
function peopleSchema(): string[] {
    const rows = (PEOPLE as any[]) || [];
    const base = schemaFromRows(rows);
    ["debit", "credit", "balance"].forEach((k) => {
        if (!base.includes(k)) base.push(k);
    });
    return base.sort();
}
function companiesSchema(): string[] {
    return schemaFromRows((COMPANIES as any[]) || []);
}
function activitiesSchema(): string[] {
    return schemaFromRows((ACTIVITY as any[]) || []);
}

/* =============== LLM prompt (solo texto con razonamiento breve) =============== */
const SYSTEM_PROMPT = `
Eres un asistente para una app tipo CRM.
Devuelve **únicamente** JSON con esta forma exacta:
{"action":{"type":"SAY","text":"..."}}   // máx. 1–3 frases, en español.

Comportamiento:
- Responde con lógica y sentido común. Explica brevemente el porqué cuando aporte valor
  (p. ej., "porque en el catálogo aparece...").
- Tolera errores ortográficos, Spanglish y ruido.
- Basa tus respuestas SOLO en los catálogos provistos (people_catalog, activities_catalog, companies_catalog)
  y en los *_schema. No inventes datos que no estén ahí.
- Preguntas factuales (p. ej., "¿en cuál empresa está X?"): responde con el dato.
- Preguntas abiertas o genéricas (p. ej., "¿algo más?"):
    • Da 1–3 observaciones útiles según el contexto actual (ruta/tipo de catálogo),
      como conteos aproximados, extremos (mayor/menor), outliers o patrones simples.
    • Mantén precisión conservadora; si faltan datos, dilo.
- Si piden columnas/campos/schema, lista los campos del *_schema en una sola frase.
- No navegues, no des rutas, no devuelvas otra acción distinta a SAY.
`;

/* Prompt con contexto FILTRADO por el query y con metadatos mínimos de contexto */
function buildUserPrompt(
    query: string,
    context: any,
    peopleChunk: any[],
    activitiesChunk: any[],
    companiesChunk: any[],
    history: MemoryTurn[]
) {
    const selection = (context?.selection ?? "").slice(0, 400);
    const path = String(context?.path ?? "");
    const pageTitle = String(context?.pageTitle ?? "");
    const historyLines = history.slice(-HISTORY_LIMIT).map((h) => `Q: ${h.q}\nA: ${h.a}`).join("\n");

    const pplSchema = peopleSchema();
    const compSchema = companiesSchema();
    const actSchema = activitiesSchema();

    // Mini “context kind” para que el modelo sepa qué vista parece activa (solo texto)
    const contextKind =
        path.includes("/companies") ? "companies" :
            path.includes("/people") ? "people" :
                path.includes("/analytics") ? "analytics" : "unknown";

    return `
Historial reciente:
${historyLines || "(empty)"}

Consulta original: ${JSON.stringify(query)}

Contexto UI (solo referencia textual):
- path: ${JSON.stringify(path)}
- context_kind: ${JSON.stringify(contextKind)}
- title: ${JSON.stringify(pageTitle)}
- selection: ${JSON.stringify(selection)}

people_catalog (TOP-K por el query o generales si el query es vacío):
${JSON.stringify(peopleChunk)}

activities_catalog (TOP-K por el query o generales si el query es vacío):
${JSON.stringify(activitiesChunk)}

companies_catalog (TOP-K por el query o generales si el query es vacío):
${JSON.stringify(companiesChunk)}

people_schema:
${JSON.stringify(pplSchema)}

companies_schema:
${JSON.stringify(compSchema)}

activities_schema:
${JSON.stringify(actSchema)}
`;
}

/* =============== LLM decision (solo SAY) =============== */
function coerceAction(a: any): { action: Action } {
    // Fuerza a SAY aunque llegue algo raro.
    const text =
        (a && a.action && typeof a.action.text === "string" && a.action.text) ||
        (typeof a?.text === "string" && a.text) ||
        JSON.stringify(a || {});
    return { action: { type: "SAY", text: String(text || "") } };
}

async function decideWithLLM(query: string, context: any): Promise<{ action: Action }> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return { action: { type: "SAY", text: "Falta OPENAI_API_KEY en el servidor." } };
    }

    const client = new OpenAI({ apiKey });
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const [peopleChunk, activitiesChunk, companiesChunk] = await Promise.all([
        peopleContextTopK(query, 60),
        activitiesContextTopK(query, 120),
        companiesContextTopK(query, 60),
    ]);

    const resp = await client.chat.completions.create({
        model,
        response_format: { type: "json_object" },
        temperature: 0.25,
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
                role: "user",
                content: buildUserPrompt(query, context, peopleChunk, activitiesChunk, companiesChunk, chatHistory),
            },
        ],
    });

    const content = resp.choices?.[0]?.message?.content || "{}";
    try {
        const parsed = JSON.parse(content);
        return coerceAction(parsed);
    } catch {
        return { action: { type: "SAY", text: "No pude interpretar la respuesta del modelo." } };
    }
}

/* =============== Route handler (texto únicamente) =============== */
export async function POST(req: NextRequest) {
    const body = (await req.json().catch(() => ({}))) as {
        query?: string;
        mode?: "HINT" | "DECIDE";
        context?: any;
    };

    const query = body?.query ?? "";
    const mode = body?.mode ?? "DECIDE";
    const context = body?.context ?? {};

    if (mode === "HINT") {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return NextResponse.json<{ action: Action }>({
                action: { type: "SAY", text: "Pídeme personas, empresas, actividades o un resumen breve." },
            });
        }
        const client = new OpenAI({ apiKey });
        const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
        const hintResp = await client.chat.completions.create({
            model,
            response_format: { type: "json_object" },
            temperature: 0.3,
            messages: [
                {
                    role: "system",
                    content: 'Devuelve SOLO {"action":{"type":"SAY","text":"..."}} (<=12 palabras, español).',
                },
                {
                    role: "user",
                    content: "Frase breve para sugerir consultar personas/empresas/actividades o pedir un resumen.",
                },
            ],
        });
        const content = hintResp.choices?.[0]?.message?.content || "";
        try {
            const parsed = JSON.parse(content);
            return NextResponse.json(coerceAction(parsed));
        } catch {
            return NextResponse.json<{ action: Action }>({ action: { type: "SAY", text: "Listo para ayudarte." } });
        }
    }

    // SOLO lo decide el LLM; no hay navegación.
    const result = await decideWithLLM(query, context);

    // Guardar historia si es SAY (para continuidad)
    if (result?.action?.type === "SAY") {
        const say = (result.action as any).text || "";
        pushHistory({ q: query, a: say, metric: lastMetric() });
    }

    return NextResponse.json(result);
}
