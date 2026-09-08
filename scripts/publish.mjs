// Publish: build -> test -> encrypt (pagecrypt) -> decrypt-verify -> commit + push index.html (repo root; GitHub Pages serves main /)
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

let hub;
try {
  // 1. Working tree must be clean apart from the published index.html (content/ and dist/ are gitignored).
  const dirty = git('status', '--porcelain').split('\n').filter(Boolean).filter(l => l.slice(3) !== 'index.html');
  if (dirty.length) fail(`uncommitted changes outside index.html:\n${dirty.join('\n')}\nCommit source first so the published page matches a real commit.`);

  // 2. Test, then build (tests run first as a guard before we touch the build output).
  console.log('testing…');
  execFileSync('node', ['--test'], { cwd: ROOT, stdio: 'inherit' });
  console.log('building…');
  const built = buildFromContent(CONTENT_DIR);

  // 3. Encrypt with the fixed hub password.
  hub = JSON.parse(readFileSync(resolve(CONTENT_DIR, 'hub.json'), 'utf8'));
  const plain = readFileSync(built, 'utf8');
  console.log('encrypting…');
  const encrypted = await encryptHTML(plain, hub.hubPassword, ITERATIONS);

  // 4. Decrypt-verify with WebCrypto (same layout pagecrypt's loader expects: salt|iv|ciphertext, base64 in <pre data-i>).
  const m = encrypted.match(/<pre[^>]*data-i="([^"]+)"[^>]*>([^<]+)<\/pre>/);
  if (!m) fail('no encrypted payload found in encrypted output');
  if (Number(m[1]) !== ITERATIONS) fail('iteration count mismatch in encrypted output');
  const bytes = Uint8Array.from(Buffer.from(m[2], 'base64'));
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(hub.hubPassword), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: bytes.slice(0, 32), iterations: Number(m[1]), hash: 'SHA-256' },
    keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const decrypted = new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(32, 48) }, key, bytes.slice(48)));
  if (decrypted !== plain) fail('decrypt verify failed: plaintext does not match the build');
  if (encrypted.includes(hub.hubPassword)) fail('hub password found in encrypted output');
  console.log(`decrypt verify PASS (${decrypted.length.toLocaleString()} bytes)`);

  // 5. Write only now that verification passed. Dry runs never touch the tracked tree.
  if (DRY) {
    const dryOut = resolve(ROOT, 'dist/hub.encrypted.html');
    mkdirSync(resolve(ROOT, 'dist'), { recursive: true });
    writeFileSync(dryOut, encrypted);
    console.log(`--dry: wrote verified output to ${dryOut} (index.html untouched); skipping commit/push`);
    process.exit(0);
  }
  writeFileSync(resolve(ROOT, 'index.html'), encrypted);

  // 6. Commit and push.
  git('add', 'index.html');
  if (!git('status', '--porcelain', '--', 'index.html')) { console.log('nothing to publish — index.html unchanged'); process.exit(0); }
  const date = new Date().toISOString().slice(0, 10);
  git('commit', '-m', `Publish hub ${date}\n\nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`);
  try {
    git('push');
  } catch {
    fail('commit created but git push failed; run git push once the remote is reachable');
  }
  console.log('published + pushed.');
} catch (err) {
  let message = err.message;
  if (hub && hub.hubPassword && message.includes(hub.hubPassword)) {
    message = message.split(hub.hubPassword).join('[redacted]');
  }
  fail(message);
}
