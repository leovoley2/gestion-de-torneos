// Paradas (torneos) con inscripción abierta, vistas por un atleta: qué categorías le corresponden,
// en cuáles ya está inscrito y cuáles están llenas. Lógica pura (se prueba sin base de datos).
import { ACTIVE_STATUSES, athleteFitReason, type Athlete, type RegistrationStatus } from "@/lib/athletes";

export interface OpenCategoryLike {
  id: string;
  name: string;
  gender: "F" | "M" | "X";
  min_birth_year: number | null;
  max_birth_year: number | null;
  max_teams: number | null;
  accepted: number;
  registration_deadline: Date | string | null;
  registration_fee: string | null;
  payment_instructions: string | null;
  tournament_id: string;
  tournament_name: string;
  tournament_city: string | null;
  start_date: string | null;
  end_date: string | null;
}

export interface MyRegistrationLike {
  id: string;
  status: RegistrationStatus;
  category: { id: string };
}

export type CategoryState =
  | { kind: "open" }
  | { kind: "registered"; registrationId: string; status: RegistrationStatus }
  | { kind: "full" }
  | { kind: "not_for_you"; reason: string };

export interface StopCategory<C extends OpenCategoryLike = OpenCategoryLike> {
  category: C;
  state: CategoryState;
  spotsLeft: number | null;
}

export interface OpenStop<C extends OpenCategoryLike = OpenCategoryLike> {
  tournamentId: string;
  name: string;
  city: string | null;
  startDate: string | null;
  endDate: string | null;
  /** Fecha límite más próxima entre sus categorías (para "cierra en X días"). */
  closesAt: Date | string | null;
  categories: StopCategory<C>[];
  /** ¿Hay al menos una categoría en la que este atleta pueda inscribirse ahora? */
  canJoin: boolean;
}

const ORDER: Record<CategoryState["kind"], number> = { registered: 0, open: 1, full: 2, not_for_you: 3 };

export function openStopsFor<C extends OpenCategoryLike>(
  open: C[],
  mine: MyRegistrationLike[],
  me: Pick<Athlete, "gender" | "birthdate">,
): OpenStop<C>[] {
  const active = new Map(mine.filter((r) => ACTIVE_STATUSES.includes(r.status)).map((r) => [r.category.id, r]));
  const stops = new Map<string, OpenStop<C>>();
  for (const c of open) {
    const reg = active.get(c.id);
    const spotsLeft = c.max_teams ? Math.max(c.max_teams - c.accepted, 0) : null;
    const reason = athleteFitReason(c, me);
    const state: CategoryState = reg
      ? { kind: "registered", registrationId: reg.id, status: reg.status }
      : reason
        ? { kind: "not_for_you", reason }
        : spotsLeft === 0
          ? { kind: "full" }
          : { kind: "open" };
    let stop = stops.get(c.tournament_id);
    if (!stop) {
      stop = {
        tournamentId: c.tournament_id,
        name: c.tournament_name,
        city: c.tournament_city,
        startDate: c.start_date,
        endDate: c.end_date,
        closesAt: null,
        categories: [],
        canJoin: false,
      };
      stops.set(c.tournament_id, stop);
    }
    stop.categories.push({ category: c, state, spotsLeft });
    if (state.kind === "open") stop.canJoin = true;
    if (c.registration_deadline && (!stop.closesAt || new Date(c.registration_deadline) < new Date(stop.closesAt))) {
      stop.closesAt = c.registration_deadline;
    }
  }
  for (const s of stops.values()) s.categories.sort((a, b) => ORDER[a.state.kind] - ORDER[b.state.kind]);
  // Primero las paradas donde puede inscribirse o ya está inscrito; al final las que no le corresponden.
  const rank = (s: OpenStop<C>) => (s.canJoin ? 0 : s.categories.some((c) => c.state.kind === "registered") ? 1 : 2);
  return [...stops.values()].sort(
    (a, b) => rank(a) - rank(b) || (a.startDate ?? "9999").localeCompare(b.startDate ?? "9999"),
  );
}
