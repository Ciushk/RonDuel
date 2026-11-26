import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const webDir = path.join(rootDir, 'apps/web');
const outDir = path.join(rootDir, 'hosting-dist');

function resolveBuildId() {
  const fromEnv = process.env.GITHUB_SHA?.trim() || process.env.NEXT_PUBLIC_BUILD_ID?.trim();
  if (fromEnv) return fromEnv;
  try {
    return execSync('git rev-parse HEAD', { cwd: rootDir, encoding: 'utf8' }).trim();
  } catch {
    return `local-${Date.now()}`;
  }
}

const buildId = resolveBuildId();
const builtAt = new Date().toISOString();

console.log(`Building @ronduel/web (buildId=${buildId.slice(0, 12)})...`);
execSync('pnpm --filter @ronduel/web build', {
  stdio: 'inherit',
  env: {
    ...process.env,
    NEXT_PUBLIC_BUILD_ID: buildId,
    NEXT_PUBLIC_BUILT_AT: builtAt,
  },
});

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

// 1. Copy public/ assets
fs.cpSync(path.join(webDir, 'public'), outDir, { recursive: true });

// 1b. Inject buildId into hosting-dist/sw.js and emit hosting-dist/version.json
const swOutPath = path.join(outDir, 'sw.js');
if (fs.existsSync(swOutPath)) {
  const swSource = fs.readFileSync(swOutPath, 'utf8');
  fs.writeFileSync(swOutPath, swSource.replaceAll('__RONDUEL_BUILD_ID__', buildId), 'utf8');
}
fs.writeFileSync(
  path.join(outDir, 'version.json'),
  JSON.stringify({ buildId, builtAt }, null, 2) + '\n',
  'utf8',
);
console.log(`Stamped sw.js and wrote hosting-dist/version.json (${buildId.slice(0, 12)}).`);

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

// 4. Ensure <html lang="${locale}"> in pre-rendered static HTML files for each locale
for (const locale of locales) {
  const locHtml = path.join(outDir, `${locale}.html`);
  const locDir = path.join(outDir, locale);
  if (fs.existsSync(locHtml)) {
    let content = fs.readFileSync(locHtml, 'utf8');
    let patched = content;
    if (content.includes('<html')) {
      patched = patched.replace(/<html([^>]*?)lang="[^"]*"/, `<html$1lang="${locale}"`);
    }
    if (patched.includes('hrefLang="')) {
      patched = patched.replaceAll('hrefLang="', '\nhreflang="');
    }
    if (patched !== content) {
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
        let patched = content;
        if (content.includes('<html')) {
          patched = patched.replace(/<html([^>]*?)lang="[^"]*"/, `<html$1lang="${locale}"`);
        }
        if (patched.includes('hrefLang="')) {
          patched = patched.replaceAll('hrefLang="', '\nhreflang="');
        }
        if (patched !== content) {
          fs.writeFileSync(fullPath, patched, 'utf8');
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
  const adminShellPath = path.join(outDir, locale, 'league', '_shell', 'admin.html');
  if (!fs.existsSync(adminShellPath)) {
    throw new Error(`Missing expected hosting admin shell: ${adminShellPath}`);
  }
}
console.log('Verified all 130 client shells exist across 26 locales.');

// 5. Generate localized webmanifest for all 26 locales
for (const locale of locales) {
  const msgPath = path.join(webDir, `messages/${locale}.json`);
  let manifestDesc = 'Daily trivia with your friends';
  let shortcutPlay = "Play today's round";
  let shortcutLeagues = 'My leagues';
  if (fs.existsSync(msgPath)) {
    try {
      const msgs = JSON.parse(fs.readFileSync(msgPath, 'utf8'));
      if (msgs.manifest?.description) manifestDesc = msgs.manifest.description;
      if (msgs.manifest?.shortcutPlay) shortcutPlay = msgs.manifest.shortcutPlay;
      if (msgs.manifest?.shortcutLeagues) shortcutLeagues = msgs.manifest.shortcutLeagues;
    } catch {}
  }
  const manifestData = {
    name: 'RonDuel',
    short_name: 'RonDuel',
    description: manifestDesc,
    start_url: `/${locale}?source=pwa`,
    display: 'standalone',
    background_color: '#FFF7EC',
    theme_color: '#FF5A4E',
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/brand/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/brand/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      { src: '/brand/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/brand/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: shortcutPlay, short_name: 'Play', url: `/${locale}/play` },
      { name: shortcutLeagues, short_name: 'Leagues', url: `/${locale}/leagues` },
    ],
  };
  fs.writeFileSync(
    path.join(outDir, `manifest-${locale}.webmanifest`),
    JSON.stringify(manifestData, null, 2),
    'utf8',
  );
}
console.log('Generated localized webmanifests for all 26 locales.');

// 6. Generate root /legal and /l client redirect shells
const rootRedirectShell = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>RonDuel</title>
<script>
(function() {
  var supported = ["ro","en","es","pt","de","fr","it","nl","pl","bg","cs","da","el","et","fi","ga","hr","hu","lt","lv","mt","nb","sk","sl","sv","uk"];
  function detect() {
    try {
      var m = document.cookie.match(/(?:^|;\\s*)NEXT_LOCALE=([^;]+)/);
      if (m) {
        var c = decodeURIComponent(m[1]).trim().toLowerCase();
        if (c === 'no' || c === 'nn') c = 'nb';
        if (supported.indexOf(c) !== -1) return c;
      }
    } catch(e){}
    try {
      var s = localStorage.getItem('ronduel_locale');
      if (s) {
        var c2 = s.trim().toLowerCase();
        if (c2 === 'no' || c2 === 'nn') c2 = 'nb';
        if (supported.indexOf(c2) !== -1) return c2;
      }
    } catch(e){}
    var langs = navigator.languages || [navigator.language || 'en'];
    for (var i = 0; i < langs.length; i++) {
      var l = langs[i];
      if (!l) continue;
      var c3 = l.toLowerCase().split('-')[0];
      if (c3 === 'no' || c3 === 'nn') c3 = 'nb';
      if (supported.indexOf(c3) !== -1) return c3;
    }
    return 'en';
  }
  var loc = detect();
  var pathname = window.location.pathname;
  var target = '/' + loc + pathname + window.location.search + window.location.hash;
  window.location.replace(target);
})();
</script>
</head>
<body></body>
</html>`;

fs.mkdirSync(path.join(outDir, 'legal'), { recursive: true });
fs.writeFileSync(path.join(outDir, 'legal/_shell.html'), rootRedirectShell, 'utf8');
fs.mkdirSync(path.join(outDir, 'l'), { recursive: true });
fs.writeFileSync(path.join(outDir, 'l/_shell.html'), rootRedirectShell, 'utf8');
console.log('Generated root redirection shells for /legal and /l.');

// 7. Inject localized 404 client runtime into hosting-dist/404.html
const notFoundByLocale = {};
for (const locale of locales) {
  const msgPath = path.join(webDir, `messages/${locale}.json`);
  if (fs.existsSync(msgPath)) {
    try {
      const msgs = JSON.parse(fs.readFileSync(msgPath, 'utf8'));
      if (msgs.notFound) {
        notFoundByLocale[locale] = msgs.notFound;
      }
    } catch {}
  }
}

const notFoundPath = path.join(outDir, '404.html');
if (fs.existsSync(notFoundPath)) {
  let nfHtml = fs.readFileSync(notFoundPath, 'utf8');
  const b64Data = Buffer.from(JSON.stringify(notFoundByLocale)).toString('base64');
  const injectScript = `<script>
(function() {
  var b64 = '${b64Data}';
  var data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), function(c) { return c.charCodeAt(0); })));
  var seg = window.location.pathname.split('/').filter(Boolean)[0] || '';
  if (seg === 'no' || seg === 'nn') seg = 'nb';
  var loc = data[seg] ? seg : 'en';
  var t = data[loc] || data.en;
  if (!t) return;
  document.documentElement.lang = loc;
  document.title = t.title + ' — RonDuel';
  var codeEl = document.getElementById('nf-code');
  if (codeEl) codeEl.textContent = '404 · ' + t.code;
  var titleEl = document.getElementById('nf-title');
  if (titleEl) titleEl.textContent = t.title;
  var bodyEl = document.getElementById('nf-body');
  if (bodyEl) bodyEl.textContent = t.body;
  var btnEl = document.getElementById('nf-btn');
  if (btnEl) btnEl.textContent = t.backToToday;
  var linkEl = document.getElementById('nf-link');
  if (linkEl) linkEl.setAttribute('href', '/' + loc);
})();
</script>`;
  nfHtml = nfHtml.replace('</body>', `${injectScript}</body>`);
  fs.writeFileSync(notFoundPath, nfHtml, 'utf8');
  console.log('Injected 404 client localization script into hosting-dist/404.html.');
}

console.log('Packaged Firebase Hosting directory at hosting-dist/');
