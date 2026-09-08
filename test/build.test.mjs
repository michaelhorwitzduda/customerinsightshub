import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildHtml, serializeData, buildFromContent } from '../src/build.mjs';

const hub = JSON.parse(readFileSync(new URL('./fixtures/hub.json', import.meta.url)));
const sources = JSON.parse(readFileSync(new URL('./fixtures/sources.json', import.meta.url)));
const template = readFileSync(new URL('../src/template.html', import.meta.url), 'utf8');
const html = buildHtml({ hub, sources, template, buildDate: '2026-09-08' });

function embeddedData() {
  const m = html.match(/window\.HUB_DATA\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
  assert.ok(m, 'HUB_DATA script block present');
  return JSON.parse(m[1].replace(/\\u003c/g, '<'));
}

test('every source name appears', () => {
  for (const s of sources) assert.ok(html.includes(s.name), s.name);
});

test('magic links are url + # + encoded password', () => {
  const data = embeddedData();
  data.sources.forEach((s, i) => {
    const expected = sources[i].dashboard.url + '#' + encodeURIComponent(sources[i].dashboard.password);
    assert.equal(s.dashboard.magicLink, expected);
    assert.doesNotThrow(() => new URL(s.dashboard.magicLink));
  });
});

test('raw dashboard password appears only inside its magic link', () => {
  for (const s of sources) {
    const enc = encodeURIComponent(s.dashboard.password);
    const stripped = html.split(s.dashboard.url + '#' + enc).join('');
    assert.ok(!stripped.includes(s.dashboard.password), `raw password leaked for ${s.key}`);
    assert.ok(!stripped.includes(enc), `encoded password leaked for ${s.key}`);
  }
});

test('embedded sources carry no password field', () => {
  for (const s of embeddedData().sources) assert.equal(s.dashboard.password, undefined);
});

test('hub password never appears', () => {
  assert.ok(!html.includes(hub.hubPassword));
});

test('slack webhook appears exactly once', () => {
  assert.equal(html.split(hub.slackWebhookUrl).length - 1, 1);
});

test('no placeholder markers remain', () => {
  assert.ok(!html.includes('/*__DATA__*/'));
  assert.ok(!html.includes('{{TITLE}}'));
  assert.ok(!/\bTODO\b|\bTBD\b/.test(html));
});

test('build date and title are injected', () => {
  assert.ok(html.includes('2026-09-08'));
  assert.ok(html.includes('<title>Fixture Hub</title>'));
});

test('invalid content is rejected before rendering', () => {
  const bad = JSON.parse(JSON.stringify(sources)); bad[0].findings = [];
  assert.throws(() => buildHtml({ hub, sources: bad, template, buildDate: '2026-09-08' }), /findings/);
});

test('unknown/unlisted fields are not embedded (allowlist, not denylist)', () => {
  const hubWithExtra = { ...JSON.parse(JSON.stringify(hub)), adminToken: 'SUPERSECRET' };
  const sourcesWithExtra = JSON.parse(JSON.stringify(sources));
  sourcesWithExtra[0].internalNote = 'INTERNALSECRET';
  const out = buildHtml({ hub: hubWithExtra, sources: sourcesWithExtra, template, buildDate: '2026-09-08' });
  assert.ok(!out.includes('SUPERSECRET'));
  assert.ok(!out.includes('INTERNALSECRET'));
});

test('serializeData escapes "<" so a script tag cannot be closed, and round-trips', () => {
  const payload = '</script><script>alert(1)</script>';
  const result = serializeData({ a: payload });
  assert.ok(!result.includes('<'));
  assert.equal(JSON.parse(result).a, payload);
});

test('/*__DATA__*/ is replaced before {{TITLE}}, so a title cannot swallow the data placeholder', () => {
  const trickyHub = JSON.parse(JSON.stringify(hub));
  trickyHub.title = '/*__DATA__*/';
  const out = buildHtml({ hub: trickyHub, sources, template, buildDate: '2026-09-08' });
  assert.ok(out.includes('window.HUB_DATA = {'));
  assert.ok(out.includes('<title>/*__DATA__*/</title>'));
});

test('buildDate is required and must be a YYYY-MM-DD string', () => {
  assert.throws(() => buildHtml({ hub, sources, template }), /buildDate/);
  assert.throws(() => buildHtml({ hub, sources, template, buildDate: '09/08/2026' }), /buildDate/);
});

test('template missing /*__DATA__*/ placeholder throws', () => {
  const badTemplate = template.replace('/*__DATA__*/', 'NOPE');
  assert.throws(() => buildHtml({ hub, sources, template: badTemplate, buildDate: '2026-09-08' }), /__DATA__/);
});

test('template missing {{TITLE}} placeholder throws', () => {
  const badTemplate = template.replace('{{TITLE}}', 'NOPE');
  assert.throws(() => buildHtml({ hub, sources, template: badTemplate, buildDate: '2026-09-08' }), /TITLE/);
});

test('buildFromContent accepts a contentDir override and writes dist/hub.html', () => {
  const out = buildFromContent(fileURLToPath(new URL('./fixtures', import.meta.url)));
  assert.ok(existsSync(out));
  assert.ok(readFileSync(out, 'utf8').includes('<title>Fixture Hub</title>'));
});
