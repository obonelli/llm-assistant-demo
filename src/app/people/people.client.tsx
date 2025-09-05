"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { PEOPLE, type Person } from "@/mock/people";
import QuickSwitch from "@/app/components/QuickSwitch";

export default function PeopleClient({ initialQ }: { initialQ: string }) {
    const [query, setQuery] = useState(initialQ);
    const router = useRouter();
    const pathname = usePathname();

    const terms =
        query.toLowerCase().trim() === ""
            ? []
            : query.toLowerCase().trim().split(/\s+/).filter(Boolean);

    const people: Person[] =
        terms.length === 0
            ? PEOPLE
            : PEOPLE.filter((p) => {
                const hay = `${p.name} ${p.email} ${p.company} ${p.role}`.toLowerCase();
                return terms.every((t) => hay.includes(t));
            });

    const clearQuery = () => {
        setQuery("");
        // Limpia también la URL (quita ?q=...)
        router.replace(pathname);
    };

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        // Deja que el form navegue con ?q= para ser consistente con el resto de la app
        // (si no quieres navegación, puedes e.preventDefault() y solo mantener filtrado en cliente)
    };

    return (
        <main className="mx-auto max-w-6xl px-6 pb-10">
            <div className="mb-4 flex items-end justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">People</h1>
                    {query ? (
                        <p className="text-sm text-white/60">
                            Showing results for{" "}
                            <span className="text-white/80">&ldquo;{query}&rdquo;</span>
                        </p>
                    ) : (
                        <p className="text-sm text-white/60">Simple people list.</p>
                    )}
                </div>

                {/* Search + tachita dinámica */}
                <form className="flex gap-2" action="/people" onSubmit={onSubmit}>
                    <div className="relative">
                        <input
                            name="q"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search people…"
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
                            <th className="px-4 py-3">Email</th>
                            <th className="px-4 py-3">Company</th>
                            <th className="px-4 py-3">Role</th>
                        </tr>
                    </thead>
                    <tbody>
                        {people.map((p) => (
                            <tr
                                key={p.id}
                                className="border-t border-white/10 hover:bg-white/[0.03]"
                            >
                                {/* Ya no es link: texto plano */}
                                <td className="px-4 py-3 font-medium text-white/90">{p.name}</td>
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
