import { REGISTRATION_STATUS, type RegistrationStatus } from "@/lib/athletes";

const TONE = {
  wait: "bg-sky-50 text-sky-700 ring-sky-200",
  ok: "bg-navy-800 text-white ring-navy-800",
  bad: "bg-red-50 text-red-700 ring-red-200",
  off: "bg-navy-50 text-navy-400 ring-navy-100",
} as const;

export function RegistrationBadge({ status }: { status: RegistrationStatus }) {
  const s = REGISTRATION_STATUS[status];
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${TONE[s.tone]}`}>
      {s.label}
    </span>
  );
}
