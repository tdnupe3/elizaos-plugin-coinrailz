import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pluginDir = join(root, 'elizaos-plugin-coinrailz');
const packageJson = JSON.parse(await readFile(join(pluginDir, 'package.json'), 'utf8'));
const openApi = JSON.parse(await readFile(join(root, 'public/openapi-x402-services.json'), 'utf8'));
const workDir = await mkdtemp(join(tmpdir(), 'coinrailz-plugin-e2e-'));
const packDir = join(workDir, 'pack');
const consumerDir = join(workDir, 'consumer');
const bunConsumerDir = join(workDir, 'bun-consumer');
const supportedElizaCoreVersion = '2.0.3-beta.7';
const pinnedBunVersion = '1.3.14';

const run = (command, args, options = {}) =>
  execFileSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
    ...options,
  });

try {
  console.log(`Verifying ${packageJson.name}@${packageJson.version}`);

  run('npm', ['test'], { cwd: pluginDir });
  await rm(join(pluginDir, 'dist'), { recursive: true, force: true });
  run('npm', ['run', 'build'], { cwd: pluginDir });

  await mkdir(packDir, { recursive: true });
  const packOutput = run(
    'npm',
    ['pack', '--json', '--ignore-scripts', '--pack-destination', packDir],
    { cwd: pluginDir, capture: true }
  );
  const packed = JSON.parse(packOutput)[0];
  const tarball = join(packDir, packed.filename);
  const packedPaths = packed.files.map(file => file.path);

  for (const required of [
    'dist/index.js',
    'dist/index.d.ts',
    'dist/utils/x402Client.js',
    'dist/utils/x402Client.d.ts',
    'dist/version.js',
    'esm/index.mjs',
    'package.json',
  ]) {
    assert(packedPaths.includes(required), `Packed artifact is missing ${required}`);
  }
  assert(!packedPaths.some(path => path.startsWith('src/')), 'Packed artifact contains source files');
  assert(!packedPaths.some(path => path.startsWith('tests/')), 'Packed artifact contains tests');
  assert(!packedPaths.some(path => path.startsWith('scripts/')), 'Packed artifact contains release scripts');

  await mkdir(consumerDir, { recursive: true });
  await writeFile(
    join(consumerDir, 'package.json'),
    JSON.stringify({ name: 'coinrailz-plugin-e2e-consumer', private: true, type: 'module' }, null, 2)
  );
  run(
    'npm',
    ['install', tarball, '--omit=peer', '--ignore-scripts', '--legacy-peer-deps', '--no-audit', '--no-fund'],
    { cwd: consumerDir }
  );
  const corePackOutput = run(
    'npm',
    ['pack', '@elizaos/core@0.25.9', '--json', '--ignore-scripts', '--pack-destination', packDir],
    { cwd: consumerDir, capture: true }
  );
  const coreTarball = join(packDir, JSON.parse(corePackOutput)[0].filename);
  const coreDir = join(consumerDir, 'node_modules', '@elizaos', 'core');
  await mkdir(coreDir, { recursive: true });
  run('tar', ['-xzf', coreTarball, '--strip-components=1', '-C', coreDir], { cwd: consumerDir });

  await writeFile(
    join(consumerDir, 'consumer.ts'),
    [
      "import plugin, { coinrailzPlugin, X402Client, COIN_RAILZ_SERVICES } from 'elizaos-plugin-coinrailz';",
      "import type { PaymentRequest, PaymentResponse } from 'elizaos-plugin-coinrailz';",
      "import type { Plugin } from '@elizaos/core';",
      'const hostPlugin: Plugin = coinrailzPlugin;',
      'const client: X402Client = new X402Client();',
      "const request: PaymentRequest = { serviceId: 'ping', amount: '', payload: {} };",
      'const response: Promise<PaymentResponse> = client.callService(request);',
      'void plugin; void hostPlugin; void COIN_RAILZ_SERVICES; void response;',
    ].join('\n')
  );
  await writeFile(
    join(consumerDir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        target: 'ES2022',
        module: 'Node16',
        moduleResolution: 'Node16',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        skipLibCheck: true,
        noEmit: true,
      },
      include: ['consumer.ts'],
    }, null, 2)
  );
  run(
    process.execPath,
    [join(root, 'node_modules/typescript/bin/tsc'), '--project', 'tsconfig.json'],
    { cwd: consumerDir }
  );

  const requireFromConsumer = createRequire(join(consumerDir, 'consumer.cjs'));
  const installed = requireFromConsumer('elizaos-plugin-coinrailz');
  assert.equal(installed.default.name, 'coinrailz');
  assert.equal(typeof installed.X402Client, 'function');
  assert(Array.isArray(installed.COIN_RAILZ_SERVICES));

  const canonicalEndpoints = Object.keys(openApi.paths)
    .filter(path => path.startsWith('/x402/') && !path.includes('{'))
    .sort();
  const installedEndpoints = installed.COIN_RAILZ_SERVICES
    .map(service => service.endpoint)
    .sort();
  assert.deepEqual(installedEndpoints, canonicalEndpoints);

  const requests = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      requests.push({ method: req.method, url: req.url, headers: req.headers, body });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, path: req.url }));
    });
  });
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', resolveListen);
  });

  try {
    const address = server.address();
    assert(address && typeof address === 'object');
    const client = new installed.X402Client({
      apiKey: 'e2e-test-key',
      baseUrl: `http://127.0.0.1:${address.port}/`,
    });

    const missing = await client.callService({ payload: {}, amount: '' });
    const unknown = await client.callService({
      serviceId: 'not-a-real-service',
      payload: {},
      amount: '',
    });
    assert.equal(missing.success, false);
    assert.match(missing.error, /serviceId is required/);
    assert.equal(unknown.success, false);
    assert.match(unknown.error, /Unknown Coin Railz service/);
    assert.equal(requests.length, 0, 'Invalid IDs caused network activity');

    for (const service of installed.COIN_RAILZ_SERVICES) {
      const result = await client.callService({
        serviceId: service.id,
        payload: { e2e: service.id },
        amount: '',
      });
      assert.equal(result.success, true, `Installed client failed for ${service.id}`);
    }

    assert.equal(requests.length, canonicalEndpoints.length);
    assert(!requests.some(request => request.url.includes('undefined')));
    assert.deepEqual(
      requests.map(request => request.url).sort(),
      canonicalEndpoints
    );
    assert(requests.every(request => request.method === 'POST'));
    assert(requests.every(
      request => request.headers['user-agent'] === `${packageJson.name}/${packageJson.version}`
    ));
  } finally {
    await new Promise(resolveClose => server.close(resolveClose));
  }

  const installedManifest = JSON.parse(
    await readFile(join(consumerDir, 'node_modules', packageJson.name, 'package.json'), 'utf8')
  );
  assert.equal(installedManifest.version, packageJson.version);
  assert.equal(installedManifest.exports['.'].import, './esm/index.mjs');
  assert.equal(installedManifest.exports['.'].require, './dist/index.js');
  assert.match(
    installedManifest.peerDependencies['@elizaos/core'],
    /\^2\.0\.3-beta\.7/,
    'ElizaOS v2 registry claim is not reflected in the package peer range'
  );

  await writeFile(
    join(consumerDir, 'native-esm-check.mjs'),
    [
      "import plugin, { coinrailzPlugin, X402Client } from 'elizaos-plugin-coinrailz';",
      "if (plugin !== coinrailzPlugin) throw new Error('Default and named plugin exports differ');",
      "if (plugin.name !== 'coinrailz') throw new Error('Native ESM default export is not the plugin');",
      "if (!Array.isArray(plugin.actions) || plugin.actions.length === 0) throw new Error('Plugin actions missing');",
      "if (typeof X402Client !== 'function') throw new Error('Native ESM X402Client export missing');",
    ].join('\n')
  );
  await import(new URL(`file://${join(consumerDir, 'native-esm-check.mjs')}`));

  await mkdir(bunConsumerDir, { recursive: true });
  await writeFile(
    join(bunConsumerDir, 'package.json'),
    JSON.stringify({
      name: 'coinrailz-plugin-bun-loader-consumer',
      private: true,
      type: 'module',
      dependencies: {
        '@elizaos/core': supportedElizaCoreVersion,
        [packageJson.name]: `file:${tarball}`,
      },
    }, null, 2)
  );
  run(
    'npx',
    ['-y', `bun@${pinnedBunVersion}`, 'install', '--no-save'],
    { cwd: bunConsumerDir }
  );
  await writeFile(
    join(bunConsumerDir, 'loader-check.ts'),
    [
      `import * as pluginModule from '${packageJson.name}';`,
      "import { loadPlugin } from '@elizaos/core';",
      'if (Bun.version !== "1.3.14") throw new Error(`Unexpected Bun version: ${Bun.version}`);',
      'if (!pluginModule.default) throw new Error("Published ESM default export is undefined");',
      'if (pluginModule.default !== pluginModule.coinrailzPlugin) throw new Error("Default and named exports differ");',
      'const loaded = await loadPlugin(pluginModule.default);',
      'if (!loaded) throw new Error("ElizaOS loadPlugin rejected the plugin");',
      'if (loaded.name !== "coinrailz") throw new Error(`Unexpected loaded plugin: ${loaded.name}`);',
      'if (!Array.isArray(loaded.actions) || loaded.actions.length === 0) throw new Error("Loaded plugin actions missing");',
      'console.log(`Bun ${Bun.version} ElizaOS loader accepted ${loaded.name}`);',
    ].join('\n')
  );
  run(
    'npx',
    ['-y', `bun@${pinnedBunVersion}`, 'run', 'loader-check.ts'],
    { cwd: bunConsumerDir }
  );
  console.log(`Packed-package E2E passed for ${canonicalEndpoints.length} canonical services.`);
} finally {
  await rm(workDir, { recursive: true, force: true });
}