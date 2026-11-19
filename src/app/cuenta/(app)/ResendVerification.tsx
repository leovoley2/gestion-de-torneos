"use client";

import { useState, useTransition } from "react";
import { resendVerification } from "../actions";

export function ResendVerification() {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return msg ? (
    <span className="text-xs font-medium">{msg}</span>
  ) : (
    <button
      className="btn px-3 py-1 text-xs"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await resendVerification();
          setMsg(r.ok ? (r.message ?? "Listo") : r.error);
        })
      }
    >
      Reenviar enlace
    </button>
  );
}
