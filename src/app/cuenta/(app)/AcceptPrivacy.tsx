"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptPrivacy } from "../actions";

export function AcceptPrivacy() {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return msg ? (
    <span className="text-xs font-medium">{msg}</span>
  ) : (
    <button
      className="btn-primary px-3 py-1 text-xs"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await acceptPrivacy();
          if (r.ok) router.refresh();
          else setMsg(r.error);
        })
      }
    >
      Acepto
    </button>
  );
}
