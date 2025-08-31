// src/app/people/[id]/ActivitiesTable.tsx
"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ACTIVITY } from "@/mock/activity";

type Activity = (typeof ACTIVITY)[number];

export default function ActivitiesTable() {
    const params = useParams() as { id: string };
    const personId = params.id;

    // demo: filtramos por persona y clonamos al estado editable
    const initial = useMemo(() => ACTIVITY.filter(a => a.personId === personId), [personId]);
    const [rows, setRows] = useState<Activity[]>(initial);

    const addRow = () => {
        setRows(prev => [
            ...prev,
            { personId, date: new Date().toISOString().slice(0, 10), action: "Cargo", amount: 0, kind: "debit", account: "Gastos", category: "", notes: "" }
        ]);
    };

    const delRow = (idx: number) => {
        setRows(prev => prev.filter((_, i) => i !== idx));
    };

    const update = <K extends keyof Activity>(idx: number, key: K, value: Activity[K]) => {
        setRows(prev => prev.map((r, i) => i === idx ? { ...r, [key]: value } : r));
    };

    const exportCSV = () => {
        const headers = ["date", "action", "amount", "kind", "account", "category", "ref", "notes"];
        const lines = [headers.join(",")];
        for (const r of rows) {
            const vals = [
                r.date, r.action, r.amount ?? "", r.kind ?? "", r.account ?? "", r.category ?? "", r.ref ?? "", r.notes ?? ""
            ].map(v => `"${String(v ?? "").replace(/"/g, '""')}"`);
            lines.push(vals.join(","));
        }
        const csv = "\uFEFF" + lines.join("\n") + "\n";
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `activities_${personId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const totals = useMemo(() => {
        let debit = 0, credit = 0;
        for (const r of rows) {
            const amt = typeof r.amount === "number" ? r.amount : 0;
            if (r.kind === "debit") debit += amt;
            if (r.kind === "credit") credit += amt;
        }
        return { debit, credit, balance: credit - debit };
    }, [rows]);

    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4" data-ai-key="activity-list">
            <div className="mb-3 flex items-center gap-2">
                <button onClick={addRow} className="neon-btn px-3 py-1.5 text-sm">Add</button>
                <button onClick={exportCSV} className="rounded-lg border border-white/10 bg-white/7 px-3 py-1.5 text-sm hover:bg-white/10">Export CSV</button>
                <div className="ml-auto text-sm text-white/70">
                    <b>Debit:</b> {fmt(totals.debit)} · <b>Credit:</b> {fmt(totals.credit)} · <b>Balance:</b> {fmt(totals.balance)}
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="text-left text-white/70">
                        <tr>
                            <th className="px-2 py-2">Date</th>
                            <th className="px-2 py-2">Action</th>
                            <th className="px-2 py-2 text-right">Amount</th>
                            <th className="px-2 py-2">Kind</th>
                            <th className="px-2 py-2">Account</th>
                            <th className="px-2 py-2">Category</th>
                            <th className="px-2 py-2">Ref</th>
                            <th className="px-2 py-2">Notes</th>
                            <th className="px-2 py-2"> </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && <tr><td colSpan={9} className="px-2 py-6 text-white/60">No records.</td></tr>}
                        {rows.map((r, i) => (
                            <tr key={i} className="border-t border-white/10">
                                <td className="px-2 py-1.5">
                                    <input type="date" value={r.date} onChange={(e) => update(i, "date", e.target.value)} className="rounded border border-white/10 bg-white/5 px-2 py-1 outline-none" />
                                </td>
                                <td className="px-2 py-1.5">
                                    <input value={r.action} onChange={(e) => update(i, "action", e.target.value)} className="w-36 rounded border border-white/10 bg-white/5 px-2 py-1 outline-none" />
                                </td>
                                <td className="px-2 py-1.5 text-right">
                                    <input
                                        inputMode="decimal"
                                        value={r.amount ?? ""}
                                        onChange={(e) => update(i, "amount", e.target.value === "" ? undefined : Number(e.target.value))}
                                        className="w-24 text-right rounded border border-white/10 bg-white/5 px-2 py-1 outline-none"
                                        placeholder="0.00"
                                    />
                                </td>
                                <td className="px-2 py-1.5">
                                    <select value={r.kind ?? ""} onChange={(e) => update(i, "kind", (e.target.value || undefined) as any)} className="rounded border border-white/10 bg-white/5 px-2 py-1 outline-none">
                                        <option value="">—</option>
                                        <option value="debit">debit</option>
                                        <option value="credit">credit</option>
                                    </select>
                                </td>
                                <td className="px-2 py-1.5">
                                    <input value={r.account ?? ""} onChange={(e) => update(i, "account", e.target.value)} className="w-36 rounded border border-white/10 bg-white/5 px-2 py-1 outline-none" />
                                </td>
                                <td className="px-2 py-1.5">
                                    <input value={r.category ?? ""} onChange={(e) => update(i, "category", e.target.value)} className="w-36 rounded border border-white/10 bg-white/5 px-2 py-1 outline-none" />
                                </td>
                                <td className="px-2 py-1.5">
                                    <input value={r.ref ?? ""} onChange={(e) => update(i, "ref", e.target.value)} className="w-28 rounded border border-white/10 bg-white/5 px-2 py-1 outline-none" />
                                </td>
                                <td className="px-2 py-1.5">
                                    <input value={r.notes ?? ""} onChange={(e) => update(i, "notes", e.target.value)} className="w-64 rounded border border-white/10 bg-white/5 px-2 py-1 outline-none" />
                                </td>
                                <td className="px-2 py-1.5">
                                    <button onClick={() => delRow(i)} className="rounded border border-white/10 bg-red-500/10 px-2 py-1 text-xs text-red-200 hover:bg-red-500/20">Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <p className="mt-3 text-xs text-white/50">
                Demo: los cambios son locales (no persisten al refrescar). Para persistencia real, podemos agregar un API y DB.
            </p>
        </div>
    );
}
