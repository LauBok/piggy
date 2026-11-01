// Packs everything in src/renderer into one signed content bundle, which installed apps
// download to update the game without a reinstall (see src/content.js).
//
//   node scripts/build-content.js [--version 1.2.3] [--key path/to/private.pem] [--out dir]
//
// The Ed25519 private key comes from --key, or the CONTENT_SIGNING_KEY environment variable (PEM).
// Writes <out>/content.json and <out>/content.json.sig (base64 signature of the exact JSON bytes).

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

const keyPem = arg('key') ? fs.readFileSync(arg('key'), 'utf8') : process.env.CONTENT_SIGNING_KEY;
if (!keyPem) {
  console.error('No signing key: pass --key <file> or set CONTENT_SIGNING_KEY');
  process.exit(1);
}

const srcDir = path.join(root, 'src', 'renderer');
const files = {};
for (const name of fs.readdirSync(srcDir, { recursive: true })) {
  const full = path.join(srcDir, name);
  if (fs.statSync(full).isFile()) files[name.split(path.sep).join('/')] = fs.readFileSync(full, 'utf8');
}

const bundle = { version: arg('version') || pkg.version, shellApi: pkg.piggy.shellApi, files };
const json = JSON.stringify(bundle);
const sig = crypto.sign(null, Buffer.from(json), keyPem).toString('base64');

const out = arg('out') || path.join(root, 'dist', 'content');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'content.json'), json);
fs.writeFileSync(path.join(out, 'content.json.sig'), sig);
console.log(`content ${bundle.version} (shell API ${bundle.shellApi}): ${Object.keys(files).length} files, ${(json.length / 1024).toFixed(0)} KB -> ${out}`);
