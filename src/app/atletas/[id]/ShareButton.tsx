"use client";

import { useState } from "react";

/** Compartir el perfil: menú nativo del celular si existe; si no, copia el enlace. */
export function ShareButton({ name }: { name: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${name} · Vóley Playa`, url });
        return;
      } catch {
        // El usuario canceló: no hacer nada.
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copia el enlace del perfil:", url);
    }
  };
  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white ring-1 ring-white/20 transition-colors duration-150 ring-inset hover:bg-white/20 active:scale-[0.97]"
    >
      <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <path d="M8 10V2.5M5 5l3-3 3 3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3.5 8.5v4a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-4" strokeLinecap="round" />
      </svg>
      {copied ? "Enlace copiado" : "Compartir perfil"}
    </button>
  );
}
