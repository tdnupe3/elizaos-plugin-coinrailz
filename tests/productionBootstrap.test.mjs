import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

async function freePort() {
  const server = http.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
}

function request(port, headers = {}) {
  return new Promise((resolve, reject) => {
    http.get({ port, host: '127.0.0.1', path: '/echo', headers }, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body }));
    }).on('error', reject);
  });
}

test('bootstrap replaces spoofed X-Forwarded-For with one ingress address', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'bootstrap-test-'));
  const childFile = path.join(directory, 'child.mjs');
  await fs.writeFile(childFile, `
    import http from 'node:http';
    http.createServer((req, res) => {
      if (req.url === '/readyz') return res.end('ready');
      res.end(req.headers['x-forwarded-for'] || '');
    }).listen(Number(process.env.PORT), '127.0.0.1');
  `);
  const port = await freePort();
  const startedAt = Date.now();
  const child = spawn(process.execPath, ['server/productionBootstrap.mjs'], {
    env: { ...process.env, PORT: String(port), INTERNAL_APP_PORT: String(port + 1), CHILD_READY_TIMEOUT_MS: '2000', PRODUCTION_CHILD_ENTRYPOINT: childFile },
    stdio: 'ignore',
  });
  try {
    await new Promise(resolve => setTimeout(resolve, 1_200));
    const response = await request(port, { 'X-Forwarded-For': '198.51.100.7, 203.0.113.9' });
    assert.equal(response.status, 200);
    assert.equal(response.body, '203.0.113.9');
    assert.ok(Date.now() - startedAt < 2_000, 'ready proxy became available before its deadline');
    const health = await request(port);
    assert.equal(health.status, 200, '/healthz remains proxied successfully after readiness');
  } finally {
    child.kill('SIGTERM');
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('bootstrap exits when its child misses configured readiness deadline', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'bootstrap-timeout-'));
  const childFile = path.join(directory, 'child.mjs');
  await fs.writeFile(childFile, 'setInterval(() => {}, 1000);');
  const port = await freePort();
  const bootstrap = spawn(process.execPath, ['server/productionBootstrap.mjs'], {
    env: { ...process.env, PORT: String(port), INTERNAL_APP_PORT: String(port + 1), CHILD_READY_TIMEOUT_MS: '150', PRODUCTION_CHILD_ENTRYPOINT: childFile },
    stdio: 'ignore',
  });
  try {
    const [code] = await once(bootstrap, 'exit');
    assert.equal(code, 1);
  } finally {
    bootstrap.kill('SIGKILL');
    await fs.rm(directory, { recursive: true, force: true });
  }
});