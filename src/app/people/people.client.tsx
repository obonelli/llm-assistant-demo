"use client";

import { useRouter, usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { PEOPLE, type Person } from "@/mock/people";
import QuickSwitch from "@/app/components/QuickSwitch";

export default function PeopleClient({ initialQ }: { initialQ: string }) {
    const [query, setQuery] = useState(initialQ);
    const [openIds, setOpenIds] = useState<Set<string>>(new Set());
    const router = useRouter();
    const pathname = usePathname();

    const terms = useMemo(() => {
        const t = query.toLowerCase().trim();
        return t === "" ? [] : t.split(/\s+/).filter(Boolean);
    }, [query]);

    const people: Person[] =
        terms.length === 0
            ? PEOPLE
            : PEOPLE.filter((p) => {
                const hay = `${p.name} ${p.email} ${p.company} ${p.role}`.toLowerCase();
                return terms.every((t) => hay.includes(t));
            });

    const clearQuery = () => {
        setQuery("");
        router.replace(pathname);
    };

    const toggleId = (id: string) =>
        setOpenIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });

    return (
        <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 pb-20">
            {/* Header + Search */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-xl sm:text-2xl font-semibold">People</h1>
                    {query ? (
                        <p className="text-sm text-white/60">
                            Showing results for{" "}
                            <span className="text-white/80">&ldquo;{query}&rdquo;</span>
                        </p>
                    ) : (
                        <p className="text-sm text-white/60">Simple people list.</p>
                    )}
                </div>

                <form className="flex w-full items-center gap-2 sm:w-auto" action="/people">
                    <div className="relative flex-1 sm:flex-none sm:w-[320px]">
                        <input
                            name="q"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search people…"
                            className="w-full rounded-md bg-white/5 pr-9 pl-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-white/20"
                        />
                        {query.length > 0 && (
                            <button
                                type="button"
                                onClick={clearQuery}
                                aria-label="Clear search"
                                title="Clear"
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md
                  border border-white/10 bg-white/10 px-2 py-0.5 text-xs
                  text-white/80 hover:bg-white/20"
                            >
                                ×
                            </button>
                        )}
                    </div>

                    <button className="shrink-0 rounded-md bg-cyan-500/20 px-3 py-2 text-sm ring-1 ring-cyan-400/30 hover:bg-cyan-500/30">
                        Search
                    </button>
                </form>
            </div>

            {/* -------- Mobile: casilleros -------- */}
            {/* -------- Mobile: casilleros -------- */}
            <ul className="sm:hidden space-y-3">
                {people.map((p) => {
                    const open = openIds.has(p.id);
                    return (
                        <li key={p.id} className="rounded-xl ring-1 ring-white/10 bg-white/[0.03]">
                            <button
                                onClick={() => toggleId(p.id)}
                                className="w-full px-4 py-3 flex items-center gap-3"
                                aria-expanded={open}
                                aria-controls={`person-${p.id}-panel`}
                            >
                                {/* IZQUIERDA: ocupa todo y alinea a la izquierda */}
                                <div className="min-w-0 flex-1 text-left">
                                    <span className="block font-medium text-white/90 truncate">
                                        {p.name}
                                    </span>
                                    <div className="mt-1 text-xs text-white/60 truncate">
                                        {p.company} <span className="mx-1">·</span> {p.role}
                                    </div>
                                </div>

                                {/* Chevron a la derecha */}
                                <svg
                                    className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : "rotate-0"}`}
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    aria-hidden="true"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </button>

                            <div
                                id={`person-${p.id}-panel`}
                                className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                                    }`}
                            >
                                <div className="overflow-hidden">
                                    <div className="px-4 pb-3 pt-1 text-sm">
                                        <div className="text-xs text-white/50">Email</div>
                                        <div className="break-all text-white/80">{p.email}</div>
                                        <div className="mt-2 text-xs text-white/50">Role</div>
                                        <div>{p.role}</div>
                                        <div className="mt-2 text-xs text-white/50">Company</div>
                                        <div>{p.company}</div>
                                    </div>
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>

            {/* -------- Desktop: tabla -------- */}
            <div className="mt-3 hidden sm:block overflow-hidden rounded-xl ring-1 ring-white/10">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                        <thead className="bg-white/5 text-left">
                            <tr>
                                <th className="px-4 py-3">Name</th>
                                <th className="px-4 py-3">Email</th>
                                <th className="px-4 py-3">Role</th>
                                <th
                                    onClick={() => router.push("/companies")}
                                    className="px-4 py-3 cursor-pointer text-cyan-400 hover:underline"
                                    title="Go to companies"
                                >
                                    Company
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {people.map((p) => (
                                <tr
                                    key={p.id}
                                    className="border-t border-white/10 hover:bg-white/[0.03]"
                                >
                                    <td className="px-4 py-3 font-medium text-white/90">{p.name}</td>
                                    <td className="px-4 py-3 text-white/80">{p.email}</td>
                                    <td className="px-4 py-3">{p.role}</td>
                                    <td className="px-4 py-3">{p.company}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <p className="mt-3 text-xs text-white/50">{people.length} shown</p>

            <QuickSwitch />
        </main>
    );
}
