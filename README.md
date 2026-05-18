# Minimalism Slides

A self-contained presentation deck — pure HTML, CSS, JS. No build step, no framework, no dependencies beyond Roboto Mono from Google Fonts.

**Live demo:** [slides.hsiehting.com/minimalism-slides/](https://slides.hsiehting.com/minimalism-slides/#/1)

## Open

    open index.html

Or serve over HTTP if you prefer:

    make serve            # python3 -m http.server 8000

## Export to PDF

    make pdf              # slides.pdf via headless Chrome
    make watch            # rebuild on save (needs watchexec)
    make clean            # remove slides.pdf and dist/

The Makefile shells out to headless Chrome with `--print-to-pdf`. The PDF is rendered at `@page { size: 1920px 1080px }` (virtual 1080p screen) so every `rem`, `vh`, and `vw` resolves identically to the on-screen layout — the PDF is pixel-equivalent to a 1080p browser viewport. The reader scales the page to whatever physical paper or display you put it on later.

## Deploy to Cloudflare Pages

First-time setup — copy the example configs (which are git-tracked) into the real ones (which are git-ignored because they contain your domain):

    cp slides.example.json slides.json
    cp worker.example.toml worker.toml
    # then edit both to point at your Cloudflare account / domain

Then:

    make dist             # bundle index.html + styles.css + slides.js into dist/
    make page             # deploy dist/ to Cloudflare Pages, print live URL

`slides.json` holds the deploy config:

```json
{
  "slug": "your-slug",
  "title": "Your Deck Title",
  "project": "your-pages-project",
  "domain": "slides.yourdomain.com",
  "branch": "main"
}
```

`make page` reads `slug` / `project` / `branch` and runs:

    wrangler pages deploy dist --project-name=$PROJECT --branch=$BRANCH

then prints the path-prefixed URL `https://$DOMAIN/$SLUG/`. (`make page` also auto-creates the Pages project if it doesn't exist yet.)

Path routing — `slides.hsiehting.com/<slug>` → `<slug>.pages.dev` — is handled by a separate Cloudflare Worker (see `worker.js`):

    make worker           # wrangler deploy --config worker.toml

One-time after the first `make worker`: in the Cloudflare dashboard, attach the route `slides.hsiehting.com/*` to the `slides-router` worker (Workers & Pages → slides-router → Triggers → Routes). Or uncomment the `[[routes]]` block in `worker.toml` and re-run `make worker`.

Prerequisites: `jq`, `wrangler` (`npm i -g wrangler`), and either `wrangler login` or a `CLOUDFLARE_API_TOKEN` env var.

## Controls

| Keys                       | Action                |
| -------------------------- | --------------------- |
| → ↓ PgDn Space             | Next slide            |
| ← ↑ PgUp Shift+Space       | Previous slide        |
| Home / End                 | First / last slide    |
| o / Esc                    | Toggle overview grid  |
| Cmd/Ctrl + P               | Print, one per page   |

Touch: swipe left / right on mobile. The URL hash (`#/3`) reflects the current slide and is restored on reload.

## Authoring

Each slide is one `<section>` inside `<main id="deck">`. Read **`.claude/skills/slides-design/SKILL.md`** for the full layout catalog, decision tree, and density limits before adding new slides.

Quick conventions:

- `<h1>` — chapter divider, centered. Also feeds the auto-generated chapter menu and outline page.
- `<h2>` — standard content slide, left-aligned.
- `<h3>` — sub-section. Auto-prepends the closest preceding `<h2>` within the same chapter as a `Parent · Title` breadcrumb.
- `<h5>` — column title inside `<div class="cols">`.
- `<h6>` after a heading — subtitle (gray). If you omit it, JS injects an empty `<h6>` to preserve vertical rhythm.
- `<footer>` inside a section — per-slide AMA-style citation, bottom-left.

Available section classes:

- `<section class="outline"></section>` — auto-populated outline page (place it second, JS replaces its contents with a numbered list of every `<h1>` after the cover).
- `<section class="pic-caption">` — text-left + figure-right two-column layout.

Components inside slides: `<p>`, `<ul>`, `<ol>`, `<dl>`, `<pre><code>`, `<blockquote><cite>`, `<aside class="callout">` / `.callout.warn`, `<table>` (with `.num` for right-aligned numeric columns), `<div class="cols">`.

To add a slide, drop a new `<section>` into `index.html`. No registration step.

## Design rules

- Type: [Roboto Mono](https://fonts.google.com/specimen/Roboto+Mono), weights 300 / 400 / 500 / 600 / 700.
- Colors: `#fff`, `#111`, `#666`, `#999`. Nothing else.
- Master scale: `html { font-size: max(28px, 3.6vmin) }`. Every other size in `rem` or `em` so the whole deck scales from this one knob.
- Progress bar: 5px, bottom edge, black fill on a hairline rule.
- Page number: `03 / 17`, bottom-right, muted gray.
- Auto-fit: body content shrinks per slide via `--body-scale` (floor 0.4) so dense slides stay above the citation footer. Runs on load, resize, and `beforeprint`/`afterprint`.

## Files

    index.html       markup — one <section> per slide
    styles.css       typography, layout, overview grid, print rules
    slides.js        navigation, hash routing, swipe, auto-fit, outline injection
    slides.example.json    template — copy to slides.json before deploying
    worker.example.toml    template — copy to worker.toml before deploying
    worker.js              Cloudflare Worker — path router for your apex
    slides.json            (gitignored) actual deploy config
    worker.toml            (gitignored) actual wrangler config
    Makefile         make pdf / serve / watch / dist / page / worker / clean
    CLAUDE.md        directs future Claude sessions to the design skill
    .claude/skills/
      slides-design/
        SKILL.md     full layout catalog, sizing reference, anti-patterns
    .gitignore       excludes .DS_Store, *.pdf, dist/, .wrangler/
