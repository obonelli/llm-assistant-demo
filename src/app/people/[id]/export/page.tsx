"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PEOPLE } from "@/mock/people";

export default function ExportPersonPage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const id = params?.id;
    const [downloaded, setDownloaded] = useState(false);
    const alreadyTried = useRef(false);

    const person = useMemo(
        () => PEOPLE.find((p) => p.id === id),
        [id]
    );

    const csv = useMemo(() => {
        if (!person) return "";
        const headers = ["id", "name", "email", "company", "role"];
        const row = [
            person.id,
            person.name,
            person.email,
            person.company,
            person.role,
        ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
        return `${headers.join(",")}\n${row.join(",")}\n`;
    }, [person]);

    const handleDownload = useCallback(() => {
        if (!csv) return;
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${(person?.name || "person").toLowerCase().replace(/\s+/g, "-")}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setDownloaded(true);
    }, [csv, person]);

    // Descarga automática al abrir la página (solo una vez)
    useEffect(() => {
        if (!alreadyTried.current) {
            alreadyTried.current = true;
            if (person) handleDownload();
        }
    }, [person, handleDownload]);

    if (!id) {
        return (
            <main className="mx-auto max-w-3xl px-6 py-12">
                <h1 className="text-2xl font-semibold">Missing id</h1>
                <button onClick={() => router.push("/people")} className="mt-3 text-white/70 hover:underline">
                    ← Back to People
                </button>
            </main>
        );
    }

    if (!person) {
        return (
            <main className="mx-auto max-w-3xl px-6 py-12">
                <Link href="/people" className="text-white/70 hover:underline">← Back</Link>
                <h1 className="mt-4 text-2xl font-semibold">Person not found</h1>
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-3xl px-6 py-12">
            <Link href={`/people/${person.id}`} className="text-white/70 hover:underline">← Back to profile</Link>

            <h1 className="mt-4 text-2xl font-semibold">Export {person.name}</h1>

            <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-white/80">
                    <p><b>Name:</b> {person.name}</p>
                    <p><b>Email:</b> {person.email}</p>
                    <p><b>Company:</b> {person.company}</p>
                    <p><b>Role:</b> {person.role}</p>
                </div>

                <div className="mt-5 flex gap-2">
                    <button
                        onClick={handleDownload}
                        className="rounded-lg border border-white/10 bg-white/7 px-3 py-1.5 text-sm text-white/90 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                    >
                        Download CSV
                    </button>

                    <button
                        onClick={() => navigator.clipboard.writeText(csv)}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
                        title="Copy CSV to clipboard"
                    >
                        Copy CSV
                    </button>

                    {downloaded && (
                        <span className="self-center text-xs text-white/60">Archivo descargado.</span>
                    )}
                </div>
            </section>
        </main>
    );
}
