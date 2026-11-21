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
console.log('Packaged Firebase Hosting directory at hosting-dist/');
