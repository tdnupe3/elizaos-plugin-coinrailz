import { build } from 'esbuild';

// Build index.ts (tiny entry point - ~3KB)
// The dynamic import('./appMain.js') stays as runtime import
await build({
  entryPoints: ['server/index.ts'],
  platform: 'node',
  packages: 'external',
  bundle: true,
  format: 'esm',
  outdir: 'dist',
});

// Build appMain.ts (heavy modules - separate file)
// This gets loaded AFTER health checks are responding
await build({
  entryPoints: ['server/appMain.ts'],
  platform: 'node',
  packages: 'external',
  bundle: true,
  format: 'esm',
  outdir: 'dist',
});

console.log('✅ Server build complete: dist/index.js (~3KB) + dist/appMain.js (~6MB)');
