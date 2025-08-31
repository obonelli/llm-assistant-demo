"use client";
import { useEffect } from "react";

type Props = {
    /** Prompt fijo que define la personalidad/estilo del wingman */
    prompt: string;
    /** (Opcional) línea corta que dirá al montar, útil para probar */
    sayOnMount?: string;
};

export default function WingmanPrompt({ prompt, sayOnMount }: Props) {
    useEffect(() => {
        // Actualiza el prompt en el wingman (evento que ya escucha)
        window.dispatchEvent(
            new CustomEvent("wingman:set-prompt", { detail: prompt })
        );

        // Mensaje opcional de arranque
        if (sayOnMount && sayOnMount.trim()) {
            window.dispatchEvent(
                new CustomEvent("wingman:say", { detail: sayOnMount })
            );
        }
    }, [prompt, sayOnMount]);

    // No renderiza UI, solo provee el prompt
    return null;
}
