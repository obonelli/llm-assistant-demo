// src/components/QuickSwitch.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function QuickSwitch() {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const r = useRouter();

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                e.preventDefault(); setOpen((v) => !v);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    if (!open) return null;

    const go = (path: string) => { setOpen(false); setQ(""); r.push(path); };

    return (
        <div className="fixed inset-0 z-[100] bg-black/50 p-6">
            <div className="mx-auto max-w-lg rounded-xl border border-white/10 bg-zinc-900">
                <input
                    autoFocus value={q} onChange={(e) => setQ(e.target.value)}
                    placeholder="People, Companies… (⌘K)"
                    className="w-full border-b border-white/10 bg-transparent px-4 py-3 outline-none"
                />
                <div className="p-2 text-sm">
                    <button onClick={() => go("/people")} className="block w-full rounded px-3 py-2 text-left hover:bg-white/5">People</button>
                    <button onClick={() => go("/companies")} className="block w-full rounded px-3 py-2 text-left hover:bg-white/5">Companies</button>
                    {q && (
                        <>
                            <button onClick={() => go(`/people?q=${encodeURIComponent(q)}`)} className="mt-2 block w-full rounded px-3 py-2 text-left hover:bg-white/5">
                                Buscar “{q}” en People
                            </button>
                            <button onClick={() => go(`/companies?q=${encodeURIComponent(q)}`)} className="block w-full rounded px-3 py-2 text-left hover:bg-white/5">
                                Buscar “{q}” en Companies
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
