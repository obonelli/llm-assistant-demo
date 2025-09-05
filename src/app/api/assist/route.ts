import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { PEOPLE } from "@/mock/people";
import { ACTIVITY } from "@/mock/activity";
import { COMPANIES } from "@/mock/companies";
import type { UIStrings } from "@/types/assistant";

type Action = { type: "SAY"; text: string };

type MemoryMetric = "credit" | "debit" | "balance";
type MemoryTurn = { q: string; a: string; metric?: MemoryMetric; personId?: string };

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

type PeopleContextRow = Pick<
    PersonRow,
    "id" | "name" | "email" | "company" | "role" | "debit" | "credit" | "balance"
>;
type ActivityContextRow = {
    personId: string;
    personName: string;
    date: string;
    action: string;
    notes?: string;
    amount?: number;
    kind?: "debit" | "credit";
    account?: string;
    category?: string;
    ref?: string;
};
type CompanyContextRow = Pick<
    CompanyRow,
    "id" | "name" | "industry" | "city" | "country" | "employees" | "website"
>;

type UIContext = {
    selection?: string;
    path?: string;
    pageTitle?: string;
    [k: string]: unknown;
};

const norm = (s: string) =>
    (s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\p{L}\p{N}@.\s-]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();

/* =============== Short-term memory (5 turns) =============== */
const HISTORY_LIMIT = 5;
const chatHistory: MemoryTurn[] = [];

function pushHistory(t: MemoryTurn) {
    chatHistory.push(t);
    if (chatHistory.length > HISTORY_LIMIT) chatHistory.shift();
}
function lastMetric(): MemoryMetric | undefined {
    for (let i = chatHistory.length - 1; i >= 0; i--) if (chatHistory[i].metric) return chatHistory[i].metric;
}

/* =============== Data helpers =============== */
async function getAllPeople(): Promise<PersonRow[]> {
    return PEOPLE as PersonRow[];
}

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

/* ===== context chunks (ranking) ===== */
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

async function peopleContextTopK(query: string, k = 60): Promise<PeopleContextRow[]> {
    const all = await getPeopleWithTotals();
    const mapRow = (p: PersonRow): PeopleContextRow => ({
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

async function activitiesContextTopK(query: string, k = 120): Promise<ActivityContextRow[]> {
    const personLookup: Record<string, string> = {};
    for (const p of PEOPLE as PersonRow[]) personLookup[p.id] = p.name;
    const all = (ACTIVITY as ActivityRow[]) ?? [];
    const mapRow = (a: ActivityRow): ActivityContextRow => ({
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

async function companiesContextTopK(query: string, k = 60): Promise<CompanyContextRow[]> {
    const all = COMPANIES;
    const mapRow = (c: CompanyRow): CompanyContextRow => ({
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
function schemaFromRows(rows: Array<Record<string, unknown>>): string[] {
    const keys = new Set<string>();
    for (const r of rows || []) Object.keys(r || {}).forEach((k) => keys.add(k));
    return Array.from(keys).sort();
}
function peopleSchema(): string[] {
    const rows = (PEOPLE as Array<Record<string, unknown>>) || [];
    const base = schemaFromRows(rows);
    ["debit", "credit", "balance"].forEach((k) => {
        if (!base.includes(k)) base.push(k);
    });
    return base.sort();
}
function companiesSchema(): string[] {
    return schemaFromRows((COMPANIES as Array<Record<string, unknown>>) || []);
}
function activitiesSchema(): string[] {
    return schemaFromRows((ACTIVITY as Array<Record<string, unknown>>) || []);
}

/* =============== Tools context (precomputed facts) =============== */
function fmt(parts: Intl.DateTimeFormatPart[]) {
    const obj: any = {};
    for (const p of parts) obj[p.type] = p.value;
    const date = `${obj.year}-${obj.month}-${obj.day}`;
    const time = `${obj.hour}:${obj.minute}:${obj.second}`;
    return { date, time, iso: `${date}T${time}` };
}
function timeIn(zone: string) {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: zone,
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    }).formatToParts(now);
    return { zone, ...fmt(parts) };
}
function buildToolsContext() {
    return {
        now_server_iso: new Date().toISOString(),
        timezones: [
            timeIn("UTC"),
            timeIn("America/Mexico_City"),
            timeIn("America/Monterrey"),
            timeIn("America/Los_Angeles"),
            timeIn("America/New_York"),
        ],
    };
}

/* =============== Prompts =============== */
const SYSTEM_PROMPT = `
You are a helpful, concise assistant.
Always return ONLY JSON: {"action":{"type":"SAY","text":"..."}} with 1–3 short sentences.
Answer in the user's language; if uncertain, default to English.

Use any generally known knowledge you have. When the user asks about CRM data (people/companies/activities),
prefer the provided catalogs and *_schema. If a fact is not present, say so briefly.

You may rely on the "tools_context" provided by the server (e.g., current time in various timezones).
If tools_context contains a value relevant to the question (like local time), use it directly instead of guessing.

Avoid unsafe content. No links unless explicitly present in context. Do not output any format other than the JSON above.
`;

const UI_SYSTEM_PROMPT = `
You generate UI strings for a small assistant box.
Return ONLY JSON: {
  "ui":{
    "openTitle": "...",
    "openAria": "...",
    "headerTitle": "...",
    "headerBadge": "beta",
    "placeholder": "...",
    "ask": "...",
    "close": "...",
    "thinking": "...",
    "errGeneric": "...",
    "errDidntUnderstand": "..."
  }
}
Default language is English, but if the user's current query is clearly in Spanish, return Spanish strings.
Keep them short and friendly. No extra fields.
`;

function buildUserPrompt(
    query: string,
    context: UIContext,
    peopleChunk: PeopleContextRow[],
    activitiesChunk: ActivityContextRow[],
    companiesChunk: CompanyContextRow[],
    history: MemoryTurn[]
) {
    const selection = String(context?.selection ?? "").slice(0, 400);
    const path = String(context?.path ?? "");
    const pageTitle = String(context?.pageTitle ?? "");
    const historyLines = history.slice(-HISTORY_LIMIT).map((h) => `Q: ${h.q}\nA: ${h.a}`).join("\n");

    const pplSchema = peopleSchema();
    const compSchema = companiesSchema();
    const actSchema = activitiesSchema();

    const contextKind =
        path.includes("/companies") ? "companies" :
            path.includes("/people") ? "people" :
                path.includes("/analytics") ? "analytics" : "unknown";

    const tools_context = buildToolsContext();

    return `
Recent history:
${historyLines || "(empty)"}

Original query: ${JSON.stringify(query)}

UI context (text only):
- path: ${JSON.stringify(path)}
- context_kind: ${JSON.stringify(contextKind)}
- title: ${JSON.stringify(pageTitle)}
- selection: ${JSON.stringify(selection)}

tools_context (server precomputed facts you can rely on):
${JSON.stringify(tools_context)}

people_catalog (top-k for the query or general if empty):
${JSON.stringify(peopleChunk)}

activities_catalog:
${JSON.stringify(activitiesChunk)}

companies_catalog:
${JSON.stringify(companiesChunk)}

people_schema:
${JSON.stringify(pplSchema)}

companies_schema:
${JSON.stringify(compSchema)}

activities_schema:
${JSON.stringify(actSchema)}
`;
}

/* =============== Helpers =============== */
function coerceAction(a: unknown): { action: Action } {
    if (typeof a === "object" && a !== null) {
        const obj = a as { action?: { type?: unknown; text?: unknown }; text?: unknown };
        const textCandidate =
            (obj.action && typeof obj.action.text === "string" && obj.action.text) ||
            (typeof obj.text === "string" && obj.text) ||
            null;
        if (typeof textCandidate === "string") {
            return { action: { type: "SAY", text: textCandidate } };
        }
    }
    return { action: { type: "SAY", text: JSON.stringify(a ?? {}) } };
}

/* =============== LLM calls =============== */
async function decideWithLLM(query: string, context: UIContext): Promise<{ action: Action }> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return { action: { type: "SAY", text: "OPENAI_API_KEY is missing on the server." } };
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
            { role: "user", content: buildUserPrompt(query, context, peopleChunk, activitiesChunk, companiesChunk, chatHistory) },
        ],
    });

    const content = resp.choices?.[0]?.message?.content ?? "{}";
    try {
        const parsed: unknown = JSON.parse(content);
        return coerceAction(parsed);
    } catch {
        return { action: { type: "SAY", text: "Could not parse model response." } };
    }
}

async function uiStringsFor(query: string): Promise<{ ui: UIStrings }> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return {
            ui: {
                openTitle: "Assistant (⌘K / Ctrl+K)",
                openAria: "Open assistant",
                headerTitle: "Assistant",
                headerBadge: "beta",
                placeholder: 'Type what you need… e.g. "open Juan" / "export sales report"',
                ask: "Ask",
                close: "Close",
                thinking: "Thinking…",
                errGeneric: "There was a problem with the AI. Try again.",
                errDidntUnderstand:
                    'I didn’t understand. Try “open Juan”, “export María”, or “open sales report”.',
            },
        };
    }
    const client = new OpenAI({ apiKey });
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const resp = await client.chat.completions.create({
        model,
        response_format: { type: "json_object" },
        temperature: 0.2,
        messages: [
            { role: "system", content: UI_SYSTEM_PROMPT },
            { role: "user", content: query || "" },
        ],
    });
    const content = resp.choices?.[0]?.message?.content || "{}";
    try {
        const parsed = JSON.parse(content) as { ui?: UIStrings };
        if (parsed?.ui) return { ui: parsed.ui };
    } catch { }
    return {
        ui: {
            openTitle: "Assistant (⌘K / Ctrl+K)",
            openAria: "Open assistant",
            headerTitle: "Assistant",
            headerBadge: "beta",
            placeholder: 'Type what you need… e.g. "open Juan" / "export sales report"',
            ask: "Ask",
            close: "Close",
            thinking: "Thinking…",
            errGeneric: "There was a problem with the AI. Try again.",
            errDidntUnderstand:
                'I didn’t understand. Try “open Juan”, “export María”, or “open sales report”.',
        },
    };
}

/* =============== Route handler =============== */
export async function POST(req: NextRequest) {
    const raw = await req.json().catch(() => ({}));
    const body = (typeof raw === "object" && raw !== null ? raw : {}) as {
        query?: string;
        mode?: "HINT" | "DECIDE" | "UI";
        context?: unknown;
    };

    const query = body?.query ?? "";
    const mode = body?.mode ?? "DECIDE";
    const context: UIContext =
        (typeof body?.context === "object" && body?.context !== null
            ? (body.context as Record<string, unknown>)
            : {}) as UIContext;

    if (mode === "UI") {
        const ui = await uiStringsFor(query);
        return NextResponse.json(ui);
    }

    if (mode === "HINT") {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return NextResponse.json<{ action: Action }>({
                action: { type: "SAY", text: "Ready to help." },
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
                    content:
                        'Return ONLY {"action":{"type":"SAY","text":"..."}} (<=12 words). Language should match the user query; default English.',
                },
                {
                    role: "user",
                    content: "Short hint encouraging to ask about anything, or CRM data if relevant.",
                },
            ],
        });
        const content = hintResp.choices?.[0]?.message?.content || "";
        try {
            const parsed: unknown = JSON.parse(content);
            return NextResponse.json(parsed);
        } catch {
            return NextResponse.json<{ action: Action }>({ action: { type: "SAY", text: "Ready to help." } });
        }
    }

    const result = await decideWithLLM(query, context);

    if (result?.action?.type === "SAY") {
        const say = result.action.text || "";
        pushHistory({ q: query, a: say, metric: lastMetric() });
    }

    return NextResponse.json(result);
}
