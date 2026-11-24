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

/** Icons a league owner can pick for the league. */
export const LEAGUE_EMOJI_OPTIONS = ['🏆', '⚡', '☕', '🧠', '🎯', '🚀', '👑', '🔥'] as const;

export interface LeagueColorOption {
  id: string;
  name: string;
  pro: boolean;
  bg: string;
}

/** Colours a league owner can pick for the league. */
export const LEAGUE_COLOR_OPTIONS: LeagueColorOption[] = [
  { id: 'default', name: 'Classic', pro: false, bg: 'bg-[#FF5A4E]' },
  { id: 'volt', name: 'Volt', pro: false, bg: 'bg-[#C6FF3D]' },
  { id: 'gold', name: 'Gold', pro: false, bg: 'bg-[#FFB800]' },
  { id: 'midnight', name: 'Midnight', pro: true, bg: 'bg-[#0E0D15]' },
  { id: 'clay', name: 'Clay', pro: true, bg: 'bg-[#E07A5F]' },
  { id: 'neon', name: 'Neon', pro: true, bg: 'bg-[#00F5D4]' },
];

export const LEAGUE_COLOR_IDS: string[] = LEAGUE_COLOR_OPTIONS.map((c) => c.id);

export function getLeagueTheme(color?: string | null): LeagueTheme {
  return (color && LEAGUE_THEMES[color]) || LEAGUE_THEMES.default!;
}

/** Soft tint of the league colour, e.g. leagueThemeTint(color, '22') for ~13% alpha. */
export function leagueThemeTint(color: string | null | undefined, alpha: string): string {
  return `${getLeagueTheme(color).hex}${alpha}`;
}
