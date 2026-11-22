export function formatRomanianStreak(days: number, locale: string): string {
  if (locale !== 'ro') {
    return days === 1 ? '1 day' : `${days} days`;
  }
  if (days === 1) return '1 zi';
  const mod100 = days % 100;
  if (mod100 >= 2 && mod100 <= 19) return `${days} zile`;
  return `${days} de zile`;
}

export function formatRomanianPlayers(count: number, locale: string): string {
  if (locale !== 'ro') {
    return count === 1 ? '1 player' : `${count} players`;
  }
  if (count === 1) return '1 jucător';
  const mod100 = count % 100;
  if (mod100 >= 2 && mod100 <= 19) return `${count} jucători`;
  return `${count} de jucători`;
}

export function formatRomanianMembers(count: number, locale: string): string {
  if (locale !== 'ro') {
    return count === 1 ? '1 member' : `${count} members`;
  }
  if (count === 1) return '1 membru';
  const mod100 = count % 100;
  if (mod100 >= 2 && mod100 <= 19) return `${count} membri`;
  return `${count} de membri`;
}

const NOUNS = [
  'Vulpea', 'Lupul', 'Șoimul', 'Ursul', 'Vulturul', 'Cerbul',
  'Castorul', 'Ariciul', 'Râsul', 'Tigrul', 'Leul', 'Puma',
  'Pantera', 'Vidra', 'Delfinul', 'Corbul', 'Bufnița', 'Zimbrul'
];

const ADJECTIVES = [
  'Rapidă', 'Iute', 'Vitează', 'Curajoasă', 'Înțeleaptă', 'Agilă',
  'Puternică', 'Isteață', 'Fulgere', 'Neînfricată', 'Sprintenă', 'Vigilentă'
];

export function generateReadableNickname(): string {
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]!;
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]!;
  const num = Math.floor(10 + Math.random() * 90);
  const name = `${noun} ${adj} ${num}`;
  return name.slice(0, 20);
}
