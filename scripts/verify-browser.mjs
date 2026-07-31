import { createServer } from 'node:http';
import { readFile, rm, stat, mkdtemp } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, extname, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const productionRoot = resolve(projectRoot, 'dist');
const temporaryRoot = await mkdtemp(join(tmpdir(), 'lorewell-browser-'));

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.wasm', 'application/wasm'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
]);

const chromeCandidates = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

async function firstExisting(paths) {
  for (const path of paths) {
    if (!isAbsolute(path)) continue;
    try {
      const info = await stat(path);
      if (info.isFile()) return path;
    } catch (_) {}
  }
  return null;
}

function safePath(root, pathname) {
  const relative = decodeURIComponent(pathname).replace(/^\/+/, '');
  const candidate = resolve(root, relative || 'index.html');
  if (candidate !== root && !candidate.startsWith(root + sep)) return null;
  return candidate;
}

async function requestPath(url) {
  const pathname = new URL(url, 'http://127.0.0.1').pathname;
  const root = pathname.startsWith('/test/') ? projectRoot : productionRoot;
  let path = safePath(root, pathname);
  if (!path) return null;
  try {
    const info = await stat(path);
    if (info.isDirectory()) path = join(path, 'index.html');
    return path;
  } catch (_) {
    return null;
  }
}

const server = createServer(async (request, response) => {
  try {
    const path = await requestPath(request.url || '/');
    if (!path) {
      response.writeHead(404, { 'content-type':'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    const body = await readFile(path);
    response.writeHead(200, {
      'cache-control':'no-store',
      'content-type':mimeTypes.get(extname(path).toLowerCase()) || 'application/octet-stream',
    });
    response.end(body);
  } catch (error) {
    response.writeHead(500, { 'content-type':'text/plain; charset=utf-8' });
    response.end(String(error?.message || error));
  }
});

function listen() {
  return new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', () => resolveListen(server.address()));
  });
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function devtoolsSocket(profilePath, child) {
  const activePortPath = join(profilePath, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode != null) {
      throw new Error('Chrome exited before opening its developer endpoint.');
    }
    try {
      const [port, path] = (await readFile(activePortPath, 'utf8')).trim().split('\n');
      if (port && path) return 'ws://127.0.0.1:' + port + path;
    } catch (_) {}
    await delay(100);
  }
  throw new Error('Chrome did not open its developer endpoint within 10 seconds.');
}

function connectCdp(socketUrl) {
  return new Promise((resolveConnect, rejectConnect) => {
    const socket = new WebSocket(socketUrl);
    const timeout = setTimeout(
      () => rejectConnect(new Error('Chrome protocol connection timed out.')),
      10000,
    );
    socket.addEventListener('open', () => {
      clearTimeout(timeout);
      let nextId = 0;
      const pending = new Map();
      const observed = [];
      socket.addEventListener('message', (event) => {
        const message = JSON.parse(String(event.data));
        if (message.id && pending.has(message.id)) {
          const request = pending.get(message.id);
          pending.delete(message.id);
          if (message.error) request.reject(new Error(message.error.message));
          else request.resolve(message.result);
          return;
        }
        if (
          message.method === 'Runtime.exceptionThrown'
          || message.method === 'Log.entryAdded'
          || message.method === 'Network.loadingFailed'
          || (
            message.method === 'Network.responseReceived'
            && Number(message.params?.response?.status) >= 400
          )
        ) observed.push(message);
      });
      socket.addEventListener('close', () => {
        for (const request of pending.values()) {
          request.reject(new Error('Chrome protocol connection closed.'));
        }
        pending.clear();
      });
      resolveConnect({
        observed,
        send(method, params = {}, sessionId = null) {
          return new Promise((resolveSend, rejectSend) => {
            const id = ++nextId;
            pending.set(id, { resolve:resolveSend, reject:rejectSend });
            socket.send(JSON.stringify({
              id,
              method,
              params,
              ...(sessionId ? { sessionId } : {}),
            }));
          });
        },
        close() { socket.close(); },
      });
    });
    socket.addEventListener('error', () => {
      clearTimeout(timeout);
      rejectConnect(new Error('Chrome protocol connection failed.'));
    });
  });
}

function observedSummary(messages) {
  return messages.map((message) => {
    if (message.method === 'Runtime.exceptionThrown') {
      return message.params?.exceptionDetails?.exception?.description
        || message.params?.exceptionDetails?.text
        || 'Uncaught browser exception';
    }
    if (message.method === 'Log.entryAdded') {
      return message.params?.entry?.text || 'Browser log error';
    }
    if (message.method === 'Network.loadingFailed') {
      return 'Request failed: ' + (message.params?.errorText || 'unknown network error');
    }
    const response = message.params?.response;
    return 'HTTP ' + response?.status + ': ' + response?.url;
  });
}

async function runChrome(chromePath, url, profilePath) {
  const child = spawn(chromePath, [
    '--headless=new',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-sync',
    '--metrics-recording-only',
    '--mute-audio',
    '--no-default-browser-check',
    '--no-first-run',
    '--remote-debugging-port=0',
    '--user-data-dir=' + profilePath,
    'about:blank',
  ], { stdio:['ignore', 'ignore', 'pipe'] });
  let diagnostics = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => { diagnostics += chunk; });
  let cdp = null;
  try {
    cdp = await connectCdp(await devtoolsSocket(profilePath, child));
    const target = await cdp.send('Target.createTarget', { url:'about:blank' });
    const attached = await cdp.send('Target.attachToTarget', {
      targetId:target.targetId,
      flatten:true,
    });
    const sessionId = attached.sessionId;
    await Promise.all([
      cdp.send('Runtime.enable', {}, sessionId),
      cdp.send('Page.enable', {}, sessionId),
      cdp.send('Log.enable', {}, sessionId),
      cdp.send('Network.enable', {}, sessionId),
    ]);
    await cdp.send('Page.navigate', { url }, sessionId);
    const started = Date.now();
    while (Date.now() - started < 120000) {
      const evaluated = await cdp.send('Runtime.evaluate', {
        expression:`(() => {
          const node = document.getElementById('harness-status');
          return node ? { state:node.dataset.state || '', text:node.textContent || '' } : null;
        })()`,
        returnByValue:true,
      }, sessionId);
      const result = evaluated?.result?.value;
      if (result?.state === 'pass' || result?.state === 'fail') {
        return {
          state:result.state,
          status:String(result.text || '').trim(),
          observed:observedSummary(cdp.observed),
        };
      }
      await delay(250);
    }
    throw new Error(
      'Chrome did not finish the browser verification within 120 seconds.\n'
      + diagnostics.trim().slice(-2000),
    );
  } finally {
    try { await cdp?.send('Browser.close'); } catch (_) {}
    cdp?.close();
    if (child.exitCode == null) child.kill('SIGKILL');
  }
}

async function verifyJourney(chromePath, origin, {
  label,
  query,
  expected,
}) {
  const profile = await mkdtemp(join(temporaryRoot, label + '-'));
  const url = origin + '/test/host-harness.html?' + query + '&autorun=1';
  const result = await runChrome(chromePath, url, profile);
  if (result.state !== 'pass') {
    throw new Error(label + ' failed: ' + (result.status || 'the harness did not report a result'));
  }
  if (!result.status.includes(expected)) {
    throw new Error(label + ' returned an unexpected result: ' + result.status);
  }
  if (result.observed.length) {
    throw new Error(
      label + ' reported browser errors:\n- ' + result.observed.join('\n- '),
    );
  }
  console.log('PASS ' + label + ' — ' + result.status.replace(/^PASS ·\s*/, ''));
}

try {
  await stat(join(productionRoot, 'index.html'));
  const chromePath = await firstExisting(chromeCandidates);
  if (!chromePath) {
    throw new Error(
      'Chrome or Chromium was not found. Set CHROME_PATH to an absolute browser executable path.',
    );
  }
  const address = await listen();
  const origin = 'http://127.0.0.1:' + address.port;
  await verifyJourney(chromePath, origin, {
    label:'hosted-library',
    query:'walkthrough=hosted',
    expected:'semantic reading, smart views, enrichment, grouping, cited Ask, portability, recovery, and rebuild',
  });
  await verifyJourney(chromePath, origin, {
    label:'large-library',
    query:'scale=1',
    expected:'60-work organization, deterministic facets, and title discovery',
  });
} finally {
  await new Promise((resolveClose) => server.close(() => resolveClose()));
  await rm(temporaryRoot, { recursive:true, force:true });
}
