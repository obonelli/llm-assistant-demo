import CompaniesClient from "./companies.client";

export default function CompaniesPage({
    searchParams,
}: {
    searchParams?: { q?: string };
}) {
    const q = searchParams?.q ?? "";
    return (
        <div className="mt-6 sm:mt-8">
            <CompaniesClient initialQ={q} />
        </div>
    );
}
