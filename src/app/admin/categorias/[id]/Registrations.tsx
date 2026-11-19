import { ageOn, eligibilityIssues, fullName, isMinor, profileIssues, todayLima, type Athlete } from "@/lib/athletes";
import { getCategoryRegistrations, getRegCategory, missingDeclarations, rulesOf, type Registration } from "@/lib/registrations";
import { RegistrationBadge } from "@/components/RegistrationBadge";
import { RegistrationDecision, RegistrationSettingsForm } from "./RegistrationControls";

const toLocalInput = (d: Date | string | null) => {
  if (!d) return "";
  const date = new Date(d);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

/** Inscripciones de la categoría: ajustes (abrir/cerrar, plazo, cupo, años) y revisión de duplas. */
export async function RegistrationsSection({
  categoryId,
  editable,
  canReview,
}: {
  categoryId: string;
  editable: boolean; // ajustes de inscripción (organizador)
  canReview: boolean; // aceptar / rechazar (organizador o inscripciones)
}) {
  const [category, registrations] = await Promise.all([getRegCategory(categoryId), getCategoryRegistrations(categoryId)]);
  if (!category) return null;
  const toReview = registrations.filter((r) => r.status === "pending_review").length;
  const waiting = registrations.filter((r) => r.status === "pending_partner").length;
  const history = registrations.filter((r) => !["pending_review", "pending_partner"].includes(r.status));
  const active = registrations.filter((r) => ["pending_review", "pending_partner"].includes(r.status));

  return (
    <section className="card space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-navy-900">Inscripciones de atletas</h2>
          <p className="mt-0.5 text-sm text-navy-400">
            {category.registration_open ? "Abiertas" : "Cerradas"} · {toReview} por revisar · {waiting} esperando al compañero ·{" "}
            {category.accepted}
            {category.max_teams ? ` de ${category.max_teams}` : ""} aceptadas
          </p>
        </div>
      </div>

      {category.has_format ? (
        <p className="rounded-lg bg-navy-50 px-3 py-2 text-sm text-navy-500">
          El formato ya está generado: no entran nuevas duplas. Para aceptar más, reinicia el formato.
        </p>
      ) : editable ? (
        <RegistrationSettingsForm
          categoryId={category.id}
          initial={{
            open: category.registration_open,
            deadline: toLocalInput(category.registration_deadline),
            maxTeams: category.max_teams?.toString() ?? "",
            minYear: category.min_birth_year?.toString() ?? "",
            maxYear: category.max_birth_year?.toString() ?? "",
          }}
        />
      ) : null}

      <ul className="space-y-3">
        {active.map((r) => (
          <RegistrationCard key={r.id} reg={r} editable={canReview && !category.has_format} />
        ))}
        {active.length === 0 && <li className="text-sm text-navy-400">No hay inscripciones pendientes.</li>}
      </ul>

      {history.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-navy-500">Historial ({history.length})</summary>
          <ul className="mt-3 space-y-3">
            {history.map((r) => (
              <RegistrationCard key={r.id} reg={r} editable={false} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function RegistrationCard({ reg, editable }: { reg: Registration; editable: boolean }) {
  const c = reg.category;
  const problems =
    reg.status === "pending_review"
      ? [
          ...[reg.athlete1, reg.athlete2].flatMap((a) => profileIssues(a, c.start_date).map((m) => `${fullName(a)}: falta ${m}`)),
          ...eligibilityIssues(rulesOf(c), reg.athlete1, reg.athlete2),
          ...missingDeclarations(reg).map((a) => `Falta la declaración jurada de ${fullName(a)}`),
        ]
      : [];

  return (
    <li className={`rounded-xl border p-4 ${reg.status === "pending_review" ? "border-sky-200 bg-sky-50/30" : "border-navy-100/70"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-navy-900">
          {fullName(reg.athlete1)} / {fullName(reg.athlete2)}
        </p>
        <RegistrationBadge status={reg.status} />
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {[reg.athlete1, reg.athlete2].map((a) => (
          <AthleteSummary key={a.id} athlete={a} reg={reg} />
        ))}
      </div>
      {reg.admin_note && <p className="mt-3 text-sm text-navy-500">Nota: {reg.admin_note}</p>}
      {problems.length > 0 && (
        <ul className="mt-3 list-disc space-y-0.5 rounded-lg bg-amber-50 py-2 pr-3 pl-7 text-sm text-amber-900">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {editable && ["pending_review", "pending_partner"].includes(reg.status) && (
        <div className="mt-4 border-t border-navy-50 pt-4">
          <RegistrationDecision registrationId={reg.id} canAccept={reg.status === "pending_review" && problems.length === 0} />
        </div>
      )}
    </li>
  );
}

function AthleteSummary({ athlete: a, reg }: { athlete: Athlete; reg: Registration }) {
  const minor = isMinor(a, reg.category.start_date);
  const declaration = reg.declarations.find((d) => d.athlete_id === a.id);
  const rows: [string, string | null][] = [
    ["Documento", a.document_number ? `${a.document_type} ${a.document_number}` : null],
    ["Nacimiento", a.birthdate ? `${a.birthdate} (${ageOn(a.birthdate, reg.category.start_date ?? todayLima())} años)` : null],
    ["Sexo", a.gender === "F" ? "Femenino" : a.gender === "M" ? "Masculino" : null],
    ["Teléfono", a.phone],
    ["Ciudad / club", [a.city, a.club].filter(Boolean).join(" · ") || null],
    ["Correo", `${a.email}${a.email_verified_at ? "" : " (sin confirmar)"}`],
  ];
  if (minor) {
    rows.push(["Apoderado", a.guardian_name ? `${a.guardian_name} (${a.guardian_relationship ?? "—"})` : null]);
    rows.push(["Doc. / tel. apoderado", [a.guardian_document, a.guardian_phone].filter(Boolean).join(" · ") || null]);
  }
  return (
    <div className="rounded-lg bg-white px-3 py-2.5 text-xs ring-1 ring-navy-100/70">
      <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-navy-900">
        {fullName(a)}
        {minor && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Menor</span>}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-navy-400">{k}</dt>
            <dd className={v ? "text-navy-800" : "text-amber-700"}>{v ?? "Falta"}</dd>
          </div>
        ))}
      </dl>
      {minor && (
        <p className="mt-2">
          {declaration ? (
            <a href={`/api/declaraciones/${reg.id}/${a.id}`} target="_blank" className="font-semibold text-sky-600">
              Ver declaración jurada (PDF) ↗
            </a>
          ) : (
            <span className="font-semibold text-amber-700">Declaración jurada pendiente</span>
          )}
        </p>
      )}
    </div>
  );
}
