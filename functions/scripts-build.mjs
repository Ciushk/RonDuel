import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: 'lib/index.js',
  sourcemap: true,
  external: ['firebase-admin', 'firebase-functions', 'firebase-functions/*'],
});
