import { NextRequest, NextResponse } from "next/server";
import { PEOPLE } from "@/mock/people";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").toLowerCase();
    const id = searchParams.get("id");

    if (id) {
        const item = PEOPLE.find(p => p.id === id);
        return NextResponse.json(item ?? null);
    }

    if (!q) return NextResponse.json(PEOPLE);
    const terms = q.split(/\s+/).filter(Boolean);
    const results = PEOPLE.filter(p => {
        const hay = `${p.name} ${p.email} ${p.company} ${p.role}`.toLowerCase();
        return terms.every(t => hay.includes(t));
    });
    return NextResponse.json(results);
}
