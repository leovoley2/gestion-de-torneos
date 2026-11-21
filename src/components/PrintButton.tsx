"use client";

/** Abre el diálogo de impresión del navegador (desde ahí también se guarda como PDF). */
export function PrintButton({ label = "Imprimir / Guardar PDF" }: { label?: string }) {
  return (
    <button type="button" className="btn-primary print:hidden" onClick={() => window.print()}>
      {label}
    </button>
  );
}
