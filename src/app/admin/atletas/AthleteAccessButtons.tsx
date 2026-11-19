"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminResetLink, adminVerifyEmail } from "@/app/admin/registration-actions";

export function AthleteAccessButtons({ athleteId, verified }: { athleteId: string; verified: boolean }) {
  const [link, setLink] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex max-w-sm flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {!verified && (
          <button
            className="btn px-3 py-1.5 text-xs"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await adminVerifyEmail(athleteId);
                setMsg(r.ok ? (r.message ?? "Listo") : r.error);
                if (r.ok) router.refresh();
              })
            }
          >
            Confirmar correo
          </button>
        )}
        <button
          className="btn px-3 py-1.5 text-xs"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await adminResetLink(athleteId);
              if (r.ok && r.link) setLink(r.link);
              setMsg(r.ok ? (r.message ?? null) : r.error);
            })
          }
        >
          Enlace para nueva contraseña
        </button>
      </div>
      {link && (
        <div className="flex w-full gap-2">
          <input readOnly value={link} className="input text-xs" onFocus={(e) => e.currentTarget.select()} aria-label="Enlace para restablecer" />
          <button className="btn px-3 py-1.5 text-xs" onClick={() => navigator.clipboard.writeText(link).then(() => setMsg("Enlace copiado"))}>
            Copiar
          </button>
        </div>
      )}
      {msg && <p className="text-xs text-sky-700">{msg}</p>}
    </div>
  );
}
