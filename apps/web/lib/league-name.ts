export interface LeagueNameLike {
  name?: unknown;
  title?: unknown;
  leagueName?: unknown;
}

function cleanCandidate(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'undefined' || trimmed.toLowerCase() === 'null') {
    return '';
  }
  return trimmed;
}

/**
 * Resolves a safe display name for a league from `name` (or legacy `title` / `leagueName`).
 * Never returns the literal string "undefined" or "null".
 */
export function resolveLeagueDisplayName(league: LeagueNameLike | null | undefined): string {
  if (!league) return '';
  return (
    cleanCandidate(league.name) ||
    cleanCandidate(league.title) ||
    cleanCandidate(league.leagueName) ||
    ''
  );
}
