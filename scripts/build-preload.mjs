import { build } from 'esbuild';

await build({
  entryPoints: ['electron/preload.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: 'dist-electron/preload.js',
  external: ['electron'],
});

console.log('Preload bundled to dist-electron/preload.js');
