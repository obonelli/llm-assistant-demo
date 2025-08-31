// src/app/api/reports/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PEOPLE } from "@/mock/people";
import { ACTIVITY } from "@/mock/activity";
import OpenAI from "openai";

type Body = {
    personIds?: string[];
    from?: string; // yyyy-mm-dd
    to?: string;   // yyyy-mm-dd
};

type ActivityRow = {
    personId: string;
    date: string;
    action: string;
    notes?: string;
    amount?: number;
    kind?: "debit" | "credit";
};

export async function POST(req: NextRequest) {
    const body = (await req.json().catch(() => ({}))) as Body;

    const ids = (body.personIds ?? []).filter(Boolean);
    const from = body.from ? new Date(body.from + "T00:00:00") : null;
    const to = body.to ? new Date(body.to + "T23:59:59") : null;

    const peopleMap = new Map(PEOPLE.map((p) => [p.id, p]));
    const chosen = ids.length ? PEOPLE.filter((p) => ids.includes(p.id)) : PEOPLE;

    // Agregación
    type Row = {
        id: string;
        name: string;
        count: number;
        debit: number;
        credit: number;
        balance: number;
        firstDate: string | null;
        lastDate: string | null;
    };
    const grouped = new Map<string, Row>();

    const acts = (ACTIVITY as ActivityRow[]);
    for (const a of acts) {
        if (!peopleMap.has(a.personId)) continue;
        if (ids.length && !ids.includes(a.personId)) continue;

        const d = new Date(a.date + "T00:00:00");
        if (from && d < from) continue;
        if (to && d > to) continue;

        const p = peopleMap.get(a.personId)!;
        const r =
            grouped.get(a.personId) ||
            ({
                id: a.personId,
                name: p.name,
                count: 0,
                debit: 0,
                credit: 0,
                balance: 0,
                firstDate: null,
                lastDate: null,
            } as Row);

        r.count += 1;
        const amt = typeof a.amount === "number" ? a.amount : 0;
        if (a.kind === "debit") r.debit += amt;
        if (a.kind === "credit") r.credit += amt;
        r.balance = r.credit - r.debit;

        if (!r.firstDate || a.date < r.firstDate) r.firstDate = a.date;
        if (!r.lastDate || a.date > r.lastDate) r.lastDate = a.date;

        grouped.set(a.personId, r);
    }

    const rows = Array.from(grouped.values()).sort((a, b) => b.balance - a.balance);
    const total = rows.reduce(
        (acc, r) => {
            acc.count += r.count;
            acc.debit += r.debit;
            acc.credit += r.credit;
            acc.balance += r.balance;
            return acc;
        },
        { count: 0, debit: 0, credit: 0, balance: 0 },
    );

    const rangeTxt =
        (body.from ? `Desde **${body.from}**` : "") +
        (body.from && body.to ? " " : "") +
        (body.to ? `Hasta **${body.to}**` : "") ||
        "Rango: **completo**";

    // Tabla MD
    const tableHeader = `| Person | Count | Debit | Credit | Balance | First | Last |
|---|---:|---:|---:|---:|---|---|`;

    const tableRows = rows
        .map(
            (r) =>
                `| ${r.name} | ${r.count} | ${r.debit.toFixed(2)} | ${r.credit.toFixed(2)} | ${r.balance.toFixed(
                    2,
                )} | ${r.firstDate ?? ""} | ${r.lastDate ?? ""} |`,
        )
        .join("\n");

    // Optional executive summary con IA
    let executive = "";
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
        try {
            const client = new OpenAI({ apiKey });
            const prompt = `
Eres analista contable. Resume 3 hallazgos clave del siguiente consolidado (breve, claro, sin florituras):

- Totales: debit=${total.debit.toFixed(2)}, credit=${total.credit.toFixed(2)}, balance=${total.balance.toFixed(2)}, count=${total.count}
- Top 3 por balance:
${rows.slice(0, 3).map((r, i) => `${i + 1}. ${r.name} (bal=${r.balance.toFixed(2)}, deb=${r.debit.toFixed(2)}, cred=${r.credit.toFixed(2)}, cnt=${r.count})`).join("\n")}
- Rango: ${rangeTxt}
`;
            const resp = await client.chat.completions.create({
                model: process.env.OPENAI_MODEL || "gpt-4o-mini",
                temperature: 0.2,
                messages: [{ role: "user", content: prompt }],
            });
            executive = (resp.choices?.[0]?.message?.content || "").trim();
        } catch {
            executive = "";
        }
    }

    const md = `# Reporte de Personas / Actividades

${rangeTxt}

${executive ? `> **Executive summary**\n>\n> ${executive.replace(/\n/g, "\n> ")}\n\n` : ""}

## Totales
- **Debit:** ${total.debit.toFixed(2)}
- **Credit:** ${total.credit.toFixed(2)}
- **Balance:** ${total.balance.toFixed(2)}
- **Count:** ${total.count}

## Detalle por persona
${tableHeader}
${tableRows || "_(sin registros en el rango)_"}

---

_Generado automáticamente a partir de PEOPLE + ACTIVITY._
`;

    const filename =
        `report_${body.from ?? "all"}_${body.to ?? "all"}_${Date.now().toString().slice(-6)}.md`;

    return NextResponse.json({ ok: true, md, filename });
}
