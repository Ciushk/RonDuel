import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const webDir = path.join(rootDir, 'apps/web');
const outDir = path.join(rootDir, 'hosting-dist');

console.log('Building @ronduel/web...');
execSync('pnpm --filter @ronduel/web build', { stdio: 'inherit' });

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

// 1. Copy public/ assets
fs.cpSync(path.join(webDir, 'public'), outDir, { recursive: true });

// 2. Copy .next/static -> hosting-dist/_next/static
fs.mkdirSync(path.join(outDir, '_next/static'), { recursive: true });
fs.cpSync(path.join(webDir, '.next/static'), path.join(outDir, '_next/static'), {
  recursive: true,
});

// 3. Copy pre-rendered HTML and RSC payloads from .next/server/app -> hosting-dist
const serverAppDir = path.join(webDir, '.next/server/app');

function copyPreRendered(srcDir, relDir = '') {
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const relPath = path.join(relDir, entry.name);
    if (entry.isDirectory()) {
      copyPreRendered(srcPath, relPath);
    } else if (entry.name.endsWith('.html') || entry.name.endsWith('.rsc')) {
      const destPath = path.join(outDir, relPath);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
    } else if (entry.name === 'manifest.webmanifest.body') {
      fs.copyFileSync(srcPath, path.join(outDir, 'manifest.webmanifest'));
      fs.copyFileSync(srcPath, path.join(outDir, 'manifest.json'));
    }
  }
}

copyPreRendered(serverAppDir);

if (fs.existsSync(path.join(outDir, '_not-found.html'))) {
  fs.copyFileSync(path.join(outDir, '_not-found.html'), path.join(outDir, '404.html'));
}

const locales = [
  'ro', 'en', 'es', 'pt', 'de', 'fr', 'it', 'nl', 'pl', 'bg',
  'cs', 'da', 'el', 'et', 'fi', 'ga', 'hr', 'hu', 'lt', 'lv',
  'mt', 'nb', 'sk', 'sl', 'sv', 'uk',
];

// 4. Ensure <html lang="${locale}"> in pre-rendered static HTML files for each locale
for (const locale of locales) {
  const locHtml = path.join(outDir, `${locale}.html`);
  const locDir = path.join(outDir, locale);
  if (fs.existsSync(locHtml)) {
    let content = fs.readFileSync(locHtml, 'utf8');
    if (content.includes('<html')) {
      const patched = content.replace(/<html([^>]*?)lang="[^"]*"/, `<html$1lang="${locale}"`);
      fs.writeFileSync(locHtml, patched, 'utf8');
    }
    fs.mkdirSync(locDir, { recursive: true });
    fs.copyFileSync(locHtml, path.join(locDir, 'index.html'));
  }

  if (!fs.existsSync(locDir)) continue;

  function patchLocaleHtml(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        patchLocaleHtml(fullPath);
      } else if (entry.name.endsWith('.html')) {
        let content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('<html')) {
          const patched = content.replace(/<html([^>]*?)lang="[^"]*"/, `<html$1lang="${locale}"`);
          if (patched !== content) {
            fs.writeFileSync(fullPath, patched, 'utf8');
          }
        }
      }
    }
  }

  patchLocaleHtml(locDir);
}
console.log('Patched <html lang="..."> across all pre-rendered locale HTML files.');

const shellRoutes = ['result', 'l', 'league', 'duel'];
for (const locale of locales) {
  for (const route of shellRoutes) {
    const shellPath = path.join(outDir, locale, route, '_shell.html');
    if (!fs.existsSync(shellPath)) {
      throw new Error(`Missing expected hosting shell: ${shellPath}`);
    }
  }
}
console.log('Verified all 104 client shells exist across 26 locales.');

console.log('Packaged Firebase Hosting directory at hosting-dist/');

