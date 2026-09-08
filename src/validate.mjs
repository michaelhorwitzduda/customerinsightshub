// Validation for content/hub.json and content/sources.json.
// Every function throws an Error whose message names the offending field path.

const AUDIENCES = new Set(['sales', 'marketing']);

function isPlaceholder(str) {
  const t = str.trim();
  return t === '...' || /\bTODO\b|\bTBD\b/.test(t) || /<[^>]+>/.test(t) || /\bREPLACE(_WITH)?/i.test(t);
}

function requireString(obj, path, key) {
  const v = obj[key];
  const full = `${path}.${key}`;
  if (typeof v !== 'string' || v.trim() === '') throw new Error(`${full} is required and must be a non-empty string`);
  if (isPlaceholder(v)) {
    const shown = /password/i.test(String(key)) ? '[redacted]' : JSON.stringify(v);
    throw new Error(`${full} contains a placeholder marker: ${shown}`);
  }
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
  const dashboardUrl = requireHttpsUrl(s.dashboard, `${p}.dashboard`, 'url');
  if (new URL(dashboardUrl).hash) throw new Error(`${p}.dashboard.url must not contain a # fragment`);
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
