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

export function serializeData(data) {
  // Escape "<" so the JSON can never close the script tag.
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function buildHtml({ hub, sources, template, buildDate }) {
  validateHub(hub);
  validateSources(sources);
  if (typeof buildDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(buildDate)) {
    throw new Error('buildDate must be a YYYY-MM-DD string');
  }
  if (!template.includes('/*__DATA__*/')) throw new Error('template is missing the /*__DATA__*/ placeholder');
  if (!template.includes('{{TITLE}}')) throw new Error('template is missing the {{TITLE}} placeholder');

  const publicSources = sources.map(s => {
    const { key, name, icon, accent, purpose, audience, coverage, bestFor, findings, quotes, dashboard } = s;
    const { url, password } = dashboard;
    return {
      key, name, icon, accent, purpose, audience, coverage, bestFor, findings, quotes,
      dashboard: { url, magicLink: `${url}#${encodeURIComponent(password)}` },
    };
  });
  const { title, intro, ownerName, ownerEmail, slackWebhookUrl, feedbackTypes } = hub;
  const publicHub = { title, intro, ownerName, ownerEmail, slackWebhookUrl, feedbackTypes };
  const data = { hub: publicHub, sources: publicSources, buildDate };
  const json = serializeData(data);

  return template
    .replace('/*__DATA__*/', () => json)
    .replace('{{TITLE}}', () => escapeHtml(hub.title));
}

export function buildFromContent(contentDir = resolve(ROOT, 'content')) {
  const read = p => JSON.parse(readFileSync(resolve(contentDir, p), 'utf8'));
  const hub = read('hub.json');
  const sources = read('sources.json');
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
