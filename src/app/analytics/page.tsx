// src/app/analytics/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PEOPLE } from "@/mock/people";
import { ACTIVITY } from "@/mock/activity";

type Row = {
    personId: string;
    person: string;
    count: number;
    debit: number;
    credit: number;
    balance: number;
    firstDate: string | null;
    lastDate: string | null;
};

type ActivityRow = {
    personId: string;
    date: string; // ISO yyyy-mm-dd
    action: string;
    notes?: string;
    amount?: number;
    kind?: "debit" | "credit";
};

function parseDate(s: string) {
    // soporta yyyy-mm-dd, dd/mm/yyyy, dd-mm-yyyy, “junio 2024”
    s = s.trim().toLowerCase();
    const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m1) return new Date(`${m1[1]}-${m1[2]}-${m1[3]}T00:00:00`);
    const m2 = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
    if (m2) return new Date(`${m2[3]}-${m2[2]}-${m2[1]}T00:00:00`);

    const meses = [
        "enero",
        "febrero",
        "marzo",
        "abril",
        "mayo",
        "junio",
        "julio",
        "agosto",
        "septiembre",
        "octubre",
        "noviembre",
        "diciembre",
    ];
    const mm = meses.findIndex((m) => s.includes(m));
    const y = s.match(/\b(20\d{2})\b/);
    if (mm >= 0 && y)
        return new Date(
            `${y[1]}-${String(mm + 1).padStart(2, "0")}-01T00:00:00`
        );
    return null;
}

function downloadCSV(filename: string, rows: Row[]) {
    const headers = [
        "Person",
        "Count",
        "Debit",
        "Credit",
        "Balance",
        "FirstDate",
        "LastDate",
    ];
    const lines = [
        headers.join(","),
        ...rows.map((r) =>
            [
                `"${r.person.replace(/"/g, '""')}"`,
                r.count,
                r.debit.toFixed(2),
                r.credit.toFixed(2),
                r.balance.toFixed(2),
                r.firstDate ?? "",
                r.lastDate ?? "",
            ].join(",")
        ),
    ].join("\n");
    const blob = new Blob([lines], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function normalize(s: string) {
    return (s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

export default function AnalyticsPage() {
    const sp = useSearchParams();
    const initialAsk = sp.get("ask") ?? "";
    const [ask, setAsk] = useState(initialAsk);

    const peopleById = useMemo(() => {
        const m: Record<string, string> = {};
        for (const p of PEOPLE) m[p.id] = p.name;
        return m;
    }, []);

    /** Parser mínimo de NL en español para la demo */
    const parsed = useMemo(() => {
        const q = normalize(ask);

        // top N
        let topN = 0;
        const mTop = q.match(/\btop\s+(\d{1,3})\b/);
        if (mTop) topN = parseInt(mTop[1], 10);

        // personas mencionadas (por nombre o email)
        const personMatches: string[] = [];
        for (const p of PEOPLE) {
            const n = normalize(p.name);
            if (n && q.includes(n)) personMatches.push(p.id);
            else if (p.email && q.includes(normalize(p.email))) personMatches.push(p.id);
        }

        // fechas: "entre X y Y" o “desde X hasta Y”
        let from: Date | null = null,
            to: Date | null = null;
        const mEntre = q.match(
            /\b(entre|desde)\s+([^\s]+(?:\s+\w+)?(?:\s+\d{4})?)\s+(y|hasta)\s+([^\s]+(?:\s+\w+)?(?:\s+\d{4})?)/
        );
        if (mEntre) {
            from = parseDate(mEntre[2]) || null;
            to = parseDate(mEntre[4]) || null;
        } else {
            // “de enero 2024”, “en junio 2024”
            const mMes = q.match(/\b(de|en)\s+([a-záéíóú]+(?:\s+\d{4})?)\b/);
            if (mMes) {
                from = parseDate(mMes[2]) || null;
                if (from) {
                    const t = new Date(from);
                    t.setMonth(t.getMonth() + 1);
                    t.setDate(0); // último día del mes
                    to = t;
                }
            }
        }

        // tipo de métrica: balance/debit/credit
        const wantBalance = /\b(balance|saldo|saldos)\b/.test(q);
        const wantDebit = /\b(debito|debito?s|cargo?s)\b/.test(q);
        const wantCredit = /\b(credito|credito?s|abono?s)\b/.test(q);

        return { topN, personMatches, from, to, wantBalance, wantDebit, wantCredit };
    }, [ask]);

    /** Agregación */
    const rows = useMemo<Row[]>(() => {
        const fromTime = parsed.from?.getTime() ?? -Infinity;
        const toTime = parsed.to?.getTime() ?? Infinity;

        const grouped: Record<string, Row> = {};

        const acts = ACTIVITY as ActivityRow[];
        for (const a of acts) {
            const time = new Date(a.date + "T00:00:00").getTime();
            if (time < fromTime || time > toTime) continue;

            if (parsed.personMatches.length && !parsed.personMatches.includes(a.personId))
                continue;

            const key = a.personId;
            const base =
                grouped[key] ??
                {
                    personId: key,
                    person: peopleById[key] ?? key,
                    count: 0,
                    debit: 0,
                    credit: 0,
                    balance: 0,
                    firstDate: null,
                    lastDate: null,
                };

            base.count += 1;

            // Si tu mock trae montos/kind, los usamos. Si no, cuenta = "peso"
            const amt = typeof a.amount === "number" ? a.amount : 1;
            if (a.kind === "debit") base.debit += amt;
            else if (a.kind === "credit") base.credit += amt;
            else {
                // sin kind ⇒ lo sumamos al balance como +1 (simboliza actividad)
                base.balance += amt;
            }

            const d = a.date;
            if (!base.firstDate || d < base.firstDate) base.firstDate = d;
            if (!base.lastDate || d > base.lastDate) base.lastDate = d;

            grouped[key] = base;
        }

        // balance = credit - debit + balance (si hubo actividades sin kind)
        for (const k of Object.keys(grouped)) {
            const r = grouped[k];
            r.balance = r.credit - r.debit + r.balance;
        }

        let arr = Object.values(grouped);

        // Orden básico según intención
        if (parsed.wantDebit) arr.sort((a, b) => b.debit - a.debit);
        else if (parsed.wantCredit) arr.sort((a, b) => b.credit - a.credit);
        else arr.sort((a, b) => b.balance - a.balance);

        if (parsed.topN > 0) arr = arr.slice(0, parsed.topN);

        return arr;
    }, [parsed, peopleById]);

    return (
        <main className="max-w-5xl mx-auto px-6 py-10">
            <h1 className="text-2xl font-semibold mb-3">Analytics (demo IA)</h1>
            <p className="text-white/70 mb-6">
                Escribe tu consulta en lenguaje natural (ej.{" "}
                <em>“top 5 deudores entre 2024-06-01 y 2024-07-31”</em>,{" "}
                <em>“saldos de Juan Pérez en junio 2024”</em>,{" "}
                <em>“créditos por persona”</em>).
            </p>

            <div className="flex gap-2 mb-4">
                <input
                    value={ask}
                    onChange={(e) => setAsk(e.target.value)}
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 outline-none placeholder-white/50 focus:border-white/20"
                    placeholder="Ej: top 5 deudores entre 2024-06-01 y 2024-07-31"
                />
                <button
                    onClick={() => {
                        /* recalcula solo con useMemo */
                    }}
                    className="rounded-lg border border-white/10 bg-white/8 px-3 py-2 hover:bg-white/10"
                >
                    Run
                </button>
                <button
                    onClick={() => downloadCSV("analytics.csv", rows)}
                    className="rounded-lg border border-white/10 bg-white/8 px-3 py-2 hover:bg-white/10"
                >
                    Download CSV
                </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="min-w-full text-sm">
                    <thead className="bg-white/5">
                        <tr>
                            <th className="text-left px-3 py-2">Person</th>
                            <th className="text-right px-3 py-2">Count</th>
                            <th className="text-right px-3 py-2">Debit</th>
                            <th className="text-right px-3 py-2">Credit</th>
                            <th className="text-right px-3 py-2">Balance</th>
                            <th className="text-left px-3 py-2">FirstDate</th>
                            <th className="text-left px-3 py-2">LastDate</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && (
                            <tr>
                                <td className="px-3 py-4 text-white/60" colSpan={7}>
                                    Sin resultados para esta consulta.
                                </td>
                            </tr>
                        )}
                        {rows.map((r) => (
                            <tr key={r.personId} className="odd:bg-white/[.03]">
                                <td className="px-3 py-2">{r.person}</td>
                                <td className="px-3 py-2 text-right">{r.count}</td>
                                <td className="px-3 py-2 text-right">
                                    {r.debit.toFixed(2)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                    {r.credit.toFixed(2)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                    {r.balance.toFixed(2)}
                                </td>
                                <td className="px-3 py-2">{r.firstDate ?? ""}</td>
                                <td className="px-3 py-2">{r.lastDate ?? ""}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <p className="text-xs text-white/50 mt-3">
                Tip: si a tus <code>ACTIVITY</code> les agregas <code>amount</code> y{" "}
                <code>kind</code> (debit/credit), los totales usan esos montos. Si no,
                cada actividad cuenta como 1.
            </p>
        </main>
    );
}
