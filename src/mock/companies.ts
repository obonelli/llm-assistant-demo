export type Company = {
    id: string;
    name: string;
    industry: string;
    city: string;
    country: string;
    employees: number;
    website?: string;
};

export const COMPANIES: Company[] = [
    { id: "c1", name: "Umbrella", industry: "Pharma / Biotech", city: "Raccoon City", country: "US", employees: 3200, website: "https://umbrella.example.com" },
    { id: "c2", name: "Initech", industry: "Software", city: "Austin", country: "US", employees: 850, website: "https://initech.example.com" },
    { id: "c3", name: "Acme", industry: "Manufacturing", city: "Phoenix", country: "US", employees: 5200, website: "https://acme.example.com" },
    { id: "c4", name: "Globex", industry: "Consulting", city: "Monterrey", country: "MX", employees: 1200, website: "https://globex.example.com" },
];
