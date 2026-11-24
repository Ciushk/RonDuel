export interface LeagueTheme {
  hex: string;
  onHex: string;
}

const LEAGUE_THEMES: Record<string, LeagueTheme> = {
  default: { hex: '#FF5A4E', onHex: '#16131F' },
  volt: { hex: '#C6FF3D', onHex: '#16131F' },
  gold: { hex: '#FFB800', onHex: '#16131F' },
  midnight: { hex: '#0E0D15', onHex: '#FFFFFF' },
  clay: { hex: '#E07A5F', onHex: '#16131F' },
  neon: { hex: '#00F5D4', onHex: '#16131F' },
};

export function getLeagueTheme(color?: string | null): LeagueTheme {
  return (color && LEAGUE_THEMES[color]) || LEAGUE_THEMES.default!;
}

/** Keep only known theme ids. Anything else becomes `default`. */
export function normalizeLeagueThemeColor(color?: string | null): string {
  if (color && Object.prototype.hasOwnProperty.call(LEAGUE_THEMES, color)) return color;
  return 'default';
}

/** Soft tint of the league colour, e.g. leagueThemeTint(color, '22') for ~13% alpha. */
export function leagueThemeTint(color: string | null | undefined, alpha: string): string {
  return `${getLeagueTheme(color).hex}${alpha}`;
}
