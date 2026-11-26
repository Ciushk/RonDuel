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
  // Match real ICU placeholders `{name}` or `{name, plural/select/...}` without matching plural branch text
  const found = new Set();
  const re = /\{([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:,|\})/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    found.add(m[1]);
  }
  return Array.from(found).sort();
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

  // Check placeholders (strict error for league.* keys)
  for (const k of enKeyList) {
    if (k in locFlat) {
      const enPl = extractPlaceholders(enFlat[k]);
      const locPl = extractPlaceholders(locFlat[k]);
      for (const arg of enPl) {
        if (!locPl.includes(arg) && arg !== 'days' && arg !== 'price') {
          if (k.startsWith('league.')) {
            console.error(
              `ERROR: [${loc}] key "${k}" is missing ICU placeholder "{${arg}}" (expected: ${enPl.join(', ')})`,
            );
            hasError = true;
          }
        }
      }
      if (k.startsWith('league.')) {
        for (const arg of locPl) {
          if (!enPl.includes(arg)) {
            console.error(
              `ERROR: [${loc}] key "${k}" has unexpected ICU placeholder "{${arg}}" (expected: ${enPl.join(', ')})`,
            );
            hasError = true;
          }
        }
      }
    }
  }
}

console.log('--- Scanning apps/web source for missing i18n keys ---');
const webRoot = path.join(rootDir, 'apps/web');
const topNamespaces = new Set(Object.keys(enData));
const EXCLUDED_DIRS = new Set(['node_modules', '.next', 'tests', '__tests__']);

function walkSourceFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkSourceFiles(fullPath, acc);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) {
      acc.push(fullPath);
    }
  }
  return acc;
}

const sourceFiles = walkSourceFiles(webRoot);
let scannedCalls = 0;

for (const filePath of sourceFiles) {
  const src = fs.readFileSync(filePath, 'utf8');
  const varToNs = new Map();

  // Match `const t = useTranslations('ns')`, `const t = useTranslations()`,
  // `const t = await getTranslations('ns')`, or `getTranslations({ locale, namespace: 'ns' })`
  const simpleDeclRe =
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)/g;
  let match;
  while ((match = simpleDeclRe.exec(src)) !== null) {
    varToNs.set(match[1], match[2] || '');
  }

  const objDeclRe =
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?getTranslations\(\s*\{[^}]*namespace\s*:\s*['"`]([^'"`]+)['"`][^}]*\}\s*\)/g;
  while ((match = objDeclRe.exec(src)) !== null) {
    varToNs.set(match[1], match[2] || '');
  }

  if (varToNs.size === 0) continue;

  const relPath = path.relative(rootDir, filePath);

  for (const [varName, ns] of varToNs.entries()) {
    // Match `t('key')`, `t("key")`, `t.rich('key')`, `t.raw('key')`, or `tRich('key')`
    // Rejects template literals with ${...} and string concatenation (`'a' + b`)
    const callRe = new RegExp(
      `(?<![.\\w$])(?:${varName}(?:\\.rich|\\.raw)?|${varName}Rich)\\(\\s*(['"])([^'"\\n\\r]+)\\1\\s*(?:,|\\))`,
      'g',
    );
    let cm;
    while ((cm = callRe.exec(src)) !== null) {
      const key = cm[2];
      if (!key) continue;
      scannedCalls += 1;

      let resolved = key;
      if (ns) {
        const scoped = `${ns}.${key}`;
        const firstSeg = key.split('.')[0];
        if (scoped in enFlat) {
          resolved = scoped;
        } else if (topNamespaces.has(firstSeg) && key in enFlat) {
          resolved = key;
        } else {
          resolved = scoped;
        }
      }

      if (!(resolved in enFlat)) {
        console.error(`ERROR: Missing i18n key "${resolved}" used in ${relPath}`);
        hasError = true;
      }
    }
  }
}

console.log(`Scanned ${sourceFiles.length} source files (${scannedCalls} static t() calls).`);

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
