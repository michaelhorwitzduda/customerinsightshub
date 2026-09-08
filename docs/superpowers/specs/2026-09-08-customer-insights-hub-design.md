# Customer Insights Hub — Design

**Date:** 2026-09-08
**Owner:** Michael Horwitz
**Audience of the hub:** Duda sales and marketing
**Repo:** https://github.com/michaelhorwitzduda/customerinsightshub

## Purpose

A single, password-protected page that gives sales and marketing a fast overview of
Duda's customer-insight data sources, lets them open each underlying dashboard in
one click, and gives them a way to send requests and feedback to the owner.

Sources in scope for v1:

| Key | Source | Underlying dashboard repo |
|---|---|---|
| `fb` | Facebook group posts | `michaelhorwitzduda/FBGroupPostsDashbpoard` |
| `g2` | G2 reviews | `michaelhorwitzduda/G2reviewsDashboard` |
| `chats` | Website chats (Salespeak) | `michaelhorwitzduda/websitechatsdashboard` |
| `ma` | Agency websites / marketing automation research | `michaelhorwitzduda/MarketingAutomationResearchPresentation` |

## Decisions made

1. **Access model:** the hub is a single pagecrypt-encrypted HTML file with one
   password shared with the team. Inside, each dashboard opens via its pagecrypt
   magic link (`<url>#<password>`), so users unlock everything once. Raw
   dashboard passwords never sit in plaintext in the repo.
2. **Feedback channel:** a form in the hub posts to a Slack Workflow Builder
   webhook trigger (no Slack app install needed; confirmed working 2026-09-08).
   The workflow formats and posts the message. Fallback is a prefilled `mailto:` link.
3. **Depth of content:** each source card carries a description, coverage stats,
   3–5 headline findings, and 3–5 verbatim customer quotes. Deeper analysis lives
   in the linked dashboards.
4. **Approach:** static site on GitHub Pages, same pattern as the four
   dashboards. No frameworks, no CDN dependencies; the published file is fully
   self-contained.

## Architecture

```
CustomerInsightsHub/
  content/                 # gitignored except the *.example.json files
    sources.json           # the four sources (see schema)
    hub.json               # hub title, intro, hub password, Slack webhook URL, feedback categories
    sources.example.json   # committed, redacted example of the schema
    hub.example.json       # committed, redacted example
  src/
    template.html          # layout, styles, client-side JS; placeholders for injected data
    build.mjs              # content + template -> dist/hub.html (unencrypted preview)
  scripts/
    publish.mjs            # build -> pagecrypt encrypt -> docs/index.html -> verify decrypt -> git commit + push
  test/
    build.test.mjs         # node:test checks on the built HTML
  dist/                    # gitignored build output
  docs/
    index.html             # the only published file (encrypted). GitHub Pages serves /docs.
    superpowers/specs/     # this document
  README.md
  package.json
  .gitignore
```

### Content schema

`content/sources.json` is an array of source objects:

```json
{
  "key": "g2",
  "name": "G2 Reviews",
  "icon": "star",
  "accent": "#F5A623",
  "purpose": "What verified customers say publicly about Duda, by segment and rating.",
  "audience": ["sales", "marketing"],
  "coverage": {
    "sampleSize": "N reviews",
    "dateRange": "2019 – Apr 2026",
    "lastRefreshed": "2026-05-01"
  },
  "bestFor": {
    "sales": "Objection handling with third-party proof.",
    "marketing": "Messaging themes and competitor mentions."
  },
  "findings": ["...", "..."],
  "quotes": [
    { "text": "...", "context": "Agency owner, 11–50 employees, 5 stars, Mar 2026" }
  ],
  "dashboard": {
    "url": "https://michaelhorwitzduda.github.io/g2reviewsdashboard/",
    "password": "..."
  }
}
```

`content/hub.json`:

```json
{
  "title": "Customer Insights Hub",
  "intro": "...",
  "hubPassword": "...",
  "ownerName": "Michael Horwitz",
  "ownerEmail": "michael.horwitz@duda.co",
  "slackWebhookUrl": "https://hooks.slack.com/triggers/...",
  "feedbackTypes": ["Data request", "Question", "Bug", "Idea"]
}
```

Required fields: every field shown above. Build fails if any required field is
missing, empty, or contains a placeholder marker (`TODO`, `TBD`, `...`, `<`).

### Build (`src/build.mjs`)

1. Read and validate `content/*.json`.
2. For each source, compose the magic link `dashboard.url + '#' + encodeURIComponent(password)`.
3. Inject a JSON blob (sources with `dashboard.password` replaced by `dashboard.magicLink`,
   plus hub settings minus `hubPassword`) and the build date into `template.html`.
4. Write `dist/hub.html`.

The template renders the page from the injected JSON at load time with vanilla JS.

### Publish (`scripts/publish.mjs`)

1. Run the build and the test suite; abort on failure.
2. Encrypt `dist/hub.html` to `docs/index.html` with pagecrypt using the fixed
   `hubPassword` from `hub.json`, so the team's link stays valid across publishes.
3. Verify: decrypt `docs/index.html` in Node with the same password and confirm
   the plaintext contains the hub title.
4. Commit `docs/index.html` with message `Publish hub <date>` and push.

Refuse to publish if the working tree has uncommitted changes outside `docs/`
and `content/`, so published output always corresponds to committed source.

## Page structure

One scrolling page, three zones, responsive from phone to laptop.

**Header.** Title, one-paragraph intro, "Last updated <build date>", and a legend
for the two audience tags (Sales, Marketing).

**Source cards.** Responsive grid, one card per source:
- colored icon, name, purpose line, audience tags
- coverage row: sample size · date range · last refreshed
- primary button "Open dashboard" opening the magic link in a new tab with `rel=noopener`
- "Best for" lines for sales and marketing
- expandable "Key findings" list
- expandable "Quotes you can use" list; each quote has a copy button that copies
  `"<text>" — <context>` to the clipboard and shows a brief "Copied" state

**Feedback panel.** Sticky "Request or feedback" button opens a modal form:
type (select from `feedbackTypes`), related source (select, includes "General"),
message (textarea, required), your name (text, required). Submit POSTs to the
Slack workflow webhook a JSON body with exactly the four trigger variables:

```json
{ "type": "Idea", "source": "G2", "name": "Jane", "message": "..." }
```

The endpoint returns `access-control-allow-origin: *` but no allowed-headers
list, so the request is sent as a CORS *simple request*: `Content-Type:
text/plain` with the JSON string as body, which avoids a preflight and lets the
page read the response. Success is `HTTP 200` with `{"ok":true}`; the UI then
shows "Sent — thanks" and clears the form. If the request fails or the response
is not ok, the form shows a prefilled `mailto:` link to `ownerEmail` with the
same content, and the typed message is preserved. Implementation must verify
Slack accepts a `text/plain` body; if it does not, fall back to a `no-cors`
JSON POST (opaque response, assume sent on resolve).

Message formatting lives in the Slack workflow itself (a "Send a message" step
using the four variables), not in the hub.

**Design language.** Light, clean, generous whitespace, one accent color per
source, system font stack. All CSS and JS inline. No external requests other than
the Slack webhook on submit.

## Error handling

- Build: hard fail with a clear message on schema violations, malformed URLs,
  placeholder text, or a source with fewer than one finding or one quote.
- Publish: abort if build or tests fail, if decrypt-verify fails, or if the tree
  has stray uncommitted changes.
- Browser: form validation before send; mailto fallback on network failure;
  copy button falls back to a selectable text field if the Clipboard API is
  unavailable.

## Testing

`test/build.test.mjs` (node:test), run against `dist/hub.html`:
- every source name appears in the output
- every magic link is a valid URL whose fragment equals the encoded password
- no raw dashboard password appears anywhere except inside its own magic link
- no placeholder markers appear
- the Slack webhook URL appears exactly once
- `hubPassword` does not appear in the output

Manual checklist before sharing the link:
1. Open `docs/index.html` via GitHub Pages, enter the hub password.
2. Click each "Open dashboard" button; each dashboard should open already unlocked.
3. Copy one quote; paste to confirm format.
4. Send one test feedback message; confirm it arrives in Slack.
5. Check the page on a phone-width viewport.

## Refresh workflow (documented in README)

- **Content change:** edit `content/sources.json`, run the build and open
  `dist/hub.html` to preview, then run publish.
- **A dashboard was re-encrypted:** update that source's `dashboard.password`,
  then publish. Two minutes.
- **Initial content:** drafted from `ConversationsAnalysis/G2Analysis`,
  `ConversationsAnalysis/Salespeak Analysis`, `FBGroupScraper3`, and
  `MarketingAutomationResearch/SMBWebsites/FINDINGS.md`, then reviewed by the owner.

## Out of scope for v1

Cross-source themed synthesis, search, usage analytics, automatic extraction of
findings from the dashboards, storing feedback anywhere other than Slack.
