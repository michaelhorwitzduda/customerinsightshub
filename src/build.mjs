// Build: content JSON + template -> dist/hub.html (unencrypted preview).
// Usage: node src/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { validateHub, validateSources } from './validate.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function buildHtml({ hub, sources, template, buildDate }) {
  validateHub(hub);
  validateSources(sources);
  if (!template.includes('/*__DATA__*/')) throw new Error('template is missing the /*__DATA__*/ placeholder');
  if (!template.includes('{{TITLE}}')) throw new Error('template is missing the {{TITLE}} placeholder');

  const publicSources = sources.map(s => {
    const { url, password } = s.dashboard;
    return { ...s, dashboard: { url, magicLink: `${url}#${encodeURIComponent(password)}` } };
  });
  const { hubPassword, ...publicHub } = hub;
  const data = { hub: publicHub, sources: publicSources, buildDate };
  // Escape "<" so the JSON can never close the script tag.
  const json = JSON.stringify(data).replace(/</g, '\\u003c');

  return template
    .replace('{{TITLE}}', () => escapeHtml(hub.title))
    .replace('/*__DATA__*/', () => json);
}

export function buildFromContent() {
  const read = p => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));
  const hub = read('content/hub.json');
  const sources = read('content/sources.json');
  const template = readFileSync(resolve(ROOT, 'src/template.html'), 'utf8');
  const buildDate = new Date().toISOString().slice(0, 10);
  const html = buildHtml({ hub, sources, template, buildDate });
  mkdirSync(resolve(ROOT, 'dist'), { recursive: true });
  const out = resolve(ROOT, 'dist/hub.html');
  writeFileSync(out, html);
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const out = buildFromContent();
    console.log(`built ${out}`);
  } catch (err) {
    console.error(`BUILD FAILED: ${err.message}`);
    process.exit(1);
  }
}
