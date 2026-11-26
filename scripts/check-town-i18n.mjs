import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TOWN_LOCALES = [
  'bg',
  'cs',
  'da',
  'de',
  'el',
  'en',
  'es',
  'et',
  'fi',
  'fr',
  'ga',
  'hr',
  'hu',
  'it',
  'lt',
  'lv',
  'mt',
  'nb',
  'nl',
  'pl',
  'pt',
  'ro',
  'sk',
  'sl',
  'sv',
  'uk',
];

const BRAND_TOKENS = new Set(['RonTown', 'RonCoins', 'RonCoin', 'Pro', 'RonDuel']);

/**
 * Genuine single-word cognates that are spelled identically in English and specific target locales.
 */
const COGNATE_ALLOWLIST = {
  'town.catalog.villa.name': new Set([
    'da',
    'de',
    'es',
    'et',
    'fi',
    'fr',
    'hu',
    'it',
    'lv',
    'mt',
    'nb',
    'nl',
    'pt',
    'sv',
  ]),
  'town.catalog.hospital.name': new Set(['da', 'es', 'pt']),
  'town.catalog.park.name': new Set(['de', 'mt', 'nl']),
  'town.catalog.cottage.name': new Set(['fr', 'it']),
  'town.catalog.school.name': new Set(['nl']),
  'town.shop.tabServices': new Set(['fr']),
  'town.shop.tabDecor': new Set(['ro']),
  'town.plurals.minutes': new Set(['fr']),
};

function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v, full));
    } else {
      out[full] = String(v);
    }
  }
  return out;
}

function extractPlaceholders(str) {
  const names = new Set();
  const re = /\{([a-zA-Z0-9_]+)(?:,|\})/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    names.add(m[1]);
  }
  return Array.from(names).sort();
}

function isBrandOrFormatOnly(str) {
  // Remove ICU plural boilerplate, placeholders, punctuation, digits, and brand tokens
  let stripped = str
    .replace(/\{[a-zA-Z0-9_]+,\s*plural,\s*/g, ' ')
    .replace(/\b(zero|one|two|few|many|other)\s*\{/g, ' ')
    .replace(/\{[a-zA-Z0-9_]+\}/g, ' ')
    .replace(/[{}#+\-·•/≈€$%:().,!?0-9\s]/g, ' ')
    .trim();
  if (!stripped) return true;
  const words = stripped.split(/\s+/).filter(Boolean);
  return words.every((w) => BRAND_TOKENS.has(w));
}

export function runTownI18nCheck(rootDir = process.cwd()) {
  const messagesDir = path.join(rootDir, 'apps/web/messages');
  const enPath = path.join(messagesDir, 'en.json');
  const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  const enTown = flatten(enData.town, 'town');
  const enKeys = Object.keys(enTown);
  const errors = [];

  for (const locale of TOWN_LOCALES) {
    const locPath = path.join(messagesDir, `${locale}.json`);
    if (!fs.existsSync(locPath)) {
      errors.push(`[${locale}] Missing file ${locPath}`);
      continue;
    }
    const locData = JSON.parse(fs.readFileSync(locPath, 'utf8'));
    if (!locData.town || typeof locData.town !== 'object') {
      errors.push(`[${locale}] Missing town namespace`);
      continue;
    }
    const locTown = flatten(locData.town, 'town');

    for (const key of enKeys) {
      if (!(key in locTown)) {
        errors.push(`[${locale}] Missing key: ${key}`);
        continue;
      }
      const enVal = enTown[key];
      const locVal = locTown[key];
      if (!locVal || !locVal.trim()) {
        errors.push(`[${locale}] Empty value for ${key}`);
        continue;
      }

      const enPl = extractPlaceholders(enVal);
      const locPl = extractPlaceholders(locVal);
      if (enPl.join(',') !== locPl.join(',')) {
        errors.push(
          `[${locale}] Placeholder mismatch for ${key}: expected [${enPl.join(',')}], got [${locPl.join(',')}]`,
        );
      }

      if (locale !== 'en' && locVal === enVal) {
        const cognateLocales = COGNATE_ALLOWLIST[key];
        const allowedCognate = Boolean(cognateLocales && cognateLocales.has(locale));
        if (!allowedCognate && !isBrandOrFormatOnly(enVal)) {
          errors.push(
            `[${locale}] Untranslated English value for ${key}: ${JSON.stringify(locVal)}`,
          );
        }
      }
    }
  }

  return { keyCount: enKeys.length, localeCount: TOWN_LOCALES.length, errors };
}

const isCli =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isCli) {
  console.log('--- Checking RonTown i18n coverage across all 26 locales ---');
  const { keyCount, localeCount, errors } = runTownI18nCheck();
  if (errors.length > 0) {
    for (const err of errors.slice(0, 40)) {
      console.error('ERROR:', err);
    }
    if (errors.length > 40) {
      console.error(`... and ${errors.length - 40} more errors.`);
    }
    process.exit(1);
  }
  console.log(
    `All ${localeCount} locales passed RonTown i18n verification (${keyCount} town.* keys)! ✓`,
  );
}
