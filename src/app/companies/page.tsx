import CompaniesClient from "./companies.client";

export default function CompaniesPage({
    searchParams,
}: {
    searchParams?: { q?: string };
}) {
    const q = searchParams?.q ?? "";
    return <CompaniesClient initialQ={q} />;
}
