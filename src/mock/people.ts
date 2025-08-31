export type Person = {
    id: string;
    name: string;
    email: string;
    role: string;
    company: string;
};

export const PEOPLE: Person[] = [
    { id: "p1", name: "Juan Pérez", email: "juan@example.com", role: "Engineer", company: "Acme" },
    { id: "p2", name: "María Gómez", email: "maria@example.com", role: "Product Manager", company: "Globex" },
    { id: "p3", name: "John Smith", email: "john@example.com", role: "Designer", company: "Initech" },
    { id: "p4", name: "Ana Torres", email: "ana@example.com", role: "Data Analyst", company: "Umbrella" },
];
