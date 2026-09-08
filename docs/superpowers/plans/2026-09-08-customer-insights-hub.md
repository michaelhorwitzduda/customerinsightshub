# Customer Insights Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single password-protected page on GitHub Pages that summarizes Duda's four customer-insight sources, opens each dashboard with one click via magic links, and posts team feedback to Slack.

**Architecture:** Content (findings, quotes, passwords, webhook) lives in gitignored JSON under `content/`. A Node build script validates it and injects it into a self-contained vanilla HTML template, producing `dist/hub.html`. A publish script encrypts that with pagecrypt into `docs/index.html`, verifies it decrypts, and commits and pushes. GitHub Pages serves `/docs` on `main`.

**Tech Stack:** Node 22 (ES modules), `node:test`, pagecrypt 7, vanilla HTML/CSS/JS, Slack Workflow Builder webhook. No frameworks, no CDN dependencies.

**Spec:** `docs/superpowers/specs/2026-09-08-customer-insights-hub-design.md`

**Already in place:** git repo on `main` with remote `origin`; `.gitignore`; `content/hub.json` holding the real Slack webhook URL and a generated `hubPassword` (do not overwrite it; `intro` is still empty and gets filled in Task 8).

---

## File structure

| Path | Responsibility |
|---|---|
| `package.json` | scripts (`build`, `test`, `release`), pagecrypt devDependency |
| `src/validate.mjs` | pure functions that validate `hub.json` and `sources.json`; throw descriptive errors |
| `src/build.mjs` | `buildHtml()` pure function + CLI entry that writes `dist/hub.html` |
| `src/template.html` | page markup, styles, client JS; contains the `/*__DATA__*/` placeholder |
| `scripts/publish.mjs` | build, test, encrypt, decrypt-verify, commit, push |
| `test/fixtures/hub.json`, `test/fixtures/sources.json` | fake content for tests (no secrets) |
| `test/validate.test.mjs` | validation rules |
| `test/build.test.mjs` | build output invariants (magic links, no leaked passwords, etc.) |
| `content/hub.example.json`, `content/sources.example.json` | committed, redacted schema examples |
| `content/sources.json` | real content (gitignored), drafted in Task 8 |
| `README.md` | what this is, refresh workflow, Pages setup |

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `content/hub.example.json`
- Create: `content/sources.example.json`
- Create: `test/fixtures/hub.json`
- Create: `test/fixtures/sources.json`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "customer-insights-hub",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node src/build.mjs",
    "test": "node --test test/",
    "release": "node scripts/publish.mjs"
  },
  "devDependencies": {
    "pagecrypt": "^7.1.0"
  }
}
```

- [ ] **Step 2: Install and confirm the pagecrypt Node API**

Run: `npm install`
Then: `node -e "import('pagecrypt').then(m => console.log(Object.keys(m)))"`
Expected: output includes `encryptHTML` and `generatePassword`. If `encryptHTML` is missing, Task 7 uses the CLI fallback noted there.

- [ ] **Step 3: Create the redacted example content files**

`content/hub.example.json`:
```json
{
  "title": "Customer Insights Hub",
  "intro": "One place to see what Duda customers say and do, and to open the dashboards behind it.",
  "hubPassword": "REPLACE_WITH_HUB_PASSWORD",
  "ownerName": "Michael Horwitz",
  "ownerEmail": "michael.horwitz@duda.co",
  "slackWebhookUrl": "https://hooks.slack.com/triggers/REPLACE/WITH/REAL",
  "feedbackTypes": ["Data request", "Question", "Bug", "Idea"]
}
```

`content/sources.example.json`:
```json
[
  {
    "key": "g2",
    "name": "G2 Reviews",
    "icon": "star",
    "accent": "#F5A623",
    "purpose": "What verified customers say publicly about Duda, by segment and rating.",
    "audience": ["sales", "marketing"],
    "coverage": {
      "sampleSize": "845 reviews",
      "dateRange": "Jan 2016 to Aug 2026",
      "lastRefreshed": "2026-08-15"
    },
    "bestFor": {
      "sales": "Third-party proof for objection handling.",
      "marketing": "Messaging themes and competitor mentions."
    },
    "findings": [
      "Example finding one.",
      "Example finding two."
    ],
    "quotes": [
      { "text": "Example verbatim quote.", "context": "Agency owner, 11 to 50 employees, 5 stars, Mar 2026" }
    ],
    "dashboard": {
      "url": "https://michaelhorwitzduda.github.io/g2reviewsdashboard/",
      "password": "REPLACE_WITH_DASHBOARD_PASSWORD"
    }
  }
]
```

- [ ] **Step 4: Create test fixtures**

`test/fixtures/hub.json`:
```json
{
  "title": "Fixture Hub",
  "intro": "Fixture intro text.",
  "hubPassword": "HUBSECRET123",
  "ownerName": "Owner Name",
  "ownerEmail": "owner@example.com",
  "slackWebhookUrl": "https://hooks.slack.com/triggers/T000/111/abc",
  "feedbackTypes": ["Data request", "Question"]
}
```

`test/fixtures/sources.json`:
```json
[
  {
    "key": "alpha",
    "name": "Alpha Source",
    "icon": "star",
    "accent": "#112233",
    "purpose": "Alpha purpose.",
    "audience": ["sales"],
    "coverage": { "sampleSize": "10 items", "dateRange": "2025", "lastRefreshed": "2026-01-01" },
    "bestFor": { "sales": "Alpha for sales.", "marketing": "Alpha for marketing." },
    "findings": ["Alpha finding."],
    "quotes": [{ "text": "Alpha quote.", "context": "Alpha context" }],
    "dashboard": { "url": "https://example.com/alpha/", "password": "ALPHASECRET" }
  },
  {
    "key": "beta",
    "name": "Beta Source",
    "icon": "chat",
    "accent": "#445566",
    "purpose": "Beta purpose.",
    "audience": ["sales", "marketing"],
    "coverage": { "sampleSize": "20 items", "dateRange": "2026", "lastRefreshed": "2026-02-02" },
    "bestFor": { "sales": "Beta for sales.", "marketing": "Beta for marketing." },
    "findings": ["Beta finding one.", "Beta finding two."],
    "quotes": [{ "text": "Beta quote.", "context": "Beta context" }],
    "dashboard": { "url": "https://example.com/beta/", "password": "BETA SECRET+1" }
  }
]
```

- [ ] **Step 5: Confirm gitignore keeps real content out**

Run: `git status --short`
Expected: shows `package.json`, `package-lock.json`, `content/hub.example.json`, `content/sources.example.json`, `test/` and nothing under `content/` other than the two example files.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json content/hub.example.json content/sources.example.json test/fixtures
git commit -m "Scaffold project: package.json, example content, test fixtures

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Content validation

**Files:**
- Create: `src/validate.mjs`
- Test: `test/validate.test.mjs`

- [ ] **Step 1: Write the failing tests**

`test/validate.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateHub, validateSources } from '../src/validate.mjs';

const hub = () => JSON.parse(readFileSync(new URL('./fixtures/hub.json', import.meta.url)));
const sources = () => JSON.parse(readFileSync(new URL('./fixtures/sources.json', import.meta.url)));

test('valid fixtures pass', () => {
  assert.doesNotThrow(() => validateHub(hub()));
  assert.doesNotThrow(() => validateSources(sources()));
});

test('hub: empty required string fails with field name', () => {
  const h = hub(); h.intro = '';
  assert.throws(() => validateHub(h), /hub\.intro/);
});

test('hub: placeholder markers fail', () => {
  for (const bad of ['TODO write this', 'TBD', '...', 'https://hooks.slack.com/<fill in>']) {
    const h = hub(); h.slackWebhookUrl = bad;
    assert.throws(() => validateHub(h), /placeholder/);
  }
});

test('hub: webhook must be https URL', () => {
  const h = hub(); h.slackWebhookUrl = 'not a url';
  assert.throws(() => validateHub(h), /hub\.slackWebhookUrl/);
});

test('hub: feedbackTypes must be non-empty array of strings', () => {
  const h = hub(); h.feedbackTypes = [];
  assert.throws(() => validateHub(h), /hub\.feedbackTypes/);
});

test('sources: must be non-empty array', () => {
  assert.throws(() => validateSources([]), /at least one/);
  assert.throws(() => validateSources({}), /array/);
});

test('sources: duplicate keys fail', () => {
  const s = sources(); s[1].key = s[0].key;
  assert.throws(() => validateSources(s), /duplicate key/);
});

test('sources: audience values restricted', () => {
  const s = sources(); s[0].audience = ['sales', 'everyone'];
  assert.throws(() => validateSources(s), /sources\[0\]\.audience/);
});

test('sources: accent must be hex color', () => {
  const s = sources(); s[0].accent = 'red';
  assert.throws(() => validateSources(s), /sources\[0\]\.accent/);
});

test('sources: dashboard url must be https', () => {
  const s = sources(); s[0].dashboard.url = 'http://example.com/';
  assert.throws(() => validateSources(s), /sources\[0\]\.dashboard\.url/);
});

test('sources: needs at least one finding and one quote', () => {
  let s = sources(); s[0].findings = [];
  assert.throws(() => validateSources(s), /sources\[0\]\.findings/);
  s = sources(); s[0].quotes = [];
  assert.throws(() => validateSources(s), /sources\[0\]\.quotes/);
});

test('sources: quote needs text and context', () => {
  const s = sources(); s[0].quotes = [{ text: 'x' }];
  assert.throws(() => validateSources(s), /sources\[0\]\.quotes\[0\]\.context/);
});

test('sources: nested coverage field placeholder fails', () => {
  const s = sources(); s[1].coverage.dateRange = 'TBD';
  assert.throws(() => validateSources(s), /sources\[1\]\.coverage\.dateRange/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL with `Cannot find module` for `../src/validate.mjs`.

- [ ] **Step 3: Implement validate.mjs**

`src/validate.mjs`:
```js
// Validation for content/hub.json and content/sources.json.
// Every function throws an Error whose message names the offending field path.

const AUDIENCES = new Set(['sales', 'marketing']);

function isPlaceholder(str) {
  const t = str.trim();
  return t === '...' || /\bTODO\b|\bTBD\b/.test(t) || /<[^>]+>/.test(t);
}

function requireString(obj, path, key) {
  const v = obj[key];
  const full = `${path}.${key}`;
  if (typeof v !== 'string' || v.trim() === '') throw new Error(`${full} is required and must be a non-empty string`);
  if (isPlaceholder(v)) throw new Error(`${full} contains a placeholder marker: ${JSON.stringify(v)}`);
  return v;
}

function requireHttpsUrl(obj, path, key) {
  const v = requireString(obj, path, key);
  let u;
  try { u = new URL(v); } catch { throw new Error(`${path}.${key} is not a valid URL`); }
  if (u.protocol !== 'https:') throw new Error(`${path}.${key} must use https`);
  return v;
}

function requireStringArray(obj, path, key) {
  const v = obj[key];
  const full = `${path}.${key}`;
  if (!Array.isArray(v) || v.length === 0) throw new Error(`${full} must be a non-empty array`);
  v.forEach((_, i) => requireString(v, full, i));
  return v;
}

export function validateHub(hub) {
  if (!hub || typeof hub !== 'object') throw new Error('hub must be an object');
  const p = 'hub';
  requireString(hub, p, 'title');
  requireString(hub, p, 'intro');
  requireString(hub, p, 'hubPassword');
  requireString(hub, p, 'ownerName');
  requireString(hub, p, 'ownerEmail');
  requireHttpsUrl(hub, p, 'slackWebhookUrl');
  requireStringArray(hub, p, 'feedbackTypes');
  return hub;
}

function validateSource(s, p) {
  if (!s || typeof s !== 'object') throw new Error(`${p} must be an object`);
  requireString(s, p, 'key');
  requireString(s, p, 'name');
  requireString(s, p, 'icon');
  const accent = requireString(s, p, 'accent');
  if (!/^#[0-9a-fA-F]{6}$/.test(accent)) throw new Error(`${p}.accent must be a 6-digit hex color like #1A2B3C`);
  requireString(s, p, 'purpose');
  if (!Array.isArray(s.audience) || s.audience.length === 0 || !s.audience.every(a => AUDIENCES.has(a))) {
    throw new Error(`${p}.audience must be a non-empty array containing only "sales" and/or "marketing"`);
  }
  if (!s.coverage || typeof s.coverage !== 'object') throw new Error(`${p}.coverage is required`);
  requireString(s.coverage, `${p}.coverage`, 'sampleSize');
  requireString(s.coverage, `${p}.coverage`, 'dateRange');
  requireString(s.coverage, `${p}.coverage`, 'lastRefreshed');
  if (!s.bestFor || typeof s.bestFor !== 'object') throw new Error(`${p}.bestFor is required`);
  requireString(s.bestFor, `${p}.bestFor`, 'sales');
  requireString(s.bestFor, `${p}.bestFor`, 'marketing');
  if (!Array.isArray(s.findings) || s.findings.length === 0) throw new Error(`${p}.findings must have at least one entry`);
  s.findings.forEach((_, i) => requireString(s.findings, `${p}.findings`, i));
  if (!Array.isArray(s.quotes) || s.quotes.length === 0) throw new Error(`${p}.quotes must have at least one entry`);
  s.quotes.forEach((q, i) => {
    if (!q || typeof q !== 'object') throw new Error(`${p}.quotes[${i}] must be an object`);
    requireString(q, `${p}.quotes[${i}]`, 'text');
    requireString(q, `${p}.quotes[${i}]`, 'context');
  });
  if (!s.dashboard || typeof s.dashboard !== 'object') throw new Error(`${p}.dashboard is required`);
  requireHttpsUrl(s.dashboard, `${p}.dashboard`, 'url');
  requireString(s.dashboard, `${p}.dashboard`, 'password');
}

export function validateSources(sources) {
  if (!Array.isArray(sources)) throw new Error('sources must be an array');
  if (sources.length === 0) throw new Error('sources must contain at least one source');
  const seen = new Set();
  sources.forEach((s, i) => {
    validateSource(s, `sources[${i}]`);
    if (seen.has(s.key)) throw new Error(`duplicate key "${s.key}" in sources`);
    seen.add(s.key);
  });
  return sources;
}
```

Note on `requireString` with numeric keys: when called on an array with index `i`, the error path reads `sources[0].findings.0`. That is acceptable; tests only match the prefix.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests in `validate.test.mjs` PASS.

- [ ] **Step 5: Commit**

```bash
git add src/validate.mjs test/validate.test.mjs
git commit -m "Add content validation with tests

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Build function and CLI

**Files:**
- Create: `src/build.mjs`
- Create: `src/template.html` (minimal stub in this task; full page in Task 4)
- Test: `test/build.test.mjs`

- [ ] **Step 1: Write the failing tests**

`test/build.test.mjs`:
```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL with `Cannot find module` for `../src/build.mjs`.

- [ ] **Step 3: Create a minimal template stub**

`src/template.html` (replaced with the full page in Task 4; the placeholders must survive):
```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{TITLE}}</title>
</head>
<body>
<div id="app"></div>
<script>window.HUB_DATA = /*__DATA__*/;</script>
<script>
document.getElementById('app').textContent = window.HUB_DATA.sources.map(s => s.name).join(', ') + ' · ' + window.HUB_DATA.buildDate;
</script>
</body>
</html>
```

- [ ] **Step 4: Implement build.mjs**

`src/build.mjs`:
```js
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: all tests PASS in both test files.

- [ ] **Step 6: Confirm the CLI fails loudly on the current incomplete content**

Run: `npm run build`
Expected: exit code 1 and `BUILD FAILED: hub.intro is required and must be a non-empty string` (intro is filled in Task 8). If `content/sources.json` does not exist yet, the error is `ENOENT` for that path, which is also acceptable at this stage.

- [ ] **Step 7: Commit**

```bash
git add src/build.mjs src/template.html test/build.test.mjs
git commit -m "Add build function, CLI, and template stub with tests

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Page template, layout and source cards

**Files:**
- Modify: `src/template.html` (replace the stub entirely)

- [ ] **Step 1: Write the full template**

Replace `src/template.html` with:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{TITLE}}</title>
<style>
  :root {
    --bg: #f6f7f9; --card: #ffffff; --ink: #1c2430; --muted: #5b6570; --line: #e3e7ec;
    --sales: #2f6fed; --marketing: #b5479a; --ok: #1f9d55; --radius: 14px;
    --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.5 var(--font); }
  a { color: inherit; }
  .wrap { max-width: 1120px; margin: 0 auto; padding: 40px 20px 120px; }
  header h1 { font-size: 30px; margin: 0 0 8px; letter-spacing: -0.01em; }
  header p.intro { max-width: 720px; color: var(--muted); margin: 0 0 14px; font-size: 16px; }
  .meta { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; color: var(--muted); font-size: 13px; }
  .tag { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 12px; font-weight: 600; color: #fff; }
  .tag.sales { background: var(--sales); } .tag.marketing { background: var(--marketing); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; margin-top: 32px; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); padding: 22px; display: flex; flex-direction: column; gap: 14px; border-top: 5px solid var(--accent); }
  .card-head { display: flex; gap: 14px; align-items: flex-start; }
  .icon { width: 44px; height: 44px; border-radius: 12px; background: var(--accent); color: #fff; display: grid; place-items: center; font-size: 22px; flex: none; }
  .card h2 { margin: 0 0 4px; font-size: 19px; }
  .purpose { margin: 0; color: var(--muted); }
  .tags { display: flex; gap: 6px; margin-top: 6px; }
  .coverage { display: flex; flex-wrap: wrap; gap: 8px 18px; font-size: 13px; color: var(--muted); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); padding: 10px 0; }
  .coverage b { color: var(--ink); font-weight: 600; }
  .open { display: inline-flex; justify-content: center; align-items: center; gap: 8px; padding: 11px 16px; border-radius: 10px; background: var(--accent); color: #fff; text-decoration: none; font-weight: 600; }
  .open:hover { filter: brightness(0.94); }
  .bestfor { display: grid; gap: 6px; font-size: 14px; }
  .bestfor span.tag { margin-right: 6px; }
  details { border: 1px solid var(--line); border-radius: 10px; padding: 0 14px; }
  details summary { cursor: pointer; padding: 10px 0; font-weight: 600; list-style: none; display: flex; justify-content: space-between; }
  details summary::after { content: "+"; color: var(--muted); }
  details[open] summary::after { content: "–"; }
  details ul { margin: 0 0 12px; padding-left: 18px; }
  details li { margin: 6px 0; }
  .quote { border-left: 3px solid var(--accent); padding: 6px 12px; margin: 0 0 12px; background: var(--bg); border-radius: 0 8px 8px 0; }
  .quote p { margin: 0 0 4px; }
  .quote .ctx { color: var(--muted); font-size: 13px; display: flex; justify-content: space-between; gap: 10px; align-items: center; }
  .copy { border: 1px solid var(--line); background: #fff; border-radius: 6px; padding: 3px 9px; font: inherit; font-size: 12px; cursor: pointer; }
  .copy.done { color: var(--ok); border-color: var(--ok); }
  .fab { position: fixed; right: 22px; bottom: 22px; background: var(--ink); color: #fff; border: 0; border-radius: 999px; padding: 14px 20px; font: inherit; font-weight: 600; cursor: pointer; box-shadow: 0 8px 24px rgba(0,0,0,.18); }
  .modal { position: fixed; inset: 0; background: rgba(20,26,34,.45); display: none; align-items: center; justify-content: center; padding: 20px; }
  .modal.on { display: flex; }
  .sheet { background: #fff; border-radius: var(--radius); padding: 24px; width: 100%; max-width: 520px; display: grid; gap: 12px; }
  .sheet h3 { margin: 0; }
  .sheet label { display: grid; gap: 4px; font-size: 13px; color: var(--muted); }
  .sheet input, .sheet select, .sheet textarea { font: inherit; padding: 9px 10px; border: 1px solid var(--line); border-radius: 8px; width: 100%; }
  .sheet textarea { min-height: 110px; resize: vertical; }
  .row { display: flex; gap: 10px; justify-content: flex-end; align-items: center; }
  .btn { font: inherit; font-weight: 600; padding: 10px 16px; border-radius: 9px; border: 1px solid var(--line); background: #fff; cursor: pointer; }
  .btn.primary { background: var(--ink); color: #fff; border-color: var(--ink); }
  .btn[disabled] { opacity: .6; cursor: default; }
  .note { font-size: 13px; color: var(--muted); }
  .note.ok { color: var(--ok); font-weight: 600; }
  .note.err { color: #b42318; }
  @media (max-width: 480px) { .wrap { padding: 24px 14px 110px; } header h1 { font-size: 24px; } }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1 id="title"></h1>
    <p class="intro" id="intro"></p>
    <div class="meta">
      <span>Last updated <b id="updated"></b></span>
      <span><span class="tag sales">Sales</span> useful for sales conversations</span>
      <span><span class="tag marketing">Marketing</span> useful for messaging and campaigns</span>
    </div>
  </header>
  <main class="grid" id="grid"></main>
</div>

<button class="fab" id="fab" type="button">Request or feedback</button>

<div class="modal" id="modal" role="dialog" aria-modal="true" aria-labelledby="fb-title">
  <form class="sheet" id="fb-form">
    <h3 id="fb-title">Request or feedback</h3>
    <label>Type <select name="type" id="fb-type" required></select></label>
    <label>Related source <select name="source" id="fb-source" required></select></label>
    <label>Message <textarea name="message" id="fb-message" required placeholder="What do you need, or what did you notice?"></textarea></label>
    <label>Your name <input name="name" id="fb-name" required autocomplete="name"></label>
    <div class="note" id="fb-note"></div>
    <div class="row">
      <button class="btn" type="button" id="fb-cancel">Cancel</button>
      <button class="btn primary" type="submit" id="fb-send">Send</button>
    </div>
  </form>
</div>

<script>window.HUB_DATA = /*__DATA__*/;</script>
<script>
(function () {
  const D = window.HUB_DATA;
  const ICONS = { facebook: '👥', star: '⭐', chat: '💬', globe: '🌐' };
  const $ = (id) => document.getElementById(id);
  const el = (tag, attrs, ...children) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') n.className = v;
      else if (k === 'style') n.style.cssText = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (const c of children) n.append(c);
    return n;
  };

  // Header
  document.title = D.hub.title;
  $('title').textContent = D.hub.title;
  $('intro').textContent = D.hub.intro;
  $('updated').textContent = D.buildDate;

  // Cards
  const grid = $('grid');
  for (const s of D.sources) grid.append(renderCard(s));

  function renderCard(s) {
    const tags = el('div', { class: 'tags' }, ...s.audience.map(a => el('span', { class: 'tag ' + a }, a === 'sales' ? 'Sales' : 'Marketing')));
    const head = el('div', { class: 'card-head' },
      el('div', { class: 'icon' }, ICONS[s.icon] || '•'),
      el('div', {}, el('h2', {}, s.name), el('p', { class: 'purpose' }, s.purpose), tags));
    const cov = el('div', { class: 'coverage' },
      el('span', {}, el('b', {}, s.coverage.sampleSize)),
      el('span', {}, s.coverage.dateRange),
      el('span', {}, 'Refreshed ', el('b', {}, s.coverage.lastRefreshed)));
    const open = el('a', { class: 'open', href: s.dashboard.magicLink, target: '_blank', rel: 'noopener' }, 'Open dashboard ↗');
    const best = el('div', { class: 'bestfor' },
      el('div', {}, el('span', { class: 'tag sales' }, 'Sales'), s.bestFor.sales),
      el('div', {}, el('span', { class: 'tag marketing' }, 'Marketing'), s.bestFor.marketing));
    const findings = el('details', {}, el('summary', {}, 'Key findings (' + s.findings.length + ')'),
      el('ul', {}, ...s.findings.map(f => el('li', {}, f))));
    const quotes = el('details', {}, el('summary', {}, 'Quotes you can use (' + s.quotes.length + ')'),
      ...s.quotes.map(renderQuote));
    return el('article', { class: 'card', style: '--accent:' + s.accent }, head, cov, open, best, findings, quotes);
  }

  function renderQuote(q) {
    const btn = el('button', { class: 'copy', type: 'button' }, 'Copy');
    btn.addEventListener('click', async () => {
      const text = '"' + q.text + '" — ' + q.context;
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = el('textarea', {}, text); document.body.append(ta); ta.select();
        try { document.execCommand('copy'); } finally { ta.remove(); }
      }
      btn.textContent = 'Copied'; btn.classList.add('done');
      setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('done'); }, 1500);
    });
    return el('blockquote', { class: 'quote' },
      el('p', {}, '“' + q.text + '”'),
      el('div', { class: 'ctx' }, el('span', {}, q.context), btn));
  }

  // Feedback modal (submit logic in feedback section below)
  const modal = $('modal'), form = $('fb-form'), note = $('fb-note');
  for (const t of D.hub.feedbackTypes) $('fb-type').append(el('option', { value: t }, t));
  $('fb-source').append(el('option', { value: 'General' }, 'General'));
  for (const s of D.sources) $('fb-source').append(el('option', { value: s.name }, s.name));
  const openModal = () => { modal.classList.add('on'); $('fb-message').focus(); };
  const closeModal = () => { modal.classList.remove('on'); note.textContent = ''; note.className = 'note'; };
  $('fab').addEventListener('click', openModal);
  $('fb-cancel').addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('on')) closeModal(); });

  function payload() {
    return {
      type: $('fb-type').value,
      source: $('fb-source').value,
      name: $('fb-name').value.trim(),
      message: $('fb-message').value.trim(),
    };
  }

  function mailtoFor(p) {
    const subject = 'Insights Hub: ' + p.type + ' (' + p.source + ')';
    const body = 'From: ' + p.name + '\n\n' + p.message;
    return 'mailto:' + D.hub.ownerEmail + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }

  async function sendToSlack(p) {
    // CORS "simple request": text/plain body avoids a preflight; Slack allows any origin.
    const res = await fetch(D.hub.slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(p),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    if (!/"ok"\s*:\s*true/.test(text)) throw new Error('Slack did not confirm: ' + text.slice(0, 120));
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const p = payload();
    if (!p.message || !p.name) { note.textContent = 'Please add a message and your name.'; note.className = 'note err'; return; }
    $('fb-send').disabled = true; note.textContent = 'Sending…'; note.className = 'note';
    try {
      await sendToSlack(p);
      note.textContent = 'Sent — thanks, ' + p.name + '. ' + D.hub.ownerName + ' will follow up.';
      note.className = 'note ok';
      $('fb-message').value = '';
      setTimeout(closeModal, 1800);
    } catch (err) {
      note.textContent = '';
      note.className = 'note err';
      note.append('Could not reach Slack (' + err.message + '). ',
        el('a', { href: mailtoFor(p) }, 'Send it by email instead'), ' — your message is kept below.');
    } finally {
      $('fb-send').disabled = false;
    }
  });
})();
</script>
</body>
</html>
```

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: all PASS. The build tests only depend on the two placeholders and the `window.HUB_DATA = {...};</script>` shape, which are preserved.

- [ ] **Step 3: Visual check with fixture data**

Run:
```bash
node -e "import('./src/build.mjs').then(m => { const fs = require('fs'); const html = m.buildHtml({ hub: JSON.parse(fs.readFileSync('test/fixtures/hub.json')), sources: JSON.parse(fs.readFileSync('test/fixtures/sources.json')), template: fs.readFileSync('src/template.html','utf8'), buildDate: '2026-09-08' }); fs.mkdirSync('dist', { recursive: true }); fs.writeFileSync('dist/fixture-preview.html', html); console.log('ok'); })"
```
Open `dist/fixture-preview.html` in the Browser pane. Expected: header with title and legend, two cards with accent bars, coverage row, "Open dashboard" button, two expandable sections, quote copy buttons, and a floating "Request or feedback" button that opens the modal. Check at 375px width that cards stack and nothing overflows horizontally.

- [ ] **Step 4: Commit**

```bash
git add src/template.html
git commit -m "Full hub template: header, source cards, quotes, feedback modal

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Verify the Slack webhook accepts a text/plain body

This posts one message to the owner's Slack channel. The owner approved test posts on 2026-09-08.

**Files:** none (verification only; may modify `src/template.html` `sendToSlack` if the fallback is needed)

- [ ] **Step 1: Post with text/plain from the command line**

Run (webhook URL from `content/hub.json`):
```bash
URL=$(node -p "require('./content/hub.json').slackWebhookUrl") && curl -s -w '\nHTTP %{http_code}\n' -X POST -H 'Content-Type: text/plain;charset=UTF-8' -H 'Origin: https://michaelhorwitzduda.github.io' -d '{"type":"Bug","source":"General","name":"Build check","message":"text/plain content-type test from the hub build. Safe to ignore."}' "$URL"
```
Expected: `{"ok":true}` and `HTTP 200`, and the message appears in Slack with all four fields filled.

- [ ] **Step 2a: If accepted, nothing to change.** Record in README (Task 9) that the form uses a text/plain simple request.

- [ ] **Step 2b: If rejected (non-200 or fields blank in Slack), switch to the no-cors fallback**

In `src/template.html`, replace the body of `sendToSlack` with:
```js
  async function sendToSlack(p) {
    // Slack rejected text/plain; send JSON with an opaque response and assume success on resolve.
    await fetch(D.hub.slackWebhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    });
  }
```
Then run `npm test` (expected PASS) and commit:
```bash
git add src/template.html
git commit -m "Feedback: use no-cors JSON post for Slack webhook

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Publish script with encrypt and decrypt-verify

**Files:**
- Create: `scripts/publish.mjs`

- [ ] **Step 1: Write publish.mjs**

```js
// Publish: build -> test -> encrypt (pagecrypt) -> decrypt-verify -> commit + push docs/index.html
//   node scripts/publish.mjs          full publish
//   node scripts/publish.mjs --dry    everything except commit/push
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { webcrypto as crypto } from 'node:crypto';
import { encryptHTML } from 'pagecrypt';
import { buildFromContent } from '../src/build.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry');
const ITERATIONS = 2_000_000;
const run = (cmd) => execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim();
const fail = (msg) => { console.error(`PUBLISH ABORTED: ${msg}`); process.exit(1); };

// 1. Working tree must be clean apart from docs/ (content/ and dist/ are gitignored).
const dirty = run('git status --porcelain').split('\n').filter(Boolean).filter(l => !l.slice(3).startsWith('docs/'));
if (dirty.length) fail(`uncommitted changes outside docs/:\n${dirty.join('\n')}\nCommit source first so the published page matches a real commit.`);

// 2. Build and test.
console.log('building…');
const built = buildFromContent();
console.log('testing…');
execSync('node --test test/', { cwd: ROOT, stdio: 'inherit' });

// 3. Encrypt with the fixed hub password.
const hub = JSON.parse(readFileSync(resolve(ROOT, 'content/hub.json'), 'utf8'));
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
run('git add docs/index.html');
if (!run('git status --porcelain -- docs/index.html')) { console.log('nothing to publish — docs/index.html unchanged'); process.exit(0); }
const date = new Date().toISOString().slice(0, 10);
run(`git commit -m "Publish hub ${date}\n\nCo-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"`);
run('git push');
console.log('published + pushed.');
```

If Task 1 Step 2 showed no `encryptHTML` export, replace the encrypt line with the CLI:
```js
writeFileSync(resolve(ROOT, 'dist/.pw'), hub.hubPassword);
execSync(`npx pagecrypt dist/hub.html docs/index.html "${hub.hubPassword}" -i ${ITERATIONS}`, { cwd: ROOT, stdio: 'inherit' });
const encrypted = readFileSync(resolve(ROOT, 'docs/index.html'), 'utf8');
```
(The generated hub password is alphanumeric, so quoting is safe.)

- [ ] **Step 2: Dry-run against fixture content**

Real content is not complete until Task 8, so exercise the script with fixtures by temporarily pointing at them:
```bash
cp content/hub.json dist/hub.real.json && cp test/fixtures/hub.json content/hub.json && cp test/fixtures/sources.json content/sources.json && node scripts/publish.mjs --dry; cp dist/hub.real.json content/hub.json && rm content/sources.json
```
Expected output ends with `decrypt verify PASS (... bytes)` then `--dry: skipping commit/push`. Confirm `content/hub.json` is restored: `node -p "require('./content/hub.json').title"` prints `Customer Insights Hub`.

- [ ] **Step 3: Remove the fixture-encrypted docs/index.html so it is never published**

Run: `rm docs/index.html` then `git status --short` (expected: only `scripts/publish.mjs` untracked).

- [ ] **Step 4: Commit**

```bash
git add scripts/publish.mjs
git commit -m "Add publish script: encrypt, decrypt-verify, commit, push

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Confirm dashboard passwords and Pages URLs

**Files:**
- none committed; produces facts used in Task 8

- [ ] **Step 1: Confirm each Pages URL resolves to an encrypted page**

```bash
for u in fbgrouppostsdashbpoard g2reviewsdashboard websitechatsdashboard marketingautomationresearchpresentation; do echo -n "$u: "; curl -s -o /dev/null -w '%{http_code}\n' "https://michaelhorwitzduda.github.io/$u/"; done
```
Expected: `200` for each. If one returns `404`, check the repo's Pages settings on GitHub (Settings, Pages, Deploy from branch) and confirm the branch and folder the dashboard repo uses; the URL is always `https://michaelhorwitzduda.github.io/<repo-name-lowercased>/`.

- [ ] **Step 2: Confirm each password decrypts its live page**

Run this Node snippet once per dashboard, substituting the URL and password (passwords are in the files listed):

| Dashboard | Password file |
|---|---|
| Facebook | `C:/Projects/FBGroupScraper3/output/PWDashboard.txt` |
| G2 | `C:/Projects/ConversationsAnalysis/G2Analysis/DashboardPW.txt` |
| Website chats | `C:/Projects/ConversationsAnalysis/Salespeak Analysis/dashboard/DashboardPW.txt` |
| Marketing automation | `C:/Projects/MarketingAutomationResearchPresentation/password.txt` |

```bash
node -e "
const [url, pw] = process.argv.slice(1);
const { webcrypto: c } = require('crypto');
fetch(url).then(r => r.text()).then(async html => {
  const m = html.match(/<pre[^>]*data-i=\"([^\"]+)\"[^>]*>([^<]+)<\/pre>/);
  if (!m) throw new Error('no payload');
  const b = Uint8Array.from(Buffer.from(m[2], 'base64'));
  const km = await c.subtle.importKey('raw', new TextEncoder().encode(pw.trim()), 'PBKDF2', false, ['deriveKey']);
  const k = await c.subtle.deriveKey({ name: 'PBKDF2', salt: b.slice(0,32), iterations: Number(m[1]), hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const t = new TextDecoder().decode(await c.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(32,48) }, k, b.slice(48)));
  console.log('OK', t.length, 'bytes');
}).catch(e => { console.log('FAIL', e.message); process.exit(1); });
" "https://michaelhorwitzduda.github.io/g2reviewsdashboard/" "$(cat 'C:/Projects/ConversationsAnalysis/G2Analysis/DashboardPW.txt')"
```
Expected: `OK <n> bytes` for all four. A `FAIL` means that dashboard was re-encrypted after the password file was written; ask the owner for the current password before Task 8.

---

### Task 8: Draft the real content

**Files:**
- Create: `content/sources.json` (gitignored)
- Modify: `content/hub.json` (set `intro` only; keep `hubPassword` and `slackWebhookUrl` as they are)

Source material to read for each card. Findings must be drawn from these files, quotes must be verbatim from them, and numbers must match what the files say.

| Key | Read for findings | Read for quotes | Coverage facts |
|---|---|---|---|
| `fb` | `C:/Projects/FBGroupScraper3/README.md`; `C:/Projects/FBGroupScraper3/output/dashboard-all.html` (data is inlined; search for the JSON blob); `C:/Projects/FBGroupScraper3/.scratch/dashboard-redesign/PRD.md` for what the dashboard shows | post and comment text in `output/<group id>/` markdown or JSON exports | count posts and date range from the exported bundle; dashboard last published 2026-07-12 |
| `g2` | `C:/Projects/ConversationsAnalysis/G2Analysis/DudaG2Reviews_InsightsReport.html` | `C:/Projects/ConversationsAnalysis/G2Analysis/DudaG2ReviewsParsed.json` fields `likeText`, `dislikeText`, `whySwitchedText`, with `role`, `companySize`, `starRating`, `date` for context | 845 reviews, 2016-01-14 to 2026-08-09 |
| `chats` | `C:/Projects/ConversationsAnalysis/Salespeak Analysis/duda-chat-insights-report-may2026.html` | `C:/Projects/ConversationsAnalysis/Salespeak Analysis/dashboard/sessions.json` field `userMsgs` or `transcript`, with `intent`, `country`, `date`, `acctSegment` for context; never include emails or names | 3,753 sessions, 2023-10-02 to 2026-05-28 |
| `ma` | `C:/Projects/MarketingAutomationResearch/SMBWebsites/FINDINGS.md` (Headlines section); `C:/Projects/MarketingAutomationResearch/CustomerWebsites/analysis/README.md`; `C:/Projects/MarketingAutomationResearch/README.md` (Key findings) | `C:/Projects/MarketingAutomationResearch/research-outputs/g2-verified-review-quotes-2026-06-30.md` (verbatim G2 quotes about competitors) | 1,567 agency/studio websites analyzed; 26,043 client sites scanned (22,236 on-platform); deck published Jul 2026 |

- [ ] **Step 1: Extract coverage facts and candidate quotes with scripts, not by eye**

G2 quotes, high-rated with substantive text:
```bash
node -e "
const r = require('C:/Projects/ConversationsAnalysis/G2Analysis/DudaG2ReviewsParsed.json');
const a = (Array.isArray(r) ? r : r.reviews).filter(x => x.starRating >= 4.5 && x.likeText && x.likeText.length > 120 && x.likeText.length < 400 && x.date >= '2025-01-01');
a.slice(0, 25).forEach(x => console.log(JSON.stringify({ text: x.likeText.trim(), context: [x.role, x.companySize, x.starRating + ' stars', x.date.slice(0,7)].filter(Boolean).join(', ') })));
"
```
Website chat quotes (visitor messages only, no PII):
```bash
node -e "
const s = require('C:/Projects/ConversationsAnalysis/Salespeak Analysis/dashboard/sessions.json');
const a = (Array.isArray(s) ? s : s.sessions).filter(x => x.intent === 'high' && Array.isArray(x.userMsgs));
a.slice(0, 40).forEach(x => { const m = x.userMsgs.find(u => u.length > 80 && u.length < 320 && !/@/.test(u)); if (m) console.log(JSON.stringify({ text: m.trim(), context: ['Website visitor', x.country, x.acctSegment, x.date.slice(0,7)].filter(Boolean).join(', ') })); });
"
```
Facebook: locate the exported bundle and count:
```bash
ls "C:/Projects/FBGroupScraper3/output/326562844046566"; ls "C:/Projects/FBGroupScraper3/output/dudasupport" 2>/dev/null
```
Then count posts and date range from whichever `posts.json` or CSV is present (adapt field names after inspecting the first record with `node -p "Object.keys(require('<file>')[0])"`).

- [ ] **Step 2: Write content/sources.json**

Four entries in this order: `fb`, `g2`, `chats`, `ma`. Use these fixed fields:

| key | name | icon | accent | url |
|---|---|---|---|---|
| fb | Facebook Group Posts | facebook | #1877F2 | https://michaelhorwitzduda.github.io/fbgrouppostsdashbpoard/ |
| g2 | G2 Reviews | star | #FF492C | https://michaelhorwitzduda.github.io/g2reviewsdashboard/ |
| chats | Website Chats | chat | #0F9D8A | https://michaelhorwitzduda.github.io/websitechatsdashboard/ |
| ma | Agency Websites: Marketing Automation Research | globe | #6C4BD8 | https://michaelhorwitzduda.github.io/marketingautomationresearchpresentation/ |

For each entry: `purpose` one sentence; `audience` both unless clearly one-sided; `coverage` from Step 1 and the table above, `lastRefreshed` as the date the dashboard was last published (ISO date); `bestFor` one sentence each; 3 to 5 `findings` each a single sentence with the number in it where the source gives one; 3 to 5 `quotes` verbatim, `context` without names or emails; `dashboard.password` from the files in Task 7.

Example shape of one entry (numbers illustrative, replace with extracted facts):
```json
{
  "key": "ma",
  "name": "Agency Websites: Marketing Automation Research",
  "icon": "globe",
  "accent": "#6C4BD8",
  "purpose": "What Duda agencies sell and which marketing automation tools actually run on their clients' sites, ahead of the September 2026 launch.",
  "audience": ["sales", "marketing"],
  "coverage": { "sampleSize": "1,567 agency sites + 22,236 client sites", "dateRange": "Jun to Jul 2026", "lastRefreshed": "2026-07-19" },
  "bestFor": { "sales": "Sizing the GoHighLevel threat and the native-MA opportunity for a given agency type.", "marketing": "Launch positioning against HubSpot, Mailchimp, GHL and website-builder bundles." },
  "findings": [
    "GoHighLevel is the most common third-party marketing platform on Duda SMB sites: 2.8% of sites and 13.3% of accounts have it on at least one site.",
    "38.5% of on-platform sites have a Duda native form and no third-party marketing automation stack detected, the white-space ceiling for native MA.",
    "Google Sheets forwarding is the single largest form integration at 3.3% of sites, showing that many SMBs' CRM is a spreadsheet."
  ],
  "quotes": [
    { "text": "Their email marketing is okay but not as good as Mailchimp/competitors that specialize in email; their CRM is better than nothing", "context": "Wix user on G2, Small-Business, Mar 2025" }
  ],
  "dashboard": { "url": "https://michaelhorwitzduda.github.io/marketingautomationresearchpresentation/", "password": "<from password.txt>" }
}
```

- [ ] **Step 3: Set the hub intro**

In `content/hub.json`, set `intro` to:
`What Duda customers say and do, in one place. Each card summarizes a data source and opens its full dashboard already unlocked. Copy a quote, cite a number, or send a request if you need something that is not here.`

- [ ] **Step 4: Build and preview**

Run: `npm run build`
Expected: `built C:\Projects\CustomerInsightsHub\dist\hub.html`. Fix any validation error it reports.
Open `dist/hub.html` in the Browser pane and read every card. Check: numbers match the source files, quotes contain no names or emails, each "Open dashboard" opens its dashboard already decrypted.

- [ ] **Step 5: Owner review**

Send `dist/hub.html` to the owner with SendUserFile and ask them to review findings and quotes before publishing. Apply their edits to `content/sources.json` and rebuild. Nothing to commit (content is gitignored).

---

### Task 9: README and GitHub Pages

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README.md**

```markdown
# Customer Insights Hub (password-protected)

One page for Duda sales and marketing that summarizes our customer-insight
sources and opens each dashboard in one click. `docs/index.html` is the only
published file: a self-contained page encrypted client-side with
[pagecrypt](https://github.com/Greenheart/pagecrypt) (AES-GCM via WebCrypto).
Nothing here is readable without the hub password, which is **not** stored in
this repo.

Live: https://michaelhorwitzduda.github.io/customerinsightshub/

## Sources linked from the hub

| Source | Dashboard repo |
|---|---|
| Facebook group posts | michaelhorwitzduda/FBGroupPostsDashbpoard |
| G2 reviews | michaelhorwitzduda/G2reviewsDashboard |
| Website chats (Salespeak) | michaelhorwitzduda/websitechatsdashboard |
| Agency websites / marketing automation | michaelhorwitzduda/MarketingAutomationResearchPresentation |

Each card's "Open dashboard" button is a pagecrypt magic link (`<url>#<password>`),
so anyone who has unlocked the hub can open the dashboards without typing
another password.

## Layout

- `content/` (gitignored, except the `*.example.json` files): `hub.json` holds
  the hub password, Slack webhook and intro; `sources.json` holds every card's
  text, quotes, dashboard URL and dashboard password. Copy the example files to
  start from scratch.
- `src/template.html` is the page; `src/build.mjs` injects content into it;
  `src/validate.mjs` rejects missing fields and placeholders.
- `scripts/publish.mjs` builds, tests, encrypts, verifies the result decrypts,
  and commits + pushes `docs/index.html`.
- `test/` runs with `npm test` against fixture content.

## Refreshing

Edit content, preview, publish:

```bash
npm run build          # writes dist/hub.html (unencrypted) for a local look
npm run release        # build + test + encrypt + verify + commit + push
```

`npm run release -- --dry` does everything except commit and push.

**A dashboard was re-encrypted** (each pagecrypt run makes a new password):
update that source's `dashboard.password` in `content/sources.json`, then
`npm run release`. The hub password itself does not change between publishes,
so the team's link and password stay valid.

## Feedback form

The "Request or feedback" form posts `{type, source, name, message}` to a Slack
Workflow Builder webhook (no Slack app required). The request is sent as a
`text/plain` body so the browser can read Slack's `{"ok":true}` confirmation
without a CORS preflight. If Slack cannot be reached, the form offers a
prefilled email to the owner instead.

## GitHub Pages

Settings → Pages → Deploy from a branch → `main` / `/docs`. Only
`docs/index.html` is served; source files are never published unencrypted.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Add README with refresh workflow and Pages setup

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push
```

- [ ] **Step 3: Enable GitHub Pages**

`gh` is not authenticated on this machine, so this is a manual step for the owner: open https://github.com/michaelhorwitzduda/customerinsightshub/settings/pages, choose Deploy from a branch, branch `main`, folder `/docs`, Save. Pages needs `docs/index.html` to exist, so do this after Task 10 Step 1 or accept a 404 until then.

---

### Task 10: First publish and manual checklist

- [ ] **Step 1: Publish**

Run: `npm run release`
Expected: `building…`, `testing…` with all tests passing, `encrypting…`, `decrypt verify PASS (...)`, `published + pushed.`

- [ ] **Step 2: Wait for Pages, then check**

Run until it returns 200 (Pages usually takes 1 to 2 minutes):
```bash
curl -s -o /dev/null -w '%{http_code}\n' https://michaelhorwitzduda.github.io/customerinsightshub/
```

- [ ] **Step 3: Browser checklist**

Open the live URL in the Browser pane and work through:
1. Enter the hub password from `content/hub.json`. Page renders with four cards.
2. Click each "Open dashboard". Each opens in a new tab already decrypted. If one prompts for a password, that dashboard's password in `content/sources.json` is stale.
3. Expand findings and quotes on one card; click Copy on a quote; paste into the browser address bar to confirm the `"text" — context` format.
4. Open the feedback form, submit a test with type Idea and source General. Confirm the "Sent" state, then confirm the message in Slack shows all four fields.
5. Resize to 375px wide. Cards stack in one column, no horizontal scroll, the floating button does not cover the last card's buttons when scrolled to the bottom.

- [ ] **Step 4: Hand off**

Tell the owner: the live URL, that the hub password is in `content/hub.json` on this machine and should be shared with the team over a private channel, and that the magic link form `https://michaelhorwitzduda.github.io/customerinsightshub/#<hubPassword>` skips the prompt but leaves the password in browser history.

---

## Self-review against the spec

- Access model with one hub password and magic links: Tasks 3, 6, 8, 10.
- Slack Workflow webhook with four variables, text/plain simple request, mailto fallback: Tasks 4, 5.
- Card content depth (purpose, coverage, best-for, findings, quotes with copy): Tasks 4, 8.
- Validation rules incl. placeholder markers and https URLs: Task 2. The `...` marker is treated as a whole-field placeholder so verbatim quotes containing ellipses are not rejected; angle-bracket placeholders are matched as `<...>` tokens.
- Publish refuses on dirty tree, runs tests, encrypts with fixed password, decrypt-verifies, commits `Publish hub <date>`: Task 6.
- Tests listed in the spec: Task 3 (`build.test.mjs`) covers names, magic links, no leaked passwords, no placeholders, webhook once, hub password absent.
- Manual checklist: Task 10.
- README refresh workflow and Pages: Task 9.
- Out of scope items are not implemented anywhere.
