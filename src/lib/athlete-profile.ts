import "server-only";
import { cache } from "react";
import { fullName } from "@/lib/athletes";
import { getCategoryView, isUuid } from "@/lib/data";
import { sql } from "@/lib/db";
import { computeRanking, getCategoryFinals, getRankings } from "@/lib/ranking";
import { teamMatches, type TeamRecord } from "@/lib/athlete-matches";

// Lo que se muestra de un atleta: sus duplas en torneos PUBLICADOS, sus partidos y su ranking.
// Nunca datos personales (documento, nacimiento, correo, teléfono, apoderado).

export interface Participation {
  teamId: string;
  partner: { id: string | null; name: string };
  category: { id: string; name: string; gender: "F" | "M" | "X"; status: "setup" | "in_progress" | "finished" };
  tournament: { id: string; name: string; city: string | null; start_date: string | null; end_date: string | null };
  record: TeamRecord;
  /** Nombre de cada dupla de la categoría (para mostrar rivales). */
  names: Record<string, string>;
  /** Puesto final si la categoría terminó. */
  position: number | null;
}

export interface PublicAthlete {
  id: string;
  name: string;
  club: string | null;
  city: string | null;
  gender: "F" | "M" | null; // solo para redactar ("campeona"/"campeón")
}

type Row = {
  team_id: string;
  player1: string;
  player2: string;
  athlete1_id: string | null;
  athlete2_id: string | null;
  category_id: string;
  partner_name: string | null;
};

/** Duplas del atleta en torneos publicados, del torneo más reciente al más antiguo. */
export async function getParticipations(athleteId: string): Promise<Participation[]> {
  if (!isUuid(athleteId)) return [];
  const rows = await sql<Row[]>`
    select tm.id as team_id, tm.player1, tm.player2, tm.athlete1_id, tm.athlete2_id, tm.category_id,
      nullif(trim(pa.first_name || ' ' || pa.last_name), '') as partner_name
    from teams tm
      join categories c on c.id = tm.category_id
      join tournaments t on t.id = c.tournament_id
      left join athletes pa on pa.id = case when tm.athlete1_id = ${athleteId} then tm.athlete2_id else tm.athlete1_id end
    where (tm.athlete1_id = ${athleteId} or tm.athlete2_id = ${athleteId}) and t.published
    order by t.start_date desc nulls first, c.created_at`;

  const out = await Promise.all(
    rows.map(async (r): Promise<Participation | null> => {
      const view = await getCategoryView(r.category_id, { includeDrafts: false });
      if (!view) return null;
      const first = r.athlete1_id === athleteId;
      const finals = view.category.status === "finished" ? await getCategoryFinals(view) : null;
      return {
        teamId: r.team_id,
        partner: first
          ? { id: r.athlete2_id, name: r.partner_name ?? r.player2 }
          : { id: r.athlete1_id, name: r.partner_name ?? r.player1 },
        category: {
          id: view.category.id,
          name: view.category.name,
          gender: view.category.gender,
          status: view.category.status,
        },
        tournament: {
          id: view.tournament.id,
          name: view.tournament.name,
          city: view.tournament.city,
          start_date: view.tournament.start_date,
          end_date: view.tournament.end_date,
        },
        record: teamMatches(view.state, r.team_id, view.schedule),
        names: Object.fromEntries(view.teamRefs.map((t) => [t.id, t.name])),
        position: finals?.find((f) => f.teamId === r.team_id)?.position ?? null,
      };
    }),
  );
  return out.filter((p): p is Participation => p !== null);
}

/** Puesto y puntos del atleta en cada ranking publicado en el que aparece. */
export async function getAthleteRankings(athleteId: string) {
  const rankings = await getRankings(true);
  const views = await Promise.all(rankings.map((r) => computeRanking(r.id)));
  return views.flatMap((v) => {
    const row = v?.rows.find((r) => r.athleteId === athleteId);
    return v && row ? [{ ranking: v.ranking, rank: row.rank, points: row.points, total: v.rows.length, awards: row.awards }] : [];
  });
}

/**
 * Perfil público. Solo existe si el atleta jugó en algún torneo publicado o figura en un ranking
 * publicado: así no se puede usar para averiguar quién tiene cuenta.
 */
export const getPublicProfile = cache(async (athleteId: string) => {
  if (!isUuid(athleteId)) return null;
  const [a] = await sql<{ id: string; first_name: string; last_name: string; club: string | null; city: string | null; gender: "F" | "M" | null }[]>`
    select id, first_name, last_name, club, city, gender from athletes where id = ${athleteId}`;
  if (!a) return null;
  const [participations, rankings] = await Promise.all([getParticipations(a.id), getAthleteRankings(a.id)]);
  if (participations.length === 0 && rankings.length === 0) return null;
  const athlete: PublicAthlete = { id: a.id, name: fullName(a) || "Atleta", club: a.club, city: a.city, gender: a.gender };
  return { athlete, participations, rankings };
});
