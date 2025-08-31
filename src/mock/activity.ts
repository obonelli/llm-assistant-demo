// src/mock/activity.ts
export type Activity = {
    personId: string;
    date: string; // ISO yyyy-mm-dd
    action: string;
    notes?: string;

    /** Opcionales para analítica contable */
    amount?: number;                // monto del movimiento
    kind?: "debit" | "credit";      // cargo (debit) o abono (credit)
    account?: string;               // cuenta contable / categoría general
    category?: string;              // subcategoría (opcional)
    ref?: string;                   // folio/referencia (opcional)
};

// Demo enriquecida: mezcla de actividades “normales” + movimientos contables.
// - Las filas sin amount/kind siguen contando como 1 actividad en la demo.
// - Las filas con amount/kind se usan para sumar Débito/Crédito y Balance.
export const ACTIVITY: Activity[] = [
    // ===== p1 =====
    { personId: "p1", date: "2024-06-12", action: "Email", notes: "Contacto inicial con cliente X." },
    { personId: "p1", date: "2024-06-15", action: "Cargo", notes: "Compra de insumos", amount: 1200, kind: "debit", account: "Gastos", category: "Insumos", ref: "F-1001" },
    { personId: "p1", date: "2024-06-18", action: "Abono", notes: "Pago parcial", amount: 800, kind: "credit", account: "Cuentas por cobrar", category: "Cobros", ref: "RC-2001" },
    { personId: "p1", date: "2024-06-22", action: "Cargo", notes: "Servicios externos", amount: 650, kind: "debit", account: "Gastos", category: "Servicios", ref: "F-1005" },
    { personId: "p1", date: "2024-07-02", action: "Meeting", notes: "Kickoff de proyecto Falcon." },
    { personId: "p1", date: "2024-07-05", action: "Abono", notes: "Pago cliente X", amount: 1500, kind: "credit", account: "Cuentas por cobrar", category: "Cobros", ref: "RC-2007" },

    // ===== p2 =====
    { personId: "p2", date: "2024-06-18", action: "Spec", notes: "Definió requerimientos para módulo A." },
    { personId: "p2", date: "2024-06-20", action: "Cargo", notes: "Viáticos viaje Monterrey", amount: 950, kind: "debit", account: "Gastos", category: "Viáticos", ref: "F-1012" },
    { personId: "p2", date: "2024-06-25", action: "Abono", notes: "Reembolso viáticos", amount: 600, kind: "credit", account: "Reembolsos", category: "Viáticos", ref: "RB-3001" },
    { personId: "p2", date: "2024-07-01", action: "Cargo", notes: "Materiales prototipo", amount: 400, kind: "debit", account: "Gastos", category: "Materiales", ref: "F-1017" },
    { personId: "p2", date: "2024-07-05", action: "Report", notes: "Entregó informe de riesgos." },
    { personId: "p2", date: "2024-07-09", action: "Abono", notes: "Pago cliente Y", amount: 900, kind: "credit", account: "Cuentas por cobrar", category: "Cobros", ref: "RC-2010" },

    // ===== p3 =====
    { personId: "p3", date: "2024-06-20", action: "Design", notes: "Refactor del sistema de UI." },
    { personId: "p3", date: "2024-06-23", action: "Cargo", notes: "Licencias de diseño", amount: 300, kind: "debit", account: "Gastos", category: "Software", ref: "F-1023" },
    { personId: "p3", date: "2024-06-28", action: "Abono", notes: "Descuento proveedor", amount: 120, kind: "credit", account: "Otros Ingresos", category: "Descuentos", ref: "NC-4002" },
    { personId: "p3", date: "2024-07-03", action: "Cargo", notes: "Servicios de maquetación", amount: 500, kind: "debit", account: "Gastos", category: "Servicios", ref: "F-1029" },
    { personId: "p3", date: "2024-07-11", action: "PR", notes: "Merged PR #142." },

    // ===== p4 =====
    { personId: "p4", date: "2024-07-01", action: "Analysis", notes: "Análisis de métricas Q2." },
    { personId: "p4", date: "2024-07-04", action: "Cargo", notes: "Capacitación equipo", amount: 700, kind: "debit", account: "Gastos", category: "Capacitación", ref: "F-1034" },
    { personId: "p4", date: "2024-07-08", action: "Abono", notes: "Pago cliente Z", amount: 1000, kind: "credit", account: "Cuentas por cobrar", category: "Cobros", ref: "RC-2016" },
    { personId: "p4", date: "2024-07-10", action: "Cargo", notes: "Herramientas analítica", amount: 450, kind: "debit", account: "Gastos", category: "Software", ref: "F-1038" },
    { personId: "p4", date: "2024-07-14", action: "Dashboard", notes: "Actualizó dashboard ejecutivo." },
];
