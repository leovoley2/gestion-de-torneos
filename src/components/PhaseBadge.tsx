import type { Phase } from "@/lib/format";

const STYLE: Record<Phase, string> = {
  live: "bg-sky-100 text-sky-800 ring-sky-200",
  upcoming: "bg-navy-50 text-navy-600 ring-navy-100",
  past: "bg-navy-800 text-navy-50 ring-navy-800",
  unknown: "bg-navy-50 text-navy-500 ring-navy-100",
};

/** Etiqueta de estado. En "En curso" lleva un punto que pulsa suavemente. */
export function PhaseBadge({ phase, children }: { phase: Phase; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${STYLE[phase]}`}
    >
      {phase === "live" && <span className="live-dot size-1.5 rounded-full bg-sky-500" aria-hidden="true" />}
      {children}
    </span>
  );
}
