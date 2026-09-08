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
