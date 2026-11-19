"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminResetLink, adminVerifyEmail, mergeAthleteRecord } from "@/app/admin/registration-actions";

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

/** Une una ficha sin cuenta con la cuenta que el jugador creó después. */
export function MergeRecordForm({ recordId }: { recordId: string }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      className="flex max-w-sm flex-col items-end gap-2"
      action={(fd) =>
        start(async () => {
          if (!window.confirm("¿Unir esta ficha con la cuenta? Sus duplas y puntos pasan a la cuenta.")) return;
          const r = await mergeAthleteRecord(recordId, fd);
          setMsg(r.ok ? { ok: true, text: r.message ?? "Listo" } : { ok: false, text: r.error });
          if (r.ok) router.refresh();
        })
      }
    >
      <div className="flex gap-2">
        <input name="account_email" type="email" required placeholder="Correo de su cuenta" className="input text-xs" aria-label="Correo de la cuenta del atleta" />
        <button className="btn shrink-0 px-3 py-1.5 text-xs" disabled={pending}>
          Unir con cuenta
        </button>
      </div>
      {msg && <p className={`text-xs ${msg.ok ? "text-sky-700" : "text-red-700"}`}>{msg.text}</p>}
    </form>
  );
}
