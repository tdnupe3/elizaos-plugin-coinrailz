import { execSync, spawnSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
console.log(`Releasing ${pkg.name}@${pkg.version}...`);

const npmBin = '/nix/store/1lagpgadaybvs1n2312gysg2phjk89y8-nodejs-20.20.0-wrapped/bin/npm';
const token = process.env.NPM_TOKEN;

if (!token) {
  console.error('NPM_TOKEN not set');
  process.exit(1);
}

// Write .npmrc with auth token
const npmrcPath = join(homedir(), '.npmrc');
const authLine = `//registry.npmjs.org/:_authToken=${token}`;
try {
  const existing = readFileSync(npmrcPath, 'utf8');
  if (!existing.includes('_authToken')) {
    writeFileSync(npmrcPath, existing + '\n' + authLine + '\n');
  }
} catch {
  writeFileSync(npmrcPath, authLine + '\n');
}
console.log('.npmrc auth configured');

// Run publish (prepublishOnly runs build+test automatically)
const result = spawnSync(
  npmBin,
  ['publish', '--access', 'public', '--registry', 'https://registry.npmjs.org'],
  {
  encoding: 'utf8',
  stdio: 'pipe',
  env: { ...process.env }
  }
);

if (result.stdout) console.log(result.stdout);
if (result.stderr) console.error(result.stderr);

if (result.status !== 0) {
  console.error('Publish failed with exit code:', result.status);
  process.exit(result.status);
} else {
  console.log(`\n✅ ${pkg.name}@${pkg.version} published successfully!`);
}
