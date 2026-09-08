import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildHtml } from '../src/build.mjs';

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
