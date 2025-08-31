"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { type Person } from "@/mock/people";
import { ACTIVITY } from "@/mock/activity";
import * as XLSX from "xlsx";

type Props = { initialPeople: Person[] };
type SortKey = "name" | "email" | "company" | "role" | "debit" | "credit" | "balance";

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

export default function PeopleTable({ initialPeople }: Props) {
    const [rows, setRows] = useState<Person[]>(initialPeople);
    const [q, setQ] = useState("");
    const [debouncedQ, setDebouncedQ] = useState("");
    const [sortKey, setSortKey] = useState<SortKey>("name");
    const [asc, setAsc] = useState(true);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [from, setFrom] = useState<string>("");
    const [to, setTo] = useState<string>("");

    const [editing, setEditing] = useState<{ id: string | null; field?: "company" | "role" }>({ id: null });

    const allCheckboxRef = useRef<HTMLInputElement>(null);

    useEffect(() => setRows(initialPeople), [initialPeople]);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedQ(q.trim().toLowerCase()), 150);
        return () => clearTimeout(t);
    }, [q]);

    const byId = useMemo(() => {
        const m = new Map<string, Person>();
        rows.forEach((p) => m.set(p.id, p));
        return m;
    }, [rows]);

    // agregados por persona
    const aggregates = useMemo(() => {
        const res = new Map<string, { debit: number; credit: number; balance: number }>();
        const fromT = from ? new Date(from + "T00:00:00").getTime() : -Infinity;
        const toT = to ? new Date(to + "T23:59:59").getTime() : Infinity;

        for (const a of ACTIVITY as ActivityRow[]) {
            if (!byId.has(a.personId)) continue;
            const t = new Date(a.date + "T00:00:00").getTime();
            if (t < fromT || t > toT) continue;
            const agg = res.get(a.personId) || { debit: 0, credit: 0, balance: 0 };
            const amt = typeof a.amount === "number" ? a.amount : 0;
            if (a.kind === "debit") agg.debit += amt;
            if (a.kind === "credit") agg.credit += amt;
            agg.balance = agg.credit - agg.debit;
            res.set(a.personId, agg);
        }
        return res;
    }, [byId, from, to]);

    const filtered = useMemo(() => {
        let r = rows;
        if (debouncedQ) {
            r = r.filter((p) => {
                const hay = `${p.name} ${p.email} ${p.company} ${p.role}`.toLowerCase();
                return hay.includes(debouncedQ);
            });
        }
        const withTotals = r.map((p) => {
            const agg = aggregates.get(p.id) || { debit: 0, credit: 0, balance: 0 };
            return { ...p, _debit: agg.debit, _credit: agg.credit, _balance: agg.balance };
        });
        withTotals.sort((a, b) => {
            const pick = (x: any) => {
                if (sortKey === "debit") return x._debit;
                if (sortKey === "credit") return x._credit;
                if (sortKey === "balance") return x._balance;
                return String(x[sortKey] ?? "").toLowerCase();
            };
            const av = pick(a);
            const bv = pick(b);
            if (typeof av === "number" && typeof bv === "number") return asc ? av - bv : bv - av;
            if (av < bv) return asc ? -1 : 1;
            if (av > bv) return asc ? 1 : -1;
            return 0;
        });
        return withTotals;
    }, [rows, debouncedQ, sortKey, asc, aggregates]);

    // checkbox maestro
    useEffect(() => {
        const el = allCheckboxRef.current;
        if (!el) return;
        const allChecked = filtered.length > 0 && filtered.every((p: any) => selected.has(p.id));
        const some = selected.size > 0 && !allChecked;
        el.indeterminate = some;
        el.checked = allChecked;
    }, [filtered, selected]);

    const toggleSort = (k: SortKey) => {
        if (k === sortKey) setAsc((v) => !v);
        else {
            setSortKey(k);
            setAsc(true);
        }
    };

    const toggleAll = (on: boolean) => {
        if (on) setSelected(new Set(filtered.map((p: any) => p.id)));
        else setSelected(new Set());
    };

    const toggleOne = (id: string) => {
        setSelected((prev) => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });
    };

    // ===== Exportar a Excel (.xlsx)
    const exportExcel = () => {
        const pick = filtered.filter((p: any) => selected.has(p.id));
        const list = (pick.length ? pick : filtered) as any[];

        const aoa = [
            ["Name", "Email", "Company", "Role", "Debit", "Credit", "Balance"],
            ...list.map((p) => [p.name, p.email, p.company, p.role, +p._debit || 0, +p._credit || 0, +p._balance || 0]),
        ];

        const totalDebit = list.reduce((acc, p) => acc + (+p._debit || 0), 0);
        const totalCredit = list.reduce((acc, p) => acc + (+p._credit || 0), 0);
        const totalBalance = list.reduce((acc, p) => acc + (+p._balance || 0), 0);
        aoa.push([]);
        aoa.push(["TOTALS", "", "", "", totalDebit, totalCredit, totalBalance]);

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws["!cols"] = [
            { wch: 22 },
            { wch: 24 },
            { wch: 18 },
            { wch: 18 },
            { wch: 12 },
            { wch: 12 },
            { wch: 12 },
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "People");

        const filename = `people_${from || "all"}_${to || "all"}.xlsx`;
        XLSX.writeFile(wb, filename);
    };

    const commitEdit = (id: string, field: "company" | "role", value: string) => {
        setRows((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
        setEditing({ id: null });
    };

    const fmt = (n: number) =>
        n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const anySelected = selected.size > 0;

    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4" data-ai-key="people-table">
            {/* Controles superiores */}
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search people…"
                        className="w-[260px] rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder-white/50 focus:border-white/20"
                    />
                    <label className="text-sm text-white/70">
                        From{" "}
                        <input
                            type="date"
                            value={from}
                            onChange={(e) => setFrom(e.target.value)}
                            className="ml-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-sm outline-none"
                        />
                    </label>
                    <label className="text-sm text-white/70">
                        To{" "}
                        <input
                            type="date"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                            className="ml-1 rounded border border-white/10 bg-white/5 px-2 py-1 text-sm outline-none"
                        />
                    </label>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={exportExcel} className="neon-btn px-3 py-1.5 text-sm">
                        Export Excel
                    </button>
                </div>
            </div>

            {/* Tabla sin columna Actions */}
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="text-left text-white/70">
                        <tr>
                            <th className="px-3 py-2">
                                <input ref={allCheckboxRef} type="checkbox" aria-label="Select all" onChange={(e) => toggleAll(e.target.checked)} />
                            </th>
                            <Th label="Name" k="name" sortKey={sortKey} asc={asc} onClick={toggleSort} />
                            <Th label="Email" k="email" sortKey={sortKey} asc={asc} onClick={toggleSort} />
                            <Th label="Company" k="company" sortKey={sortKey} asc={asc} onClick={toggleSort} />
                            <Th label="Role" k="role" sortKey={sortKey} asc={asc} onClick={toggleSort} />
                            <Th label="Debit" k="debit" sortKey={sortKey} asc={asc} onClick={toggleSort} />
                            <Th label="Credit" k="credit" sortKey={sortKey} asc={asc} onClick={toggleSort} />
                            <Th label="Balance" k="balance" sortKey={sortKey} asc={asc} onClick={toggleSort} />
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 && (
                            <tr>
                                <td className="px-3 py-6 text-white/60" colSpan={8}>
                                    No matches.
                                </td>
                            </tr>
                        )}
                        {filtered.map((p: any) => {
                            const isEditingCompany = editing.id === p.id && editing.field === "company";
                            const isEditingRole = editing.id === p.id && editing.field === "role";
                            return (
                                <tr key={p.id} className="border-t border-white/10 hover:bg-white/5">
                                    <td className="px-3 py-2">
                                        <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} aria-label={`Select ${p.name}`} />
                                    </td>
                                    <td className="px-3 py-2">{p.name}</td>
                                    <td className="px-3 py-2 text-white/80">{p.email}</td>
                                    <td className="px-3 py-2">
                                        {isEditingCompany ? (
                                            <input
                                                defaultValue={p.company}
                                                onBlur={(e) => commitEdit(p.id, "company", e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                                    if (e.key === "Escape") setEditing({ id: null });
                                                }}
                                                className="rounded border border-white/10 bg-white/5 px-2 py-1 outline-none"
                                                autoFocus
                                            />
                                        ) : (
                                            <button
                                                className="underline decoration-dotted underline-offset-2 text-left"
                                                onClick={() => setEditing({ id: p.id, field: "company" })}
                                                title="Edit company"
                                            >
                                                {p.company}
                                            </button>
                                        )}
                                    </td>
                                    <td className="px-3 py-2">
                                        {isEditingRole ? (
                                            <input
                                                defaultValue={p.role}
                                                onBlur={(e) => commitEdit(p.id, "role", e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                                    if (e.key === "Escape") setEditing({ id: null });
                                                }}
                                                className="rounded border border-white/10 bg-white/5 px-2 py-1 outline-none"
                                                autoFocus
                                            />
                                        ) : (
                                            <button
                                                className="underline decoration-dotted underline-offset-2 text-left"
                                                onClick={() => setEditing({ id: p.id, field: "role" })}
                                                title="Edit role"
                                            >
                                                {p.role}
                                            </button>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums">{fmt(p._debit || 0)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{fmt(p._credit || 0)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{fmt(p._balance || 0)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="mt-3 text-xs text-white/60">
                {selected.size} selected · {filtered.length} shown
                {anySelected ? (
                    <button className="ml-3 underline text-white/70 hover:text-white" onClick={() => setSelected(new Set())}>
                        Clear selection
                    </button>
                ) : null}
            </div>
        </div>
    );
}

function Th({
    label,
    k,
    sortKey,
    asc,
    onClick,
}: {
    label: string;
    k: SortKey;
    sortKey: string;
    asc: boolean;
    onClick: (k: SortKey) => void;
}) {
    const active = sortKey === k;
    return (
        <th className="cursor-pointer select-none px-3 py-2" onClick={() => onClick(k)} title="Sort">
            <span className="inline-flex items-center gap-1">
                {label}
                {active ? <span className="opacity-60">{asc ? "▲" : "▼"}</span> : <span className="opacity-30">↕</span>}
            </span>
        </th>
    );
}
