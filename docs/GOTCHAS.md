# Gotchas

Non-obvious traps we hit building this. Saving them so future-you doesn't re-discover the hard way.

## Git

### Global `*.html` exclusion silently dropped `index.html`

A user-level `~/.gitignore_global` with `*.html` made `git status` skip the project's HTML. `git ls-files --others --exclude-standard` showed it was ignored.

**Fix:** the project `.gitignore` re-includes them:

```
!*.html
```

## CSS — print

### Browsers strip background colors in print by default

The progress bar rendered fine on screen, disappeared in PDF.

**Fix:** add both prefixes on any element whose background must print:

```css
section {
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
```

User also has to keep "Background graphics" enabled in the print dialog (most modern browsers respect `print-color-adjust` automatically; legacy ones don't).

### `position: absolute` children can split off onto their own printed page

The progress bar (previously a `::before` at `bottom: 0`) ended up on a blank page *after* its parent section.

**Fix:** paint the bar as a layered `background-image` on the section itself. Backgrounds belong to the box and never page-break separately.

```css
section {
  background-image:
    linear-gradient(var(--rule), var(--rule)),
    linear-gradient(to right, var(--ink) 0 var(--progress, 0%),
                              transparent var(--progress, 0%) 100%);
  background-position: 0 calc(100% - 5px), 0 100%;
  background-size: 100% 1px, 100% 5px;
  background-repeat: no-repeat;
}
```

### `@page { margin: 0 }` requires "Default" or "None" in the print dialog

Chrome's "Custom margins" override `@page`. For the PDF-export workflow this is fine because `wrangler/headless --print-to-pdf` honours `@page`, but if a user prints from the browser dialog they need to pick **Default** (or None) margins to get the 16:9 layout.

### `body.cover` hid the chapter menu globally during `make pdf`

Headless Chrome loads `index.html` fresh → JS sets `i = 0` (cover slide) → adds `body.cover` → CSS hides `#chapters` → menu missing from **every** printed page (not just the cover).

**Fix:** scope the rule to screen only.

```css
@media screen {
  body.cover #chapters,
  body.cover #page-number { display: none; }
}
```

### `vmin` is viewport-relative, not element-relative

In print, `vmin` refers to the PDF page, not the screen. With `@page { size: 13.333in 7.5in }` the page is 720px tall, so `3.6vmin = 26px` — much smaller than the 39px we got on 1080p screen.

**Fix:** `@page { size: 1920px 1080px }`. Same `vmin` in both modes, identical layout. The PDF reader scales the page to whatever physical paper at print time.

### `display: none` elements still appear in `s.children`

`fitSections` used `[...s.children].filter(c => c !== footerEl)` to pick the last body element for overflow detection. Adding `<aside class="notes">` (display: none) broke the check because `aside.notes` was now "last" with `offsetTop = 0 → no overflow detected`.

**Fix:** filter computed `display: none` too.

```js
const bodyChildren = [...s.children].filter(
  (c) => c !== footerEl && getComputedStyle(c).display !== "none",
);
```

## Cloudflare Pages

### `_redirects` rewriting `/live → /index.html` returned 308 to `/`

Direct request to `/live` got a 308 redirect to the root instead of serving `index.html`. Cause unclear (Pages may special-case the rewrite to root or be confused by multiple multi-space separators in the file).

**Fix:** drop `_redirects` entirely. Generate physical HTML copies in the Makefile:

```make
MODE_PAGES := live.html presenter.html control.html

dist: ...
	@for f in $(MODE_PAGES); do cp $(DIST)/index.html $(DIST)/$$f; done
```

Pages then serves `/live` as `live.html` natively, no rewrite needed.

### `_redirects` itself is hidden from direct access

`curl https://<project>.pages.dev/_redirects` redirects you somewhere else; can't fetch the deployed file to debug. Trust the Wrangler upload log.

### Pages project must exist before `wrangler pages deploy`

First-ever deploy of a new project name fails with "Project not found". The CLI doesn't auto-create.

**Fix:** call `wrangler pages project create` (idempotent — failures swallowed) before deploy:

```make
page: dist
    wrangler pages project create $(PROJECT) --production-branch=$(BRANCH) 2>/dev/null || true
    wrangler pages deploy $(DIST) --project-name=$(PROJECT) --branch=$(BRANCH)
```

## Cloudflare Workers

### `compatibility_date` can't be in the future

Cloudflare's server rejects `compatibility_date = "2026-05-19"` even though that's today's date locally — their clock is older, or they parse strictly UTC. Pick a date a few months back.

```toml
compatibility_date = "2025-01-01"
```

### Routes need an existing DNS record; Custom Domain creates one for you

`[[routes]] pattern = "slides.hsiehting.com/*"` only matches requests already hitting Cloudflare. For a subdomain that doesn't yet resolve, you'd manually add a proxied A record first.

**Fix:** for whole-host binding, use Custom Domain — `wrangler` auto-creates the DNS record:

```toml
[[routes]]
pattern = "slides.hsiehting.com"
custom_domain = true
```

### `[[durable_objects.bindings]]` migration uses `new_sqlite_classes`

The default DO storage backend became SQLite in 2024. New classes go in `new_sqlite_classes`, not the older `new_classes`.

```toml
[[migrations]]
tag = "v1"
new_sqlite_classes = ["SessionDO"]
```

### Hibernation API has different message handlers

`state.acceptWebSocket(ws)` (not `ws.accept()`) makes the DO hibernate-aware. Handlers move from `ws.addEventListener("message", ...)` to instance methods:

```js
export class SessionDO {
  async fetch(req) {
    const pair = new WebSocketPair();
    this.state.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  webSocketMessage(ws, raw) { ... }
  webSocketClose(ws, code, reason, wasClean) { ... }
  webSocketError(ws, err) { ... }
}
```

Don't forget `state.getWebSockets()` to broadcast — it returns even hibernated sockets.

### `position: fixed` elements repeat on every printed page

Useful, but unintuitive — the chapter menu (fixed) automatically prints at the top of every PDF page once we stopped hiding it. No JS needed.

## JavaScript

### Top-level mode dispatch can hit `const` temporal dead zones

Calling the mode dispatcher near the top of `slides.js` looked harmless because the mode functions are declarations. But `presenterMode()` synchronously calls `setupPresenterPane()` before its first `await`, and that reads the `const timer = ...` object declared later in the file.

Result: `/presenter` threw `ReferenceError: Cannot access 'timer' before initialization` before the PIN prompt / WebSocket sync path could finish.

**Fix:** set `body.dataset.mode` early for CSS, but start the selected mode only at the end of the module, after all `const` singletons are initialized.

### Clamp shared slide state at the source, not only in each view

`initDeck().setCurrent()` clamps locally, but the Durable Object used to store unbounded indexes. Repeated "next" from `/control` at the final slide could push DO state past the real deck length. `/live` and `/presenter` visually clamped to the last slide while `/control` believed it had advanced, so the next shared update felt out of sync.

**Fix:** every controller sends its deck `total`; the DO clamps stored `current` to `0..total-1`, and clients avoid sending boundary no-ops.

### `URL` as a variable name shadows the global `URL` constructor

Trivial-looking but cost us a debug cycle:

```js
const URL = 'wss://example.com';
new URL(...);  // TypeError: URL is not a constructor
```

Use any other name: `WSURL`, `wsUrl`, `endpoint`, …

### HTTP/2 strips `Connection: Upgrade` for WebSocket handshakes

```sh
curl -i -H "Connection: Upgrade" ...   # → HTTP/2 200, NOT a WS handshake
curl --http1.1 -i -H "Connection: Upgrade" ...   # → HTTP/1.1 101 Switching Protocols
```

Browsers do this transparently via HTTP/2 extended CONNECT (RFC 8441). Only relevant when testing from a CLI.

### CSS specificity beats source order

`#remote button:active` (1,1,1) beats `#remote-prev:active` (1,1,0) regardless of where they appear. Spent a few minutes wondering why the prev button wouldn't invert on press.

**Fix:** remove the broad rule and write per-element rules, OR bump specificity (`#remote #remote-prev:active`).

## Tooling / shell

### `rip` doesn't accept `-f`

The user's CLAUDE.md says "use rip not rm". But:

```sh
rip -f file.pdf    # error: unexpected -f
rip file.pdf       # works, no flag needed
```

### Shell sandbox blocks outbound HTTPS (mostly)

`curl` / `node fetch` to external hosts often fails silently in this dev environment. `dig` (UDP) works fine. Real workaround used for testing: write to `/tmp` with `-o`, use `/usr/bin/curl --max-time 5`, or run from outside the sandbox.

### `wrangler tail` is a fast smoke-test

For debugging routing / DO behaviour without a browser, `wrangler tail --config worker.toml` streams Worker logs in real time. Pair with `curl` from a normal terminal to see exactly what your code is doing.
