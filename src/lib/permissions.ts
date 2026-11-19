// Permisos del equipo de la organización (lógica pura, sin base de datos).

export type Role = "superadmin" | "organizer" | "results" | "registrations";

export type Permission =
  | "staff.manage" // equipo y accesos
  | "ranking.manage" // rankings y tablas de puntos
  | "tournament.create"
  | "tournament.edit" // datos, publicar, categorías, duplas, formato, posiciones finales
  | "results.edit" // resultados y programación
  | "registrations.review" // aceptar / rechazar inscripciones
  | "athletes.support"; // ver atletas, crear fichas, enlaces de contraseña, unir fichas

export interface RoleGrant {
  role: Role;
  tournament_id: string | null; // null = todos los torneos
}

export const ROLE_INFO: Record<Role, { label: string; description: string }> = {
  superadmin: { label: "Administrador general", description: "Todo, incluido el equipo, los rankings y las tablas de puntos." },
  organizer: { label: "Organizador", description: "Torneos, categorías, duplas, formato, inscripciones, resultados y posiciones." },
  results: { label: "Mesa de resultados", description: "Solo cargar resultados y programación." },
  registrations: { label: "Inscripciones", description: "Revisar inscripciones y atender a los atletas." },
};

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  superadmin: [
    "staff.manage",
    "ranking.manage",
    "tournament.create",
    "tournament.edit",
    "results.edit",
    "registrations.review",
    "athletes.support",
  ],
  organizer: ["tournament.create", "tournament.edit", "results.edit", "registrations.review", "athletes.support"],
  results: ["results.edit"],
  registrations: ["registrations.review", "athletes.support"],
};

/** Permisos que no dependen de un torneo: solo los otorga un rol global. */
const GLOBAL_ONLY: Permission[] = ["staff.manage", "ranking.manage", "tournament.create"];

/**
 * ¿Estos roles permiten la acción? Con `tournamentId`, vale un rol global o uno de ese torneo.
 * Sin `tournamentId` (acciones que no son de un torneo) solo valen roles globales, salvo atender
 * atletas, que también lo puede hacer un rol de un torneo. GLOBAL_ONLY exige siempre un rol global.
 */
export function can(grants: RoleGrant[], permission: Permission, tournamentId?: string | null): boolean {
  return grants.some((g) => {
    if (!ROLE_PERMISSIONS[g.role]?.includes(permission)) return false;
    if (g.tournament_id === null) return true;
    if (GLOBAL_ONLY.includes(permission)) return false;
    // Rol de un torneo: vale para ese torneo; sin torneo, solo para atender atletas.
    return tournamentId == null ? permission === "athletes.support" : g.tournament_id === tournamentId;
  });
}

/** Torneos que estos roles pueden ver en el panel (null = todos). */
export function visibleTournaments(grants: RoleGrant[]): string[] | null {
  if (grants.some((g) => g.tournament_id === null)) return null;
  return [...new Set(grants.map((g) => g.tournament_id!).filter(Boolean))];
}
