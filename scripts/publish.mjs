// Publish: build -> test -> encrypt (pagecrypt) -> decrypt-verify -> commit + push docs/index.html
//   node scripts/publish.mjs          full publish
//   node scripts/publish.mjs --dry    everything except commit/push
//   HUB_CONTENT_DIR=<dir>             read hub.json/sources.json from <dir> instead of content/
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { webcrypto as crypto } from 'node:crypto';
import { encryptHTML } from 'pagecrypt';
import { buildFromContent } from '../src/build.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry');
const ITERATIONS = 2_000_000;
const CONTENT_DIR = process.env.HUB_CONTENT_DIR ? resolve(process.env.HUB_CONTENT_DIR) : resolve(ROOT, 'content');
// git via execFileSync: args go through argv, never a shell, so multi-line commit
// messages and paths survive intact (Windows execSync runs cmd.exe and mangles them).
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const fail = (msg) => { console.error(`PUBLISH ABORTED: ${msg}`); process.exit(1); };

// 1. Working tree must be clean apart from docs/ (content/ and dist/ are gitignored).
const dirty = git('status', '--porcelain').split('\n').filter(Boolean).filter(l => !l.slice(3).startsWith('docs/'));
if (dirty.length) fail(`uncommitted changes outside docs/:\n${dirty.join('\n')}\nCommit source first so the published page matches a real commit.`);

// 2. Build and test.
console.log('building…');
const built = buildFromContent(CONTENT_DIR);
console.log('testing…');
execFileSync('node', ['--test'], { cwd: ROOT, stdio: 'inherit' });

// 3. Encrypt with the fixed hub password.
const hub = JSON.parse(readFileSync(resolve(CONTENT_DIR, 'hub.json'), 'utf8'));
const plain = readFileSync(built, 'utf8');
console.log('encrypting…');
const encrypted = await encryptHTML(plain, hub.hubPassword, ITERATIONS);
mkdirSync(resolve(ROOT, 'docs'), { recursive: true });
writeFileSync(resolve(ROOT, 'docs/index.html'), encrypted);

// 4. Decrypt-verify with WebCrypto (same layout pagecrypt's loader expects: salt|iv|ciphertext, base64 in <pre data-i>).
const m = encrypted.match(/<pre[^>]*data-i="([^"]+)"[^>]*>([^<]+)<\/pre>/);
if (!m) fail('no encrypted payload found in docs/index.html');
const bytes = Uint8Array.from(Buffer.from(m[2], 'base64'));
const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(hub.hubPassword), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt: bytes.slice(0, 32), iterations: Number(m[1]), hash: 'SHA-256' },
  keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
const decrypted = new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(32, 48) }, key, bytes.slice(48)));
if (!decrypted.includes(`<title>${hub.title}</title>`) || decrypted.length < plain.length * 0.95) fail('decrypt verify failed');
if (encrypted.includes(hub.hubPassword)) fail('hub password found in encrypted output');
console.log(`decrypt verify PASS (${decrypted.length.toLocaleString()} bytes)`);

if (DRY) { console.log('--dry: skipping commit/push'); process.exit(0); }

// 5. Commit and push.
git('add', 'docs/index.html');
if (!git('status', '--porcelain', '--', 'docs/index.html')) { console.log('nothing to publish — docs/index.html unchanged'); process.exit(0); }
const date = new Date().toISOString().slice(0, 10);
git('commit', '-m', `Publish hub ${date}\n\nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`);
git('push');
console.log('published + pushed.');
