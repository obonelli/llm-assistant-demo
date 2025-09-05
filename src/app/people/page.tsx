import PeopleClient from "./people.client";

export default function PeoplePage({
    searchParams,
}: {
    searchParams?: { q?: string };
}) {
    const q = searchParams?.q ?? "";
    return <PeopleClient initialQ={q} />;
}
