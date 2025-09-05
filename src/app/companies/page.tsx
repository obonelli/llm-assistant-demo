import CompaniesClient from "./companies.client";

export default async function CompaniesPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string }>;
}) {
    const { q = "" } = await searchParams;
    return (
        <div className="mt-6 sm:mt-8">
            <CompaniesClient initialQ={q} />
        </div>
    );
}
