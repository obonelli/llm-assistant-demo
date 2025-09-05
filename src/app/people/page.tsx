import PeopleClient from "./people.client";

export default async function PeoplePage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string }>;
}) {
    const { q = "" } = await searchParams;
    return (
        <div className="mt-6 sm:mt-8">
            <PeopleClient initialQ={q} />
        </div>
    );
}
