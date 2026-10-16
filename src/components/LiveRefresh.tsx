"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type Status = "setup" | "in_progress" | "finished";

/** Cada cuánto preguntar según el estado: en juego 10 s, por iniciar 60 s, terminada nunca. */
const INTERVAL_MS: Record<Status, number | null> = { in_progress: 10_000, setup: 60_000, finished: null };

/**
 * Mantiene la vista pública al día: pregunta si la categoría cambió y solo entonces recarga los
 * datos. No consulta con la pestaña en segundo plano. La respuesta viene del CDN (ver
 * api/version), así que muchos espectadores no multiplican las consultas a la base de datos.
 */
export function LiveRefresh({ categoryId, status }: { categoryId: string; status: Status }) {
  const router = useRouter();
  useEffect(() => {
    const interval = INTERVAL_MS[status];
    if (interval === null) return;
    let last: string | null = null;
    let stopped = false;
    const check = async () => {
      if (document.hidden) return;
      try {
        // Caché "default": sin cabeceras no-cache, para que el CDN pueda responder.
        const res = await fetch(`/api/version/${categoryId}`);
        if (!res.ok) return;
        const { v } = (await res.json()) as { v: string };
        if (last !== null && v !== last && !stopped) router.refresh();
        last = v;
      } catch {
        // Sin conexión: se reintenta en el próximo ciclo.
      }
    };
    check();
    const timer = setInterval(check, interval);
    const onVisible = () => !document.hidden && check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [categoryId, status, router]);
  return null;
}
