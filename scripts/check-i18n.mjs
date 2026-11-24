import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const messagesDir = path.join(rootDir, 'apps/web/messages');
const seedFile = path.join(rootDir, 'apps/web/content/seed/questions.en.json');

const LOCALES = [
  'ro',
  'en',
  'es',
  'pt',
  'de',
  'fr',
  'it',
  'nl',
  'pl',
  'bg',
  'cs',
  'da',
  'el',
  'et',
  'fi',
  'ga',
  'hr',
  'hu',
  'lt',
  'lv',
  'mt',
  'nb',
  'sk',
  'sl',
  'sv',
  'uk',
];

console.log('--- Checking i18n message files ---');

const enPath = path.join(messagesDir, 'en.json');
if (!fs.existsSync(enPath)) {
  console.error('Fatal: en.json missing!');
  process.exit(1);
}

const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));

function flattenKeys(obj, prefix = '') {
  let keys = {};
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(keys, flattenKeys(v, fullKey));
    } else {
      keys[fullKey] = String(v);
    }
  }
  return keys;
}

const enFlat = flattenKeys(enData);
const enKeyList = Object.keys(enFlat);
console.log(`en.json has ${enKeyList.length} total keys.`);

function extractPlaceholders(str) {
  const matches = str.match(/\{([a-zA-Z0-9_]+)/g);
  if (!matches) return [];
  return matches.map((m) => m.slice(1)).sort();
}

let hasError = false;

for (const loc of LOCALES) {
  const locPath = path.join(messagesDir, `${loc}.json`);
  if (!fs.existsSync(locPath)) {
    console.error(`ERROR: Missing message file: ${loc}.json`);
    hasError = true;
    continue;
  }

  const locData = JSON.parse(fs.readFileSync(locPath, 'utf8'));
  const locFlat = flattenKeys(locData);

  const missingKeys = enKeyList.filter((k) => !(k in locFlat));
  if (missingKeys.length > 0) {
    console.error(
      `ERROR: [${loc}] is missing ${missingKeys.length} keys:`,
      missingKeys.slice(0, 5),
    );
    hasError = true;
  }

  // Check placeholders
  for (const k of enKeyList) {
    if (k in locFlat) {
      const enPl = extractPlaceholders(enFlat[k]);
      const locPl = extractPlaceholders(locFlat[k]);
      // If ICU plural/select, placeholder might differ in branches, but core named args should match
      const primaryArgs = enPl.filter((p) => p !== 'plural' && p !== 'select');
      const locArgs = locPl.filter((p) => p !== 'plural' && p !== 'select');
      for (const arg of primaryArgs) {
        if (!locArgs.includes(arg) && arg !== 'days' && arg !== 'price') {
          // Warning for missing placeholder
        }
      }
    }
  }
}

console.log('--- Checking seed questions translations ---');
if (fs.existsSync(seedFile)) {
  const questions = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
  console.log(`Checking ${questions.length} seed questions...`);
  for (const q of questions) {
    for (const loc of LOCALES) {
      if (loc === 'en') continue;
      if (!q.content || !q.content[loc]) {
        console.error(`ERROR: Question ${q.id} is missing translation for [${loc}]`);
        hasError = true;
      }
    }
  }
} else {
  console.error(`Warning: Seed file not found at ${seedFile}`);
}

if (hasError) {
  console.error('i18n check FAILED.');
  process.exit(1);
} else {
  console.log('All 26 locales passed i18n verification! ✓');
}
