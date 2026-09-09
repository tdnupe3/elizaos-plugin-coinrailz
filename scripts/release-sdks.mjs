/**
 * SDK Release Script — publishes all updated Coin Railz npm packages.
 * Run via: node scripts/release-sdks.mjs <package-name>
 * A package name is mandatory to prevent accidental multi-package releases.
 *
 * Each package is built from source immediately before publishing so that
 * the dist/ directory is always fresh. This prevents stale type declarations
 * or outdated compiled output from reaching npm even if dist/ was already
 * present from a prior build.
 */
import { execSync, spawnSync } from 'child_process';
import { readFileSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const PACKAGES = [
  {
    name: 'coinrailz',
    dir: resolve(root, 'sdk/typescript/coinrailz-sdk'),
    access: 'public',
  },
  {
    name: '@coinrailz/agent-payments',
    dir: resolve(root, 'packages/agent-payments-npm'),
    access: 'public',
  },
  {
    name: 'elizaos-plugin-coinrailz',
    dir: resolve(root, 'elizaos-plugin-coinrailz'),
    access: 'public',
  },
];

const target = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
if (!target) {
  console.error('Refusing an untargeted release. Pass one package name explicitly.');
  process.exit(1);
}
const toPublish = PACKAGES.filter(p => p.name === target);

if (toPublish.length === 0) {
  console.error(`No package found matching "${target}"`);
  process.exit(1);
}

for (const pkg of toPublish) {
  const manifest = JSON.parse(readFileSync(resolve(pkg.dir, 'package.json'), 'utf8'));
  const registryCheck = spawnSync(
    'npm',
    ['view', `${pkg.name}@${manifest.version}`, 'version', '--registry', 'https://registry.npmjs.org'],
    { cwd: pkg.dir, encoding: 'utf8' }
  );
  if (registryCheck.status === 0) {
    console.error(`❌ ${pkg.name}@${manifest.version} already exists on npm. Bump the version first.`);
    process.exit(1);
  }
  const registryError = `${registryCheck.stdout ?? ''}\n${registryCheck.stderr ?? ''}`;
  if (!/\bE404\b|404 Not Found/i.test(registryError)) {
    console.error(`❌ Could not safely verify whether ${pkg.name}@${manifest.version} exists on npm.`);
    console.error(registryError.trim());
    process.exit(1);
  }

  console.log(`\n🔨 Building ${pkg.name} from source...`);
  try {
    if (pkg.name === 'elizaos-plugin-coinrailz') {
      execSync('node scripts/verify-elizaos-plugin-package.mjs', {
        cwd: root,
        stdio: 'inherit',
      });
    } else {
      rmSync(resolve(pkg.dir, 'dist'), { recursive: true, force: true });
      if (manifest.scripts?.test) {
        execSync('npm test', { cwd: pkg.dir, stdio: 'inherit' });
      }
      execSync('npm run build', { cwd: pkg.dir, stdio: 'inherit' });
    }
    console.log(`✅ ${pkg.name} built successfully.`);
  } catch (err) {
    console.error(`❌ Build failed for ${pkg.name}:`, err.message);
    process.exit(1);
  }

  console.log(`\n📦 Publishing ${pkg.name} from ${pkg.dir}...`);
  try {
    execSync(
      // --ignore-scripts: skip lifecycle hooks — we already ran build above
      `npm publish ${dryRun ? '--dry-run ' : ''}--ignore-scripts --access ${pkg.access} --registry https://registry.npmjs.org`,
      {
        cwd: pkg.dir,
        stdio: 'inherit',
        env: {
          ...process.env,
          // NPM_TOKEN is already in env via Replit secrets
        },
      }
    );
    console.log(`✅ ${pkg.name} ${dryRun ? 'release dry-run' : 'published'} successfully.`);
  } catch (err) {
    console.error(`❌ Failed to publish ${pkg.name}:`, err.message);
    process.exit(1);
  }
}

console.log(`\n🎉 Targeted package ${dryRun ? 'release dry-run completed' : 'published'}!`);
