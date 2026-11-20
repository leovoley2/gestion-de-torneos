"use client";

import { useState, useTransition } from "react";
import { sendTestEmail } from "@/app/admin/team-actions";

export function TestEmailButton({ disabled }: { disabled: boolean }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <button
        className="btn-primary"
        disabled={disabled || pending}
        onClick={() =>
          start(async () => {
            const r = await sendTestEmail();
            setMsg(r.ok ? { ok: true, text: r.message ?? "Enviado" } : { ok: false, text: r.error });
          })
        }
      >
        {pending ? "Enviando…" : "Enviarme un correo de prueba"}
      </button>
      {msg && (
        <p role="status" className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
