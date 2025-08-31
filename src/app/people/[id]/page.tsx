// src/app/people/[id]/page.tsx
import Link from "next/link";
import { PEOPLE } from "@/mock/people";
import ActivitiesTable from "./ActivitiesTable";

export default async function PersonDetail({ params }: { params: { id: string } }) {
    const p = PEOPLE.find((x) => x.id === params.id);
    if (!p)
        return (
            <main className="container">
                <p>Not found.</p>
            </main>
        );

    return (
        <main className="container">
            <Link href="/people" className="muted">
                ← Back
            </Link>
            <h1>{p.name}</h1>

            <section data-ai-key="person-card" className="card big">
                <p>
                    <b>Role:</b> {p.role}
                </p>
                <p>
                    <b>Company:</b> {p.company}
                </p>
                <p>
                    <b>Email:</b> {p.email}
                </p>
            </section>

            <div className="row" style={{ gap: 12 }}>
                <Link href={`/people/${p.id}/export`}>Export person CSV</Link>
                <Link href={`/people/${p.id}/activities/export`}>Export activities CSV</Link>
            </div>

            <h2 className="mt-6">Activities</h2>
            <ActivitiesTable />
        </main>
    );
}
