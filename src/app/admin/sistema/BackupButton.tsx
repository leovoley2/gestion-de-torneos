"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBackupNow } from "@/app/admin/team-actions";

export function BackupButton() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="space-y-2">
      <button
        className="btn"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await createBackupNow();
            setMsg(r.ok ? { ok: true, text: r.message ?? "Listo" } : { ok: false, text: r.error });
            if (r.ok) router.refresh();
          })
        }
      >
        {pending ? "Creando copia…" : "Crear una copia ahora"}
      </button>
      {msg && (
        <p role="status" className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
