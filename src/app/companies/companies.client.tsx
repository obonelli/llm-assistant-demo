"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { COMPANIES, type Company } from "@/mock/companies";
import QuickSwitch from "@/app/components/QuickSwitch";

export default function CompaniesClient({ initialQ }: { initialQ: string }) {
    const [query, setQuery] = useState(initialQ);
    const router = useRouter();
    const pathname = usePathname();

    const terms =
        query.toLowerCase().trim() === ""
            ? []
            : query.toLowerCase().trim().split(/\s+/).filter(Boolean);

    const companies: Company[] =
        terms.length === 0
            ? COMPANIES
            : COMPANIES.filter((c) => {
                const hay = `${c.name} ${c.industry} ${c.city} ${c.country}`.toLowerCase();
                return terms.every((t) => hay.includes(t));
            });

    const clearQuery = () => {
        setQuery("");
        router.replace(pathname); // limpia también la URL
    };

    return (
        <main className="mx-auto max-w-6xl px-6 pb-10">
            <div className="mb-4 flex items-end justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Companies</h1>
                    {query ? (
                        <p className="text-sm text-white/60">
                            Showing results for{" "}
                            <span className="text-white/80">&ldquo;{query}&rdquo;</span>
                        </p>
                    ) : (
                        <p className="text-sm text-white/60">Simple company list.</p>
                    )}
                </div>

                {/* Search + tachita dinámica */}
                <form className="flex gap-2" action="/companies">
                    <div className="relative">
                        <input
                            name="q"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search companies…"
                            className="w-[260px] rounded-md bg-white/5 pr-9 pl-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-white/20"
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

                    <button className="rounded-md bg-cyan-500/20 px-3 py-2 text-sm ring-1 ring-cyan-400/30 hover:bg-cyan-500/30">
                        Search
                    </button>
                </form>
            </div>

            <div className="overflow-hidden rounded-xl ring-1 ring-white/10">
                <table className="w-full text-sm">
                    <thead className="bg-white/5 text-left">
                        <tr>
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">Industry</th>
                            <th className="px-4 py-3">City</th>
                            <th className="px-4 py-3">Country</th>
                            <th className="px-4 py-3 text-right">Employees</th>
                        </tr>
                    </thead>
                    <tbody>
                        {companies.map((c) => (
                            <tr
                                key={c.id}
                                className="border-t border-white/10 hover:bg-white/[0.03]"
                            >
                                {/* Ya no es Link: texto plano */}
                                <td className="px-4 py-3 font-medium text-white/90">{c.name}</td>
                                <td className="px-4 py-3">{c.industry}</td>
                                <td className="px-4 py-3">{c.city}</td>
                                <td className="px-4 py-3">{c.country}</td>
                                <td className="px-4 py-3 text-right tabular-nums">
                                    {c.employees.toLocaleString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <p className="mt-3 text-xs text-white/50">{companies.length} shown</p>

            <QuickSwitch />
        </main>
    );
}
