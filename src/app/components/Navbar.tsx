// src/app/components/Navbar.tsx
"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function Navbar() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [open, setOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // cerrar dropdown al hacer click afuera
    useEffect(() => {
        function onClick(e: MouseEvent) {
            if (!menuRef.current) return;
            if (!menuRef.current.contains(e.target as Node)) setOpen(false);
        }
        window.addEventListener("click", onClick);
        return () => window.removeEventListener("click", onClick);
    }, []);

    const q = (searchParams?.get("q") ?? "").trim();

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false);
    };

    const isPeople = pathname?.startsWith("/people");
    const isCompanies = pathname?.startsWith("/companies");

    return (
        <header className="w-full fixed top-0 z-50 border-b border-white/5 bg-[#0F1218]/60 backdrop-blur">
            {/* fila principal */}
            <nav className="max-w-7xl mx-auto h-16 px-4 flex items-center justify-between">
                <div className="font-semibold tracking-tight">obonelli.dev</div>

                <div className="flex items-center gap-2" onKeyDown={onKeyDown}>
                    {/* Dropdown Demo LLM */}
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
                                    onClick={() => setOpen(false)}
                                    role="menuitem"
                                >
                                    People
                                </Link>
                                <Link
                                    href="/companies"
                                    className="block px-3 py-2 text-sm text-white/80 hover:bg-white/5 hover:text-white"
                                    onClick={() => setOpen(false)}
                                    role="menuitem"
                                >
                                    Companies
                                </Link>
                            </div>
                        )}
                    </div>

                    <Link href="/docs" className="px-3 py-1.5 text-sm text-white/80 hover:text-white">
                        Docs
                    </Link>

                    <span className="hidden sm:inline px-3 py-1.5 text-xs text-white/60">
                        Assistant <kbd className="px-1 py-0.5 bg-white/10 rounded">⌘K</kbd>
                    </span>

                    <Link href="/login" className="neon-btn px-4 py-2 text-sm font-medium cursor-pointer">
                        Sign in
                    </Link>
                </div>
            </nav>

            {/* sub-nav con búsqueda por sección */}
            <div className="border-t border-white/5 bg-[#0F1218]/65">
                <div className="max-w-7xl mx-auto px-4 py-2">
                    {isPeople && (
                        <form action="/people" className="flex items-center gap-2">
                            <label className="text-xs text-white/60">Buscar en People</label>
                            <input
                                name="q"
                                defaultValue={q}
                                placeholder="Nombre, email, empresa, rol…"
                                className="w-full max-w-md rounded-md bg-white/5 px-3 py-1.5 text-sm outline-none ring-1 ring-white/10"
                            />
                            <button className="rounded-md bg-cyan-500/20 px-3 py-1.5 text-sm ring-1 ring-cyan-400/30 hover:bg-cyan-500/30">
                                Buscar
                            </button>
                            <div className="ml-auto text-xs text-white/50">
                                Sección: <span className="text-white/70">People</span>
                            </div>
                        </form>
                    )}

                    {isCompanies && (
                        <form action="/companies" className="flex items-center gap-2">
                            <label className="text-xs text-white/60">Buscar en Companies</label>
                            <input
                                name="q"
                                defaultValue={q}
                                placeholder="Nombre, industria, ciudad, país…"
                                className="w-full max-w-md rounded-md bg-white/5 px-3 py-1.5 text-sm outline-none ring-1 ring-white/10"
                            />
                            <button className="rounded-md bg-cyan-500/20 px-3 py-1.5 text-sm ring-1 ring-cyan-400/30 hover:bg-cyan-500/30">
                                Buscar
                            </button>
                            <div className="ml-auto text-xs text-white/50">
                                Sección: <span className="text-white/70">Companies</span>
                            </div>
                        </form>
                    )}

                    {!isPeople && !isCompanies && (
                        <div className="flex items-center gap-3 text-xs text-white/60">
                            <span>Ir a:</span>
                            <Link href="/people" className="underline decoration-white/20 hover:text-white">
                                People
                            </Link>
                            <Link href="/companies" className="underline decoration-white/20 hover:text-white">
                                Companies
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
