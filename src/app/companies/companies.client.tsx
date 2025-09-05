"use client";

import { useRouter, usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { COMPANIES, type Company } from "@/mock/companies";
import QuickSwitch from "@/app/components/QuickSwitch";

export default function CompaniesClient({ initialQ }: { initialQ: string }) {
    const [query, setQuery] = useState(initialQ);
    const [openIds, setOpenIds] = useState<Set<string>>(new Set());
    const router = useRouter();
    const pathname = usePathname();

    const terms = useMemo(() => {
        const t = query.toLowerCase().trim();
        return t === "" ? [] : t.split(/\s+/).filter(Boolean);
    }, [query]);

    const companies: Company[] =
        terms.length === 0
            ? COMPANIES
            : COMPANIES.filter((c) => {
                const hay = `${c.name} ${c.industry} ${c.city} ${c.country}`.toLowerCase();
                return terms.every((t) => hay.includes(t));
            });

    const clearQuery = () => {
        setQuery("");
        router.replace(pathname);
    };

    const toggleId = (id: string) =>
        setOpenIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });

    return (
        <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 pb-20">
            {/* Header + Search */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-xl sm:text-2xl font-semibold">Companies</h1>
                    {query ? (
                        <p className="text-sm text-white/60">
                            Showing results for{" "}
                            <span className="text-white/80">&ldquo;{query}&rdquo;</span>
                        </p>
                    ) : (
                        <p className="text-sm text-white/60">Simple company list.</p>
                    )}
                </div>

                {/* Search full-width in mobile */}
                <form className="flex w-full items-center gap-2 sm:w-auto" action="/companies">
                    <div className="relative flex-1 sm:flex-none sm:w-[320px]">
                        <input
                            name="q"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search companies…"
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

            {/* -------- Mobile: “casilleros” colapsables -------- */}
            <ul className="sm:hidden space-y-3">
                {companies.map((c) => {
                    const open = openIds.has(c.id);
                    return (
                        <li key={c.id} className="rounded-xl ring-1 ring-white/10 bg-white/[0.03]">
                            {/* Header del casillero */}
                            <button
                                onClick={() => toggleId(c.id)}
                                className="w-full p-3 flex items-center justify-between"
                                aria-expanded={open}
                                aria-controls={`company-${c.id}-panel`}
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-white/90 truncate">{c.name}</span>
                                    </div>
                                    <div className="mt-1 text-xs text-white/60 truncate">
                                        {c.industry} <span className="mx-1">·</span> {c.city}
                                    </div>
                                </div>

                                <div className="ml-3 flex items-center gap-2 shrink-0">
                                    <span className="rounded-md px-2 py-1 text-xs tabular-nums ring-1 ring-white/10 bg-white/5">
                                        {c.employees.toLocaleString()}
                                    </span>
                                    <svg
                                        className={`h-4 w-4 transition-transform ${open ? "rotate-180" : "rotate-0"}`}
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
                                </div>
                            </button>

                            {/* Panel expandible */}
                            <div
                                id={`company-${c.id}-panel`}
                                className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                                    }`}
                            >
                                <div className="overflow-hidden">
                                    <div className="px-3 pb-3 pt-1">
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                            <div>
                                                <div className="text-xs text-white/50">Industry</div>
                                                <div>{c.industry}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-white/50">City</div>
                                                <div>{c.city}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-white/50">Country</div>
                                                <div>{c.country}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-white/50">Employees</div>
                                                <div className="tabular-nums">{c.employees.toLocaleString()}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>

            {/* -------- Desktop: tabla normal (Employees clickeable) -------- */}
            <div className="mt-3 hidden sm:block overflow-hidden rounded-xl ring-1 ring-white/10">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                        <thead className="bg-white/5 text-left">
                            <tr>
                                <th className="px-4 py-3">Name</th>
                                <th className="px-4 py-3">Industry</th>
                                <th className="px-4 py-3">City</th>
                                <th className="px-4 py-3">Country</th>
                                <th
                                    onClick={() => router.push("/people")}
                                    className="px-4 py-3 text-right cursor-pointer text-cyan-400 hover:underline"
                                    title="Go to people"
                                >
                                    Employees
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {companies.map((c) => (
                                <tr
                                    key={c.id}
                                    className="border-t border-white/10 hover:bg-white/[0.03]"
                                >
                                    <td className="px-4 py-3 font-medium text-white/90">{c.name}</td>
                                    <td className="px-4 py-3">{c.industry}</td>
                                    <td className="px-4 py-3">{c.city}</td>
                                    <td className="px-4 py-3">{c.country}</td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => router.push("/people")}
                                            className="tabular-nums hover:underline cursor-pointer"
                                            aria-label={`View people of ${c.name}`}
                                            title="View people"
                                        >
                                            {c.employees.toLocaleString()}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <p className="mt-3 text-xs text-white/50">{companies.length} shown</p>

            <QuickSwitch />
        </main>
    );
}
