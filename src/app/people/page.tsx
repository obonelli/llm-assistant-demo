import { PEOPLE, type Person } from "@/mock/people";
import PeopleTable from "@/app/components/PeopleTable";
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
                    <h1 className="text-2xl font-semibold tracking-tight">People</h1>
                    {q && (
                        <div className="mt-1 text-sm text-white/60">
                            Showing results for{" "}
                            <span className="text-white/80">&ldquo;{q}&rdquo;</span>
                        </div>
                    )}
                </div>
            </div>

            <PeopleTable initialPeople={people} />

            {/* Quick switcher */}
            <QuickSwitch />
        </main>
    );
}
