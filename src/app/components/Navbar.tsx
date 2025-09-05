// src/app/components/Navbar.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

function titleFromPath(path: string) {
    if (!path || path === "/") return "Home";
    const last = path.split("?")[0].split("/").filter(Boolean).pop() ?? "";
    return last
        .split("-")
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(" ");
}

export default function Navbar() {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // cerrar dropdown al hacer click fuera
    useEffect(() => {
        function onClick(e: MouseEvent) {
            if (!menuRef.current) return;
            if (!menuRef.current.contains(e.target as Node)) setOpen(false);
        }
        window.addEventListener("click", onClick);
        return () => window.removeEventListener("click", onClick);
    }, []);

    // cerrar dropdown cuando cambia la ruta
    useEffect(() => {
        setOpen(false);
    }, [pathname]);

    const currentLabel = titleFromPath(pathname || "/");
    const isPeople = pathname?.startsWith("/people");
    const isCompanies = pathname?.startsWith("/companies");
    const showTitle = !(isPeople || isCompanies); // <- oculta el título en estas rutas

    return (
        <header className="w-full fixed top-0 z-50 border-b border-white/5 bg-[#0F1218]/60 backdrop-blur">
            <nav className="max-w-7xl mx-auto h-16 px-4 flex items-center justify-between">
                {/* Título: solo se muestra fuera de /people y /companies */}
                {showTitle ? (
                    <Link
                        href={pathname || "/"}
                        className="font-semibold tracking-tight hover:underline decoration-white/30"
                        aria-label={`Current section: ${currentLabel}`}
                    >
                        {currentLabel}
                    </Link>
                ) : (
                    <div aria-hidden className="min-w-[1px]" /> // placeholder para mantener layout
                )}

                {/* Menú siempre visible */}
                <div className="flex items-center gap-2">
                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={() => setOpen((v) => !v)}
                            className="px-3 py-1.5 text-sm text-white/80 hover:text-white flex items-center gap-1"
                            aria-haspopup="menu"
                            aria-expanded={open}
                        >
                            Demo LLM
                            <svg width="12" height="12" viewBox="0 0 20 20" className="opacity-70">
                                <path fill="currentColor" d="M5.5 7.5L10 12l4.5-4.5H5.5z" />
                            </svg>
                        </button>

                        {open && (
                            <div
                                role="menu"
                                className="absolute mt-1 min-w-[160px] overflow-hidden rounded-md border border-white/10 bg-[#0c0f14] shadow-lg"
                            >
                                <Link
                                    href="/people"
                                    className="block px-3 py-2 text-sm text-white/80 hover:bg-white/5 hover:text-white"
                                    role="menuitem"
                                >
                                    People
                                </Link>
                                <Link
                                    href="/companies"
                                    className="block px-3 py-2 text-sm text-white/80 hover:bg-white/5 hover:text-white"
                                    role="menuitem"
                                >
                                    Companies
                                </Link>
                                <Link
                                    href="/landing"
                                    className="block px-3 py-2 text-sm text-white/80 hover:bg-white/5 hover:text-white"
                                    role="menuitem"
                                >
                                    Landing
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </nav>
        </header>
    );
}
