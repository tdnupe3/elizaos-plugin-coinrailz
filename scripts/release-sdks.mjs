/**
 * SDK Release Script — publishes all updated Coin Railz npm packages.
 * Run via: node scripts/release-sdks.mjs [package-name]
 * If no arg, publishes all packages.
 * Uses --ignore-scripts because dist/ is already built (description-only changes).
 */
import { execSync } from 'child_process';
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

const target = process.argv[2]; // optional: only publish one
const toPublish = target ? PACKAGES.filter(p => p.name === target) : PACKAGES;

if (toPublish.length === 0) {
  console.error(`No package found matching "${target}"`);
  process.exit(1);
}

for (const pkg of toPublish) {
  console.log(`\n📦 Publishing ${pkg.name} from ${pkg.dir}...`);
  try {
    execSync(
      `npm publish --ignore-scripts --access ${pkg.access} --registry https://registry.npmjs.org`,
      {
        cwd: pkg.dir,
        stdio: 'inherit',
        env: {
          ...process.env,
          // NPM_TOKEN is already in env via Replit secrets
        },
      }
    );
    console.log(`✅ ${pkg.name} published successfully.`);
  } catch (err) {
    console.error(`❌ Failed to publish ${pkg.name}:`, err.message);
    process.exit(1);
  }
}

console.log('\n🎉 All packages published!');
