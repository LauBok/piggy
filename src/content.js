// Game content (everything in src/renderer) can be updated without reinstalling the app.
// Each GitHub Release also carries content.json (all renderer files) and content.json.sig, an
// Ed25519 signature made with a key only the release workflow has. The app checks the signature
// with the public key below, keeps the newest valid bundle in userData/content, and serves it to
// the windows through the piggy:// protocol. Without a newer bundle it serves the built-in files.
//
// Bundles name the shell API they need (package.json "piggy.shellApi"). Bump it whenever main.js,
// preload.js or anything else outside src/renderer changes in a way the renderer depends on:
// apps with another shell API ignore the bundle and wait for a full update.

const { app, protocol, net } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const pkg = require('../package.json');
const SHELL_API = pkg.piggy.shellApi;
const BUILT_IN = path.join(__dirname, 'renderer');
const BUILT_IN_VERSION = pkg.version;
// PIGGY_CONTENT_FEED points a dev build at a local feed for testing; bundles still need a valid signature
const FEED = process.env.PIGGY_CONTENT_FEED || 'https://github.com/LauBok/piggy/releases/latest/download/';
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAqjLmWy1cylZAaAUpxWdllrAqTG1ImEKTZVniFtTvd/M=
-----END PUBLIC KEY-----
`;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const enabled = () => app.isPackaged || !!process.env.PIGGY_CONTENT_FEED;
const dir = () => path.join(app.getPath('userData'), 'content');
const file = (name) => path.join(dir(), name);

let active = null; // bundle being served: { version, shellApi, files }
let pending = null; // newer verified bundle waiting for apply()

function newer(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  return false;
}

// The bundle if the signature and shell API check out, otherwise null
function verify(json, sig) {
  try {
    if (!crypto.verify(null, Buffer.from(json), PUBLIC_KEY, Buffer.from(sig.trim(), 'base64'))) return null;
    const bundle = JSON.parse(json);
    return bundle.shellApi === SHELL_API && bundle.files && typeof bundle.version === 'string' ? bundle : null;
  } catch {
    return null;
  }
}

const badVersions = () => {
  try {
    return JSON.parse(fs.readFileSync(file('bad.json'), 'utf8'));
  } catch {
    return [];
  }
};

// The saved bundle, if it is valid, newer than the built-in content and not known to be broken
function loadSaved() {
  try {
    const bundle = verify(fs.readFileSync(file('content.json'), 'utf8'), fs.readFileSync(file('content.json.sig'), 'utf8'));
    if (bundle && newer(bundle.version, BUILT_IN_VERSION) && !badVersions().includes(bundle.version)) return bundle;
  } catch {
    // nothing saved yet
  }
  return null;
}

// Must run before the app is ready
function registerScheme() {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'piggy', privileges: { standard: true, secure: true, supportFetchAPI: true } },
  ]);
}

// Serves piggy://app/<file> from the active bundle, or from the built-in files when there is none
function serve() {
  if (enabled()) active = loadSaved();
  protocol.handle('piggy', (req) => {
    const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '');
    let body;
    if (active) {
      body = active.files[rel];
    } else {
      const full = path.normalize(path.join(BUILT_IN, rel));
      if (full.startsWith(BUILT_IN + path.sep) && fs.existsSync(full)) body = fs.readFileSync(full);
    }
    if (body === undefined) return new Response('not found', { status: 404 });
    return new Response(body, { headers: { 'content-type': MIME[path.extname(rel)] || 'application/octet-stream' } });
  });
}

const version = () => active?.version || BUILT_IN_VERSION;

// Downloads and verifies the latest bundle; calls onReady(version) when a newer one is saved
async function check(onReady) {
  if (!enabled()) return;
  try {
    const get = async (name) => {
      const res = await net.fetch(FEED + name, { cache: 'no-store' });
      if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
      return res.text();
    };
    const [json, sig] = await Promise.all([get('content.json'), get('content.json.sig')]);
    const bundle = verify(json, sig);
    if (!bundle || !newer(bundle.version, version()) || badVersions().includes(bundle.version)) return;
    if (pending && !newer(bundle.version, pending.version)) return;
    fs.mkdirSync(dir(), { recursive: true });
    fs.writeFileSync(file('content.json'), json);
    fs.writeFileSync(file('content.json.sig'), sig);
    pending = bundle;
    onReady(bundle.version);
  } catch (err) {
    console.log('content update check failed:', err.message);
  }
}

// Switches to the downloaded bundle; the caller reloads the windows
function apply() {
  if (!pending) return false;
  active = pending;
  pending = null;
  return true;
}

// If the pet hasn't started a little while after loading downloaded content, that bundle is broken:
// remember it, go back to the built-in files and call onFail so the windows reload
function watchHealth(win, onFail) {
  if (!active) return;
  const v = active.version;
  setTimeout(async () => {
    if (active?.version !== v || win.isDestroyed()) return;
    const ok = await win.webContents.executeJavaScript('typeof App === "object" && typeof Game === "object"').catch(() => false);
    if (ok) return;
    console.log(`content ${v} failed to start, going back to the built-in version`);
    fs.mkdirSync(dir(), { recursive: true });
    fs.writeFileSync(file('bad.json'), JSON.stringify([...badVersions(), v]));
    active = null;
    onFail();
  }, 8000);
}

module.exports = { registerScheme, serve, check, apply, version, watchHealth, newer };
