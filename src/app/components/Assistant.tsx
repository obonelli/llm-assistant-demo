// src/app/components/Assistant.tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Action =
    | { type: "NAVIGATE"; path: string; highlight?: string }
    | { type: "ASK_DISAMBIGUATION"; options: Array<{ label: string; path: string }> }
    | { type: "SAY"; text: string }
    | { type: "NONE" };

export default function Assistant() {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const [options, setOptions] = useState<Array<{ label: string; path: string }>>([]);
    const [hint, setHint] = useState<string>("");
    const [error, setError] = useState<string>("");
    const [loading, setLoading] = useState(false);

    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);

    // ⌘K / Ctrl+K
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setOpen((v) => !v);
            }
            if (e.key === "Escape") setOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    // Foco, hint y bloqueo de scroll al abrir
    useEffect(() => {
        if (!open) {
            document.body.style.removeProperty("overflow");
            return;
        }
        document.body.style.overflow = "hidden";
        setTimeout(() => inputRef.current?.focus(), 50);

        const selection =
            typeof window !== "undefined" ? window.getSelection()?.toString().slice(0, 400) : "";
        const context = {
            path: typeof window !== "undefined" ? window.location.pathname : "",
            selection,
            pageTitle: typeof document !== "undefined" ? document.title : "",
        };

        fetch("/api/assist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: "", mode: "HINT", context }),
        })
            .then((r) => r.json())
            .then((res: { action?: Action }) => {
                if (res?.action?.type === "SAY") setHint(res.action.text);
                else setHint("");
            })
            .catch(() => setHint(""));

        return () => {
            document.body.style.removeProperty("overflow");
        };
    }, [open]);

    const run = async (text: string) => {
        setError("");
        setLoading(true);
        setOptions([]);

        const selection =
            typeof window !== "undefined" ? window.getSelection()?.toString().slice(0, 400) : "";
        const context = {
            path: typeof window !== "undefined" ? window.location.pathname : "",
            selection,
            pageTitle: typeof document !== "undefined" ? document.title : "",
        };

        try {
            const r = await fetch("/api/assist", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: text, mode: "DECIDE", context }),
            });
            const { action } = (await r.json()) as { action: Action };

            if (action?.type === "NAVIGATE") {
                setOpen(false);
                router.push(action.path);
                setTimeout(() => {
                    if (action.highlight) {
                        const el = document.querySelector(action.highlight) as HTMLElement | null;
                        if (el) {
                            el.scrollIntoView({ behavior: "smooth", block: "center" });
                            el.classList.add("ai-highlight");
                            setTimeout(() => el.classList.remove("ai-highlight"), 1800);
                        }
                    }
                }, 450);
            } else if (action?.type === "ASK_DISAMBIGUATION") {
                setOptions(action.options || []);
            } else if (action?.type === "SAY") {
                setHint(action.text);
            } else {
                setError('No entendí. Prueba con “abre Juan” / “exporta María” o “abre reporte ventas”.');
            }
        } catch {
            setError("Hubo un problema con la IA. Intenta de nuevo.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Botón fijo esquina inferior derecha */}
            <div
                className="fixed z-[80]"
                style={{ right: "1rem", bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
            >
                <button
                    onClick={() => setOpen(true)}
                    className="relative rounded-xl border border-white/10 bg-white/5 px-4 py-2
                     text-sm text-white/90 backdrop-blur transition cursor-pointer
                     hover:-translate-y-0.5 hover:bg-white/10 hover:shadow-[0_8px_30px_rgba(25,200,255,.12)]
                     focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
                    aria-label="Open assistant"
                    title="Assistant (⌘K / Ctrl+K)"
                >
                    Assistant <span className="opacity-70">⌘K</span>
                </button>
            </div>

            {/* Overlay + panel anclado arriba del botón */}
            {open && (
                <div
                    onClick={() => setOpen(false)}
                    className="fixed inset-0 z-[75] bg-black/40"
                    aria-modal="true"
                    role="dialog"
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="fixed right-4 bottom-[calc(3.25rem+1rem+env(safe-area-inset-bottom,0px))]
                       w-[520px] max-w-[92vw]
                       rounded-2xl border border-white/10 bg-[#0F1218]/90 p-4
                       text-white shadow-xl backdrop-blur"
                    >
                        <div className="absolute -bottom-2 right-8 h-4 w-4 rotate-45 bg-[#0F1218]/90 border-b border-r border-white/10" />

                        {/* Form: Enter => submit => run(q) */}
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                if (!loading && q.trim().length > 0) run(q);
                            }}
                        >
                            <input
                                ref={inputRef}
                                type="text"
                                value={q}
                                onChange={(e) => {
                                    setQ(e.target.value);
                                    setOptions([]);
                                    setError("");
                                }}
                                // Evita que hotkeys globales intercepten teclas (Enter/Espacio) dentro del input
                                onKeyDownCapture={(e) => {
                                    e.stopPropagation();
                                }}
                                onKeyDown={(e) => {
                                    // Escape cierra el panel
                                    if (e.key === "Escape") {
                                        e.preventDefault();
                                        setOpen(false);
                                        return;
                                    }
                                    // Espacio asegurado si algún handler global lo bloquea
                                    if (e.key === " ") {
                                        if (e.defaultPrevented) setQ((prev) => prev + " ");
                                        e.stopPropagation();
                                    }
                                }}
                                placeholder='Escribe lo que necesites… (ej. "exporta reporte ventas")'
                                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 outline-none
                           placeholder-white/50 focus:border-white/20"
                                autoComplete="off"
                                spellCheck={false}
                                aria-label="Assistant input"
                            />

                            {hint && !error && <div className="mt-2 text-xs text-white/70">{hint}</div>}
                            {error && <div className="mt-2 text-xs text-red-300">{error}</div>}

                            {options.length > 0 && (
                                <ul className="mt-3 space-y-1">
                                    {options.map((opt) => (
                                        <li key={opt.path}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setOpen(false);
                                                    router.push(opt.path); // navegar directo
                                                }}
                                                className="flex w-full items-center justify-between rounded-lg border border-white/10
                                   bg-white/5 px-3 py-2 text-left hover:bg-white/10"
                                            >
                                                <span>{opt.label}</span>
                                                <code className="text-white/60">{opt.path}</code>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            <div className="mt-3 flex items-center gap-2">
                                <button
                                    type="submit"
                                    disabled={loading || q.trim().length === 0}
                                    className="rounded-lg border border-white/10 bg-white/7 px-3 py-1.5 text-sm text-white/90
                             transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-500/30
                             disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? "Thinking…" : "Ask"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setOpen(false)}
                                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
                                >
                                    Close
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
