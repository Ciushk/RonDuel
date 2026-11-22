export interface LocaleInfo {
  code: string;
  flag: string;
  name: string;
  suffix: string;
}

export const ALL_LOCALES = [
  { code: 'ro', flag: '🇷🇴', name: 'Română', suffix: 'RO' },
  { code: 'en', flag: '🇬🇧', name: 'English', suffix: 'EN' },
  { code: 'es', flag: '🇪🇸', name: 'Español', suffix: 'ES' },
  { code: 'pt', flag: '🇵🇹', name: 'Português', suffix: 'PT' },
  { code: 'de', flag: '🇩🇪', name: 'Deutsch', suffix: 'DE' },
  { code: 'fr', flag: '🇫🇷', name: 'Français', suffix: 'FR' },
  { code: 'it', flag: '🇮🇹', name: 'Italiano', suffix: 'IT' },
  { code: 'nl', flag: '🇳🇱', name: 'Nederlands', suffix: 'NL' },
  { code: 'pl', flag: '🇵🇱', name: 'Polski', suffix: 'PL' },
  { code: 'bg', flag: '🇧🇬', name: 'Български', suffix: 'BG' },
  { code: 'cs', flag: '🇨🇿', name: 'Čeština', suffix: 'CS' },
  { code: 'da', flag: '🇩🇰', name: 'Dansk', suffix: 'DA' },
  { code: 'el', flag: '🇬🇷', name: 'Ελληνικά', suffix: 'EL' },
  { code: 'et', flag: '🇪🇪', name: 'Eesti', suffix: 'ET' },
  { code: 'fi', flag: '🇫🇮', name: 'Suomi', suffix: 'FI' },
  { code: 'ga', flag: '🇮🇪', name: 'Gaeilge', suffix: 'GA' },
  { code: 'hr', flag: '🇭🇷', name: 'Hrvatski', suffix: 'HR' },
  { code: 'hu', flag: '🇭🇺', name: 'Magyar', suffix: 'HU' },
  { code: 'lt', flag: '🇱🇹', name: 'Lietuvių', suffix: 'LT' },
  { code: 'lv', flag: '🇱🇻', name: 'Latviešu', suffix: 'LV' },
  { code: 'mt', flag: '🇲🇹', name: 'Malti', suffix: 'MT' },
  { code: 'nb', flag: '🇳🇴', name: 'Norsk', suffix: 'NB' },
  { code: 'sk', flag: '🇸🇰', name: 'Slovenčina', suffix: 'SK' },
  { code: 'sl', flag: '🇸🇮', name: 'Slovenščina', suffix: 'SL' },
  { code: 'sv', flag: '🇸🇪', name: 'Svenska', suffix: 'SV' },
  { code: 'uk', flag: '🇺🇦', name: 'Українська', suffix: 'UK' },
] as const;

export const SUPPORTED_LOCALE_CODES = [
  'ro', 'en', 'es', 'pt', 'de', 'fr', 'it', 'nl', 'pl', 'bg',
  'cs', 'da', 'el', 'et', 'fi', 'ga', 'hr', 'hu', 'lt', 'lv',
  'mt', 'nb', 'sk', 'sl', 'sv', 'uk',
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALE_CODES)[number];
