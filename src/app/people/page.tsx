import PeopleClient from "./people.client";

export default function PeoplePage({
    searchParams,
}: {
    searchParams?: { q?: string };
}) {
    const q = searchParams?.q ?? "";
    return (
        <div className="mt-6 sm:mt-8">
            <PeopleClient initialQ={q} />
        </div>
    );
}
