import type { ResolvedMatch, Rules, StandingRow, TiebreakCriterion } from "./types";

const ratio = (won: number, lost: number) => (lost === 0 ? (won > 0 ? Infinity : 0) : won / lost);

function emptyRow(teamId: string): StandingRow {
  return {
    teamId, played: 0, wins: 0, losses: 0, win20: 0, win21: 0, loss12: 0, loss02: 0, points: 0,
    setsWon: 0, setsLost: 0, pointsFor: 0, pointsAgainst: 0, setRatio: 0, pointRatio: 0, position: 0,
  };
}

/** Suma un partido terminado a las filas de sus dos equipos. */
function applyMatch(rows: Map<string, StandingRow>, m: ResolvedMatch, rules: Rules) {
  if (m.status !== "finished" || !m.teamA || !m.teamB || !m.winner || !m.result) return;
  const ra = rows.get(m.teamA);
  const rb = rows.get(m.teamB);
  if (!ra || !rb) return;

  // W.O.: cuenta como victoria limpia con sets a 0 (criterio FIVB).
  const sets = m.result.walkoverWinner
    ? Array.from({ length: rules.match.setsToWin }, () =>
        m.result!.walkoverWinner === m.teamA
          ? { a: rules.match.setPoints, b: 0 }
          : { a: 0, b: rules.match.setPoints },
      )
    : m.result.sets;

  let setsA = 0;
  let setsB = 0;
  for (const s of sets) {
    ra.pointsFor += s.a;
    ra.pointsAgainst += s.b;
    rb.pointsFor += s.b;
    rb.pointsAgainst += s.a;
    if (s.a > s.b) setsA++;
    else setsB++;
  }
  ra.setsWon += setsA;
  ra.setsLost += setsB;
  rb.setsWon += setsB;
  rb.setsLost += setsA;

  const [win, lose, loserSets] = m.winner === m.teamA ? [ra, rb, setsB] : [rb, ra, setsA];
  win.played++;
  lose.played++;
  win.wins++;
  lose.losses++;
  if (m.result.walkoverWinner) {
    win.win20++;
    lose.loss02++;
    win.points += rules.scoring.woWin;
    lose.points += rules.scoring.woLoss;
  } else if (loserSets === 0) {
    win.win20++;
    lose.loss02++;
    win.points += rules.scoring.win20;
    lose.points += rules.scoring.loss02;
  } else {
    win.win21++;
    lose.loss12++;
    win.points += rules.scoring.win21;
    lose.points += rules.scoring.loss12;
  }
}

function criterionValue(
  c: TiebreakCriterion,
  row: StandingRow,
  block: Set<string>,
  matches: ResolvedMatch[],
  seeds: Map<string, number>,
): number {
  switch (c) {
    case "points":
      return row.points;
    case "wins":
      return row.wins;
    case "set_ratio":
      return row.setRatio;
    case "point_ratio":
      return row.pointRatio;
    case "seed":
      return -(seeds.get(row.teamId) ?? 9999); // menor siembra = mejor
    case "head_to_head":
      // Victorias solo en los partidos entre los equipos empatados.
      return matches.filter(
        (m) =>
          m.status === "finished" &&
          m.winner === row.teamId &&
          block.has(m.teamA ?? "") &&
          block.has(m.teamB ?? ""),
      ).length;
  }
}

/** Ordena aplicando criterios en cascada: cada criterio solo separa a los que siguen empatados. */
export function rankRows(
  rows: StandingRow[],
  criteria: TiebreakCriterion[],
  matches: ResolvedMatch[],
  seeds: Map<string, number>,
): StandingRow[] {
  if (rows.length <= 1 || criteria.length === 0) return rows;
  const [c, ...rest] = criteria;
  const block = new Set(rows.map((r) => r.teamId));
  const valued = rows.map((r) => ({ r, v: criterionValue(c, r, block, matches, seeds) }));
  valued.sort((x, y) => y.v - x.v);
  const out: StandingRow[] = [];
  for (let i = 0; i < valued.length; ) {
    let j = i;
    while (j < valued.length && valued[j].v === valued[i].v) j++;
    out.push(...rankRows(valued.slice(i, j).map((x) => x.r), rest, matches, seeds));
    i = j;
  }
  return out;
}

export function computeStandings(
  teamIds: string[],
  matches: ResolvedMatch[],
  rules: Rules,
  seeds: Map<string, number>,
): StandingRow[] {
  const rows = new Map(teamIds.map((id) => [id, emptyRow(id)]));
  for (const m of matches) applyMatch(rows, m, rules);
  for (const r of rows.values()) {
    r.setRatio = ratio(r.setsWon, r.setsLost);
    r.pointRatio = ratio(r.pointsFor, r.pointsAgainst);
  }
  return rankRows([...rows.values()], rules.tiebreak, matches, seeds).map((r, i) => ({
    ...r,
    position: i + 1,
  }));
}
