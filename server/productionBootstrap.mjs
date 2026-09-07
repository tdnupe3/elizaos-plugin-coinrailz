import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';

const publicPort = Number.parseInt(process.env.PORT || '5000', 10);
const internalPort = Number.parseInt(process.env.INTERNAL_APP_PORT || String(publicPort + 1), 10);
const internalHost = '127.0.0.1';
let childReady = false;
let shuttingDown = false;

const child = spawn(process.execPath, ['dist/index.js'], {
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(internalPort),
  },
  stdio: 'inherit',
});

function sendStarting(res, statusCode = 503) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    ...(statusCode === 503 ? { 'Retry-After': '5' } : {}),
  });
  res.end(JSON.stringify({
    status: statusCode === 200 ? 'ok' : 'starting',
    ready: false,
    service: 'Coin Railz',
  }));
}

function proxyHttp(req, res) {
  const upstream = http.request({
    hostname: internalHost,
    port: internalPort,
    method: req.method,
    path: req.url,
    headers: {
      ...req.headers,
      'x-forwarded-host': req.headers.host || '',
      'x-forwarded-proto': req.headers['x-forwarded-proto'] || 'https',
    },
  }, (upstreamRes) => {
    res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
    upstreamRes.pipe(res);
  });

  upstream.on('error', () => {
    childReady = false;
    if (!res.headersSent) sendStarting(res);
    else res.destroy();
  });
  req.pipe(upstream);
}

const server = http.createServer((req, res) => {
  if (childReady) {
    proxyHttp(req, res);
    return;
  }

  const path = (req.url || '/').split('?')[0];
  if (path === '/' || path === '/healthz') {
    sendStarting(res, 200);
    return;
  }
  sendStarting(res);
});

server.on('upgrade', (req, socket, head) => {
  if (!childReady) {
    socket.end('HTTP/1.1 503 Service Unavailable\r\nRetry-After: 5\r\nConnection: close\r\n\r\n');
    return;
  }

  const upstream = net.connect(internalPort, internalHost, () => {
    let request = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`;
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      request += `${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`;
    }
    request += '\r\n';
    upstream.write(request);
    if (head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });

  upstream.on('error', () => {
    childReady = false;
    socket.destroy();
  });
  socket.on('error', () => upstream.destroy());
});

server.listen(publicPort, '0.0.0.0', () => {
  console.log(`🚀 Production bootstrap listening on ${publicPort}; app starting on ${internalPort}`);
});

const readinessTimer = setInterval(() => {
  const probe = http.get({
    hostname: internalHost,
    port: internalPort,
    path: '/readyz',
    timeout: 2000,
  }, (response) => {
    response.resume();
    if (response.statusCode === 200 && !childReady) {
      childReady = true;
      console.log('✅ Production child is ready; bootstrap proxy enabled');
    }
  });
  probe.on('timeout', () => probe.destroy());
  probe.on('error', () => undefined);
}, 1000);
readinessTimer.unref();

child.on('exit', (code, signal) => {
  childReady = false;
  if (shuttingDown) return;
  console.error(`❌ Production child exited (code=${code}, signal=${signal}); exiting bootstrap`);
  server.close(() => process.exit(code || 1));
  setTimeout(() => process.exit(code || 1), 2000).unref();
});

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(readinessTimer);
  child.kill(signal);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));