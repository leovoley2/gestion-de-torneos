"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const INTERVAL_MS = 10_000;

/**
 * Mantiene la vista pública al día: cada 10 s pregunta si la categoría cambió y solo entonces
 * recarga los datos. No consulta mientras la pestaña está en segundo plano.
 */
export function LiveRefresh({ categoryId }: { categoryId: string }) {
  const router = useRouter();
  useEffect(() => {
    let last: string | null = null;
    let stopped = false;
    const check = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/version/${categoryId}`, { cache: "no-store" });
        if (!res.ok) return;
        const { v } = (await res.json()) as { v: string };
        if (last !== null && v !== last && !stopped) router.refresh();
        last = v;
      } catch {
        // Sin conexión: se reintenta en el próximo ciclo.
      }
    };
    check();
    const timer = setInterval(check, INTERVAL_MS);
    const onVisible = () => !document.hidden && check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [categoryId, router]);
  return null;
}
