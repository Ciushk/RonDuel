import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

console.log('--- Checking Romanian copy for valid comma-below diacritics (ș, ț, Ș, Ț) ---');

const CEDILLA_CHARS = ['ş', 'ţ', 'Ş', 'Ţ'];
const CEDILLA_NAMES = {
  'ş': 's-cedilla (U+015F) -> use ș (U+0219)',
  'ţ': 't-cedilla (U+0163) -> use ț (U+021B)',
  'Ş': 'S-cedilla (U+015E) -> use Ș (U+0218)',
  'Ţ': 'T-cedilla (U+0162) -> use Ț (U+021A)',
};

const filesToCheck = [
  path.join(rootDir, 'apps/web/messages/ro.json'),
  path.join(rootDir, 'apps/web/content/legal/ro/regulament.md'),
  path.join(rootDir, 'packages/shared/src/schemas.ts'),
];

let hasError = false;

for (const fp of filesToCheck) {
  if (!fs.existsSync(fp)) continue;
  const content = fs.readFileSync(fp, 'utf8');
  for (const char of CEDILLA_CHARS) {
    if (content.includes(char)) {
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(char)) {
          console.error(`ERROR: Found invalid ${CEDILLA_NAMES[char]} in ${path.relative(rootDir, fp)}:${i + 1}`);
          console.error(`  Line: ${lines[i].trim()}`);
          hasError = true;
        }
      }
    }
  }
}

// Also check seed questions for Romanian translations
const seedFile = path.join(rootDir, 'apps/web/content/seed/questions.en.json');
if (fs.existsSync(seedFile)) {
  const questions = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
  for (const q of questions) {
    const ro = q.content?.ro;
    if (ro) {
      const textToCheck = `${ro.prompt} ${ro.explanation ?? ''} ${(ro.options ?? []).join(' ')}`;
      for (const char of CEDILLA_CHARS) {
        if (textToCheck.includes(char)) {
          console.error(`ERROR: Found invalid ${CEDILLA_NAMES[char]} in seed question ${q.id} (ro)`);
          hasError = true;
        }
      }
    }
  }
}

if (hasError) {
  console.error('Romanian diacritics check FAILED. Please replace cedillas with comma-below letters (ș, ț).');
  process.exit(1);
} else {
  console.log('Romanian copy strictly uses valid comma-below letters (ș, ț, Ș, Ț). Clean! ✓');
}
