// src/app/companies/page.tsx
import Link from "next/link";
import { COMPANIES, type Company } from "@/mock/companies";
import QuickSwitch from "@/app/components/QuickSwitch";

export default async function CompaniesPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string }>;
}) {
    const { q = "" } = await searchParams;
    const terms =
        q.toLowerCase().trim() === ""
            ? []
            : q.toLowerCase().trim().split(/\s+/).filter(Boolean);

    const companies: Company[] =
        terms.length === 0
            ? COMPANIES
            : COMPANIES.filter((c) => {
                const hay = `${c.name} ${c.industry} ${c.city} ${c.country}`.toLowerCase();
                return terms.every((t) => hay.includes(t));
            });

    return (
        <main className="mx-auto max-w-6xl px-6 pb-10">
            <div className="mb-4 flex items-end justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Companies</h1>
                    <p className="text-sm text-white/60">Simple company list.</p>
                </div>

                <form className="flex gap-2" action="/companies">
                    <input
                        name="q"
                        defaultValue={q}
                        placeholder="Search companies…"
                        className="rounded-md bg-white/5 px-3 py-2 text-sm outline-none ring-1 ring-white/10"
                    />
                    <button className="rounded-md bg-cyan-500/20 px-3 py-2 text-sm ring-1 ring-cyan-400/30 hover:bg-cyan-500/30">
                        Search
                    </button>
                    {q ? (
                        <Link
                            href="/companies"
                            className="rounded-md px-3 py-2 text-sm ring-1 ring-white/10 hover:bg-white/5"
                            title="Reset filters"
                        >
                            Reset
                        </Link>
                    ) : null}
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
                            <tr key={c.id} className="border-t border-white/10 hover:bg-white/[0.03]">
                                <td className="px-4 py-3 font-medium">
                                    <Link
                                        href={`/companies?q=${encodeURIComponent(c.name)}`}
                                        className="underline decoration-white/20 hover:decoration-cyan-400"
                                    >
                                        {c.name}
                                    </Link>
                                </td>
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
