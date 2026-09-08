# Customer Insights Hub (password-protected)

One page for Duda sales and marketing that summarizes our customer-insight
sources and opens each dashboard in one click. `docs/index.html` is the only
published file: a self-contained page encrypted client-side with
[pagecrypt](https://github.com/Greenheart/pagecrypt) (AES-GCM via WebCrypto,
PBKDF2 with 2,000,000 iterations). Nothing here is readable without the hub
password, which is **not** stored in this repo.

Live: https://michaelhorwitzduda.github.io/customerinsightshub/

## Sources linked from the hub

| Source | Dashboard repo |
|---|---|
| Facebook group posts | michaelhorwitzduda/FBGroupPostsDashboard |
| G2 reviews | michaelhorwitzduda/G2reviewsDashboard |
| Website chats (Salespeak) | michaelhorwitzduda/websitechatsdashboard |
| Agency websites / marketing automation | michaelhorwitzduda/MarketingAutomationResearchPresentation |

Each card's "Open dashboard" button is a pagecrypt magic link (`<url>#<password>`),
so anyone who has unlocked the hub can open the dashboards without typing
another password. GitHub Pages project URLs are case-sensitive; use the repo
name exactly as spelled above.

## Layout

- `content/` (gitignored, except the `*.example.json` files): `hub.json` holds
  the hub password, Slack webhook and intro; `sources.json` holds every card's
  text, quotes, dashboard URL and dashboard password. Copy the example files to
  start from scratch.
- `src/template.html` is the page; `src/build.mjs` injects content into it;
  `src/validate.mjs` rejects missing fields, placeholders, non-https URLs and
  bad colors before anything is rendered.
- `scripts/publish.mjs` runs the tests, builds, encrypts, verifies the result
  decrypts byte-for-byte, then commits and pushes `docs/index.html`.
- `test/` runs with `npm test` against fixture content in `test/fixtures/`.

## Refreshing

Edit content, preview, publish:

```bash
npm run build          # writes dist/hub.html (unencrypted) for a local look
npm run release        # test + build + encrypt + verify + commit + push
```

`npm run release -- --dry` does everything except commit and push; the verified
encrypted output goes to `dist/hub.encrypted.html` and the tracked tree is left
untouched. Publishing refuses to run while there are uncommitted changes
outside `docs/`, so the published page always matches a real commit.

**A dashboard was re-encrypted** (each pagecrypt run makes a new password):
update that source's `dashboard.password` in `content/sources.json`, then
`npm run release`. The hub password itself does not change between publishes,
so the team's link and password stay valid.

## Feedback form

The "Request or feedback" form posts `{type, source, name, message}` to a Slack
Workflow Builder webhook (no Slack app required; the workflow's trigger defines
those four text variables and a "Send a message" step formats them). The
request is sent as a `text/plain` body so the browser can read Slack's
`{"ok":true}` confirmation without a CORS preflight. If Slack cannot be
reached, the form offers a prefilled email to the owner instead and keeps the
typed message.

## GitHub Pages

Settings, Pages, Deploy from a branch, `main`, folder `/docs`. Only
`docs/index.html` is served; source files are never published unencrypted.
