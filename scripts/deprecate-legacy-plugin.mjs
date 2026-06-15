import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';

const token = process.env.NPM_TOKEN;
if (!token) { console.error('NPM_TOKEN not set'); process.exit(1); }

const npmrcPath = homedir() + '/.npmrc';
const existing = existsSync(npmrcPath) ? readFileSync(npmrcPath, 'utf8') : '';
if (!existing.includes('_authToken')) {
  writeFileSync(npmrcPath, existing + '\n//registry.npmjs.org/:_authToken=' + token + '\n');
}

const msg = 'Deprecated: use elizaos-plugin-coinrailz instead — includes Yield-While-Trading, 66 x402 services, and active ElizaOS maintainer support.';
execSync(`npm deprecate plugin-coinrailz "${msg}" --registry https://registry.npmjs.org`, { stdio: 'inherit' });
console.log('plugin-coinrailz deprecated successfully.');
