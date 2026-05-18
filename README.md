# Minimalism Slides

A self-contained presentation deck — pure HTML, CSS, JS. No build step, no framework, no dependencies beyond Roboto Mono from Google Fonts.

## Open

    open index.html

Or serve over HTTP if you prefer:

    make serve            # python3 -m http.server 8000

## Export to PDF

    make pdf              # slides.pdf via headless Chrome
    make watch            # rebuild on save (needs watchexec)
    make clean            # remove slides.pdf

The Makefile shells out to headless Chrome with `--print-to-pdf`, which fires
`beforeprint` and respects the `@page { size: 13.333in 7.5in }` rule, so the
PDF matches the on-screen 16:9 layout with auto-fit applied per slide.

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

Each slide is one `<section>` inside `<main id="deck">`. Conventions:

- `<h1>` — chapter divider, centered, full-screen.
- `<h2>` — standard content slide, left-aligned.
- `<h6>` directly after the heading — subtitle, gray. Optional; an empty slot is reserved automatically so vertical rhythm stays consistent across slides.
- Anything else (`<p>`, `<ul>`, `<ol>`, `<dl>`, `<pre>`, `<blockquote>`, `<div class="cols">`) inherits the same restrained type rules.

To add a slide, drop a new `<section>` into `index.html`. No registration step.

## Design rules

- Type: [Roboto Mono](https://fonts.google.com/specimen/Roboto+Mono), weights 300 / 400 / 500.
- Colors: `#fff`, `#111`, `#666`, `#999`. Nothing else.
- Progress bar: 10px, bottom edge, black fill on a hairline rule.
- Page number: `03 / 10`, bottom-right, muted gray.

## Files

    index.html    markup — one <section> per slide
    styles.css    typography, layout, overview grid, print rules
    slides.js     navigation, hash routing, swipe, overview toggle
