// src/app/components/Assistant.tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Action =
    | { type: "NAVIGATE"; path: string; highlight?: string }
    | { type: "ASK_DISAMBIGUATION"; options: Array<{ label: string; path: string }> }
    | { type: "SAY"; text: string }
    | { type: "NONE" };

type UIStrings = {
    openTitle: string;
    openAria: string;
    headerTitle: string;
    headerBadge?: string;
    placeholder: string;
    ask: string;
    close: string;
    thinking: string;
    errGeneric: string;
    errDidntUnderstand: string;
};

export default function Assistant() {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const [options, setOptions] = useState<Array<{ label: string; path: string }>>([]);
    const [hint, setHint] = useState<string>("");
    const [error, setError] = useState<string>("");
    const [loading, setLoading] = useState(false);

    // solo botón Close (no backdrop). ESC sí cierra.
    const DISMISS_BY_BACKDROP = false;

    const [ui, setUI] = useState<UIStrings>({
        openTitle: "Assistant (⌘K / Ctrl+K)",
        openAria: "Open assistant",
        headerTitle: "Assistant",
        headerBadge: "beta",
        placeholder: 'Type what you need… e.g. "open Juan" / "export sales report"',
        ask: "Ask",
        close: "Close",
        thinking: "Thinking…",
        errGeneric: "There was a problem with the AI. Try again.",
        errDidntUnderstand:
            'I didn’t understand. Try “open Juan”, “export María”, or “open sales report”.',
    });

    const router = useRouter();
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // ⌘K / Ctrl+K toggle y ESC para cerrar (sin dependencias dinámicas)
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setOpen((v) => !v);
            }
            if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []); // 👈 siempre constante

    // Open: focus + fetch UI/hint
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

        Promise.all([
            fetch("/api/assist", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: q, mode: "UI", context }),
            })
                .then((r) => r.json())
                .then((res: { ui?: UIStrings }) => {
                    if (res?.ui) setUI(res.ui);
                })
                .catch(() => void 0),
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
                .catch(() => setHint("")),
        ]);

        return () => {
            document.body.style.removeProperty("overflow");
        };
    }, [open, q]);

    // Ajuste de UI mientras escribe
    useEffect(() => {
        if (!open) return;
        const t = setTimeout(() => {
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
                body: JSON.stringify({ query: q, mode: "UI", context }),
            })
                .then((r) => r.json())
                .then((res: { ui?: UIStrings }) => {
                    if (res?.ui) setUI(res.ui);
                })
                .catch(() => void 0);
        }, 180);
        return () => clearTimeout(t);
    }, [q, open]);

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
            const json = await r.json();
            const action = (json?.action || {}) as Action;

            if (action?.type === "NAVIGATE") {
                setOpen(false);
                router.push(action.path);
                setTimeout(() => {
                    const highlight = (action as any).highlight as string | undefined;
                    if (highlight) {
                        const el = document.querySelector(highlight) as HTMLElement | null;
                        if (el) {
                            el.scrollIntoView({ behavior: "smooth", block: "center" });
                            el.classList.add("ai-highlight");
                            setTimeout(() => el.classList.remove("ai-highlight"), 1800);
                        }
                    }
                }, 450);
            } else if (action?.type === "ASK_DISAMBIGUATION") {
                setOptions((action as any).options || []);
            } else if (action?.type === "SAY") {
                setHint(action.text);
            } else {
                setError(ui.errDidntUnderstand);
            }
        } catch {
            setError(ui.errGeneric);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* FAB — oculto cuando open === true */}
            {!open && (
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
                        aria-label={ui.openAria}
                        title={ui.openTitle}
                    >
                        {ui.headerTitle} <span className="opacity-70">⌘K</span>
                    </button>
                </div>
            )}

            {/* Overlay + Sheets */}
            {open && (
                <div
                    className="fixed inset-0 z-[90] bg-black/55"
                    aria-modal="true"
                    role="dialog"
                // No backdrop click: no se cierra
                >
                    {/* ===== Mobile bottom sheet ===== */}
                    <div className="sm:hidden fixed inset-x-0 bottom-0 z-[91]" onClick={(e) => e.stopPropagation()}>
                        <div
                            className="mx-auto w-full max-w-2xl rounded-t-3xl border border-white/10 bg-[#0F1218]/95 shadow-2xl backdrop-blur-md ring-1 ring-white/5"
                            style={{ maxHeight: "85vh" }}
                        >
                            {/* Header sticky */}
                            <div className="sticky top-0 z-10 rounded-t-3xl bg-[#0F1218]/95 backdrop-blur-md">
                                <div className="flex justify-center pt-3">
                                    <div className="h-1.5 w-12 rounded-full bg-white/20" />
                                </div>

                                <div className="px-5 pb-3 pt-2 flex items-center justify-between">
                                    <div className="text-[15px] font-semibold text-white/90">{ui.headerTitle}</div>
                                    <button
                                        type="button"
                                        onClick={() => setOpen(false)}
                                        className="rounded-md px-3 py-1.5 text-xs border border-white/12 text-white/80 hover:bg-white/10"
                                    >
                                        {ui.close}
                                    </button>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="px-5 pb-4 overflow-y-auto">
                                {hint && !error && <div className="mb-3 text-[13px] leading-5 text-white/75">{hint}</div>}
                                {error && <div className="mb-3 text-[13px] leading-5 text-red-300">{error}</div>}

                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        if (!loading && q.trim().length > 0) run(q.trim());
                                    }}
                                    className="space-y-3.5"
                                >
                                    <div
                                        className={`rounded-2xl border bg-white/[0.06] ${error ? "border-red-400/40" : "border-white/12"} focus-within:border-white/25 px-3.5 pt-3 pb-2.5`}
                                    >
                                        <textarea
                                            ref={inputRef}
                                            rows={4}
                                            value={q}
                                            onChange={(e) => {
                                                setQ(e.target.value);
                                                setOptions([]);
                                                setError("");
                                                const el = e.currentTarget;
                                                el.style.height = "0px";
                                                el.style.height = Math.min(320, el.scrollHeight) + "px";
                                            }}
                                            onKeyDownCapture={(e) => e.stopPropagation()}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && !e.shiftKey) {
                                                    e.preventDefault();
                                                    if (!loading && q.trim()) run(q.trim());
                                                }
                                                if (e.key === "Escape") {
                                                    e.preventDefault();
                                                    setOpen(false);
                                                }
                                            }}
                                            placeholder={ui.placeholder}
                                            className="min-h-[72px] max-h-[320px] w-full resize-none bg-transparent text-[16px] leading-7 outline-none placeholder-white/55"
                                            autoComplete="off"
                                            spellCheck={false}
                                            aria-label="Assistant input"
                                        />

                                        <div className="mt-3">
                                            <button
                                                type="submit"
                                                disabled={loading || q.trim().length === 0}
                                                className="w-full rounded-lg border border-white/12 bg-cyan-500/20 px-4 py-2.5 text-[15px] text-white ring-1 ring-cyan-400/30 hover:bg-cyan-500/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                            >
                                                {loading ? ui.thinking : ui.ask}
                                            </button>
                                        </div>
                                    </div>

                                    {options.length > 0 && (
                                        <ul className="space-y-2">
                                            {options.map((opt) => (
                                                <li key={opt.path}>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setOpen(false);
                                                            router.push(opt.path);
                                                        }}
                                                        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-left hover:bg-white/10"
                                                    >
                                                        <span className="text-[15px]">{opt.label}</span>
                                                        <code className="text-white/60 text-[12px]">{opt.path}</code>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </form>

                                <div className="h-3" />
                            </div>

                            <div className="h-6" style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 12px)" }} />
                        </div>
                    </div>

                    {/* ===== Desktop: right panel ===== */}
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="hidden sm:block fixed right-6 bottom-[calc(3.75rem+1.25rem+env(safe-area-inset-bottom,0px))] z-[91]"
                    >
                        <div className="w-[720px] max-w-[96vw] rounded-3xl border border-white/12 bg-[#0F1218]/90 p-6 text-white shadow-2xl backdrop-blur relative">
                            <div className="absolute -bottom-2 right-10 h-4 w-4 rotate-45 bg-[#0F1218]/90 border-b border-r border-white/12" />

                            <div className="mb-3 flex items-center justify-between">
                                <div className="text-sm font-semibold text-white/90 tracking-wide">{ui.headerTitle}</div>
                                <button
                                    type="button"
                                    onClick={() => setOpen(false)}
                                    className="rounded-md px-2.5 py-1.5 text-xs border border-white/12 text-white/80 hover:bg-white/10"
                                >
                                    {ui.close}
                                </button>
                            </div>

                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    if (!loading && q.trim().length > 0) run(q.trim());
                                }}
                            >
                                <div
                                    className={`flex items-end gap-3 rounded-2xl border px-3.5 pt-2.5 pb-2.5 bg-white/[0.06] ${error ? "border-red-400/40" : "border-white/12"} focus-within:border-white/25`}
                                >
                                    <textarea
                                        ref={inputRef}
                                        rows={1}
                                        value={q}
                                        onChange={(e) => {
                                            setQ(e.target.value);
                                            setOptions([]);
                                            setError("");
                                            const el = e.currentTarget;
                                            el.style.height = "0px";
                                            el.style.height = Math.min(220, el.scrollHeight) + "px";
                                        }}
                                        onKeyDownCapture={(e) => e.stopPropagation()}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault();
                                                if (!loading && q.trim()) run(q.trim());
                                            }
                                            if (e.key === "Escape") {
                                                e.preventDefault();
                                                setOpen(false);
                                            }
                                        }}
                                        placeholder={ui.placeholder}
                                        className="min-h-[44px] max-h-[220px] w-full resize-none bg-transparent text-[16px] leading-7 outline-none placeholder-white/55"
                                        autoComplete="off"
                                        spellCheck={false}
                                        aria-label="Assistant input"
                                    />

                                    <button
                                        type="submit"
                                        disabled={loading || q.trim().length === 0}
                                        className="shrink-0 rounded-lg border border-white/12 bg-white/10 px-3.5 py-2 text-sm text-white/90 transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading ? ui.thinking : ui.ask}
                                    </button>
                                </div>

                                {hint && !error && <div className="mt-2 text-xs text-white/70">{hint}</div>}
                                {error && <div className="mt-2 text-xs text-red-300">{error}</div>}

                                {options.length > 0 && (
                                    <ul className="mt-3 space-y-1.5 max-h-[38vh] overflow-y-auto pr-1">
                                        {options.map((opt) => (
                                            <li key={opt.path}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setOpen(false);
                                                        router.push(opt.path);
                                                    }}
                                                    className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-left hover:bg-white/10"
                                                >
                                                    <span>{opt.label}</span>
                                                    <code className="text-white/60">{opt.path}</code>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
