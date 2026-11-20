"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Status = "setup" | "in_progress" | "finished";

/** Cada cuánto preguntar según el estado: en juego 10 s, por iniciar 60 s, terminada nunca. */
const INTERVAL_MS: Record<Status, number | null> = { in_progress: 10_000, setup: 60_000, finished: null };

const time = (d: Date) => d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", timeZone: "America/Lima" });

/**
 * Mantiene la vista pública al día: pregunta si la categoría cambió y solo entonces recarga los
 * datos. No consulta con la pestaña en segundo plano. La respuesta viene del CDN (ver
 * api/version), así que muchos espectadores no multiplican las consultas a la base de datos.
 * Con la categoría en juego muestra el aviso "En vivo" y la hora del último cambio recibido.
 */
export function LiveRefresh({ categoryId, status }: { categoryId: string; status: Status }) {
  const router = useRouter();
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
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
        if (last !== null && v !== last && !stopped) {
          router.refresh();
          setUpdatedAt(new Date());
        }
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

  if (status !== "in_progress") return null;
  return (
    <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-sky-100 ring-1 ring-white/15 ring-inset">
      <span className="relative flex size-2" aria-hidden="true">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
      </span>
      <span>
        En vivo · {updatedAt ? `actualizado a las ${time(updatedAt)}` : "los resultados se actualizan solos"}
      </span>
    </p>
  );
}
