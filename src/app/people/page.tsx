import Link from "next/link";
import { PEOPLE, type Person } from "@/mock/people";
import QuickSwitch from "@/app/components/QuickSwitch";

export default async function PeoplePage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string }>;
}) {
    const { q = "" } = await searchParams;

    const terms =
        q.toLowerCase().trim() === ""
            ? []
            : q.toLowerCase().trim().split(/\s+/).filter(Boolean);

    const people: Person[] =
        terms.length === 0
            ? PEOPLE
            : PEOPLE.filter((p) => {
                const hay = `${p.name} ${p.email} ${p.company} ${p.role}`.toLowerCase();
                return terms.every((t) => hay.includes(t));
            });

    return (
        <main className="mx-auto max-w-6xl px-6 pb-10">
            <div className="mb-4 flex items-end justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">People</h1>
                    {q ? (
                        <p className="text-sm text-white/60">
                            Showing results for <span className="text-white/80">&ldquo;{q}&rdquo;</span>
                        </p>
                    ) : (
                        <p className="text-sm text-white/60">Simple people list.</p>
                    )}
                </div>

                {/* Search + Clear (x) + Reset (link fallback) */}
                <form className="flex gap-2" action="/people">
                    {/* Contenedor relativo para colocar la "tachita" dentro del input */}
                    <div className="relative">
                        <input
                            name="q"
                            defaultValue={q}
                            placeholder="Search people…"
                            className="w-[260px] rounded-md bg-white/5 pr-9 pl-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-white/20"
                        />
                        {/* Tachita (solo cuando hay query) */}
                        {q ? (
                            <Link
                                href="/people"
                                aria-label="Clear search"
                                title="Clear"
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md
                           border border-white/10 bg-white/10 px-2 py-0.5 text-xs
                           text-white/80 hover:bg-white/20"
                            >
                                ×
                            </Link>
                        ) : null}
                    </div>

                    <button className="rounded-md bg-cyan-500/20 px-3 py-2 text-sm ring-1 ring-cyan-400/30 hover:bg-cyan-500/30">
                        Search
                    </button>

                    {/* Fallback Reset (se mantiene por si alguien prefiere botón explícito) */}
                    {q ? (
                        <Link
                            href="/people"
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
                            <th className="px-4 py-3">Email</th>
                            <th className="px-4 py-3">Company</th>
                            <th className="px-4 py-3">Role</th>
                        </tr>
                    </thead>
                    <tbody>
                        {people.map((p) => (
                            <tr key={p.id} className="border-t border-white/10 hover:bg-white/[0.03]">
                                <td className="px-4 py-3 font-medium text-white/90">
                                    {/* Ya no es Link: solo texto, sin subrayado */}
                                    {p.name}
                                </td>
                                <td className="px-4 py-3 text-white/80">{p.email}</td>
                                <td className="px-4 py-3">{p.company}</td>
                                <td className="px-4 py-3">{p.role}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <p className="mt-3 text-xs text-white/50">{people.length} shown</p>

            <QuickSwitch />
        </main>
    );
}
