---
name: slides-design
description: Use when designing, adding, or modifying slides in this minimalism deck. Documents every layout (cover, outline, chapter divider, standard h2, h3 sub-section, two-column, picture-with-caption), when to pick each, content-density ceilings (auto-fit floor, table row counts, image sizing), and the single-typeface / three-value / one-scale design system. Reference BEFORE introducing a new layout, color, font weight, or component — the deck is a coherent system, not a toolbox.
---

# Slides Design Guide

This deck is **one design system**, not a collection of slide templates. Every layout, color, font weight, and spacing rule earns its place. Before adding anything new, check whether an existing element solves the problem.

## The non-negotiables

| Concept | Rule |
|---|---|
| Typeface | **Roboto Mono only** (300 / 400 / 500 / 600 / 700). CJK falls back to PingFang TC / Noto Sans CJK TC / Hiragino Sans GB / Microsoft JhengHei. **Never add another typeface.** |
| Color | **Three values only**: `--bg #fff`, `--ink #111`, `--muted #666`, `--rule #999`. No accent colors, no semantic colors (red/green), no gradients, no shadows. |
| Master scale | `html { font-size: max(28px, 3.6vmin) }`. Everything sizes from this single rem base. **Don't introduce fixed px sizes** unless the element must not scale (page number, chapter menu). |
| Motion | Instant cut between slides. **No transitions, no animations.** Progress bar gives feedback instead. |
| Print | `@page 1920px × 1080px` (virtual 1080p screen, so the same `rem/vh/vw` values render 1:1 in PDF and on screen). No html font-size override — formula runs at the print viewport. `make pdf` uses headless Chrome. |

## Layout catalog

### 1. Cover (slide 1)

```html
<section>
  <h1>Deck Title</h1>
  <h6>subtitle in gray</h6>
  <p class="author">
    <a href="...">Name 中文名</a>
    <span class="sep">·</span>
    Affiliation
    <br>
    <a href="mailto:...">contact@…</a>
  </p>
</section>
```

- **When**: the first slide, always.
- **What gets auto-applied**: `class="divider"` (added by JS because first heading is h1), centered both axes.
- **What gets auto-hidden**: chapter menu (`body.cover`), page number (`body.cover`). Progress bar stays.
- **Limit**: only one cover per deck. Author block uses 0.75rem mono.

### 2. Outline (slide 2)

```html
<section class="outline"></section>
```

- **When**: directly after the cover, as slide 2. One per deck.
- **Auto-generated**: JS reads `chapters[]` (every `<h1>`), skips the first one (the cover), renders a 2-column grid: `OUTLINE` label on the left + numbered hash-linked list on the right.
- **Don't add content** — JS replaces the section's `innerHTML`.
- **Limit**: practical ceiling ~8 chapters. Beyond that, the list wraps and the slide feels heavy.

### 3. Chapter divider (`<h1>` only)

```html
<section>
  <h1>Part Two</h1>
  <h6>operating it</h6>
  <footer>Citation.</footer>
</section>
```

- **When**: marking the boundary between chapters. Auto-adds `.divider` (centered both axes).
- **Side effects**: appears in the chapter menu, **resets the h3 breadcrumb trace-back** (h3 won't walk past an h1).
- **Limit**: keep h1 text to 1–3 words. Long h1 wraps poorly when centered. No body content under h1 dividers — they're punctuation, not content.

### 4. Standard content slide (`<h2>`)

```html
<section>
  <h2>What we keep</h2>
  <h6>three things, nothing else</h6>
  <ul>
    <li>…</li>
    <li>…</li>
  </ul>
  <footer>Citation.</footer>
</section>
```

- **When**: 90% of the deck. Default content layout.
- **Layout**: top-left anchored title + subtitle, body flows below, citation pinned bottom-left.
- **Limits** (auto-fit shrinks to 0.4× before clipping):
  - `<ul>` / `<ol>` — ~12 items at 1920×1080, ~20 with shrinking.
  - `<p>` — ~3 short paragraphs.
  - `<table>` — ~10 rows × 4 columns.
  - `<dl>` — ~6 term/definition pairs.
  - `<pre>` — ~15 lines, prefer to split if longer.
- **Need more?** Split into two slides or use h3 to continue under the same h2 banner.

### 5. h3 sub-section (auto-breadcrumb)

```html
<section>
  <h3>Keyboard</h3>
  <h6>everything from the keys</h6>
  …
</section>
```

- **When**: extending the previous h2 within the same chapter.
- **Auto**: JS walks back through prior sections, stops at any `<h1>`, picks up the nearest `<h2>`, and prepends `Parent · ` in gray before the h3 text. Renders as `Parent · Keyboard`.
- **Trace rule**: parent must be an h2 in the **same chapter** (between the same pair of h1s).
- **Limit**: title kept short — `Parent · Title` must fit one line.

### 6. Two columns (`.cols`)

```html
<section>
  <h2>Two columns, when needed</h2>
  <h6>compare, contrast</h6>
  <div class="cols">
    <div>
      <h5>Kept</h5>
      <ul>…</ul>
    </div>
    <div>
      <h5>Removed</h5>
      <ul>…</ul>
    </div>
  </div>
  <footer>Citation.</footer>
</section>
```

- **When**: comparing two short sets (kept/removed, before/after, pros/cons). Divider sits at the horizontal center of the content area.
- **Column headings**: `<h5>` (1rem, weight 600, black). Don't use h2 or h6.
- **Limit**: ~6 items per column. Past that, columns desync vertically and the slide reads worse than one ordered list.

### 7. Picture with caption (`.pic-caption`)

```html
<section class="pic-caption">
  <div class="pic-caption-text">
    <h2>Title</h2>
    <h6>subtitle</h6>
    <p>Short description.</p>
  </div>
  <figure class="pic-caption-image">
    <img src="…" alt="…">
    <figcaption>Caption.</figcaption>
  </figure>
  <footer>Citation.</footer>
</section>
```

- **When**: a single hero shot, screenshot, or diagram with explanatory text.
- **Layout**: flex-row. Text left (`flex: 1`, body at `0.8em` to balance the image), figure right (`flex: 1.2`).
- **Image**: hairline gray border, native 16:9 works best. SVG or `<img>` both fine.
- **Caption** (`<figcaption>`): 0.75em, muted gray, no em-dash prefix.
- **Limit**: one image per slide. Very tall images (portrait orientation) break the visual balance — crop to 16:9-ish or use vertical centering.

## Components within slides

### Blockquote — single quote with attribution
```html
<blockquote>
  <p>Less, but better.</p>
  <cite>Dieter Rams</cite>
</blockquote>
```
Left hairline rule. Larger quoted text (1.5em), light weight (300). `<cite>` auto-prefixed with `— ` and muted.

### Callout — bracketed aside
```html
<aside class="callout">
  <span class="callout-label">Note</span>
  <p>One-paragraph aside. Multi-paragraph fine too.</p>
</aside>
<aside class="callout warn">
  <span class="callout-label">Warn</span>
  <p>Heavier top rule (ink instead of muted gray).</p>
</aside>
```
Hairline rules top + bottom, uppercase label inline before first paragraph. Use sparingly (≤2 per slide).

### Code block — bare, no highlighting
```html
<pre><code>--pad-x: 8vw;
--pad-y: 12vh;</code></pre>
```
Left hairline rule, 0.9em mono. No syntax highlighting (intentional).

### Definition list — keys + values
```html
<dl>
  <dt>→  ↓  PgDn  Space</dt><dd>Next slide</dd>
  <dt>Home / End</dt><dd>First / last</dd>
</dl>
```
Two-column grid. Term in ink, definition in muted gray. Ideal for keyboard refs, glossaries, key/value pairs.

### Table — horizontal rules only
```html
<table>
  <thead>
    <tr><th>screen</th><th class="num">1 rem</th></tr>
  </thead>
  <tbody>
    <tr><td>1920 × 1080</td><td class="num">39 px</td></tr>
  </tbody>
  <caption>Optional caption, em-dash prefixed, muted.</caption>
</table>
```
- Header underlined in ink, body rows hairline gray, last row closed in ink.
- `.num` class on `<th>` / `<td>` for right-aligned tabular figures.
- Max ~10 rows × 4 cols before auto-fit struggles.

### Citation footer (every content slide)
```html
<footer>Author. Title. Publisher; Year.</footer>
```
Bottom-left, 0.5rem muted, one line with ellipsis on overflow. AMA style or whatever your field expects. Skipped on cover.

## Subtitle (`<h6>`) rules

- Sits directly under every title (h1/h2/h3). JS injects an empty `<h6>` if you omit one, so vertical rhythm stays consistent.
- 0.75rem, weight 600, gray (`var(--rule)`), no em-dash prefix.
- Phrase as **lowercase fragment** (no period): `three things, nothing else`, not `Three things, nothing else.`

## Sizing reference

At common viewport heights (vmin = height in 16:9 landscape):

| Viewport | `1rem` | h1 (2rem) | h2 (1.6rem) | h3 (1.4rem) | h6 (0.75rem) | page no. (0.5rem) |
|---|---|---|---|---|---|---|
| 1366×768  | 28px (floor) | 56px | 45px | 39px | 21px | 14px |
| 1920×1080 | 39px | 78px | 62px | 55px | 29px | 19px |
| 2560×1440 | 52px | 104px | 83px | 73px | 39px | 26px |
| 3840×2160 (4K) | 78px | 156px | 125px | 109px | 58px | 39px |

**The print PDF uses the `1920×1080` row.** `@page { size: 1920px 1080px }` makes every `rem`, `vh`, and `vw` resolve to the same pixel size in PDF as a 1080p screen. The PDF reader scales the page to whatever physical paper or display you put it on later. Auto-fit decisions made at this viewport are also identical between screen-at-1080p and print.

## Auto-fit

Body content (everything not h1/h2/h3/h6) shrinks via `--body-scale` per section when it would crash the citation footer. Floor is 0.4× (≈40% of base). Runs at load, fonts.ready, resize (debounced 150ms), `beforeprint`, `afterprint`.

If the floor still clips, the slide is **too dense** — split it. Two cleaner slides beat one cramped one.

## Anti-patterns

- ❌ A second typeface (sans-serif heading + mono body). One face, vary weight.
- ❌ Accent colors (blue links, red warnings). Use weight, border, or position instead.
- ❌ Animated transitions between slides. The progress bar communicates motion.
- ❌ Icons or emojis as decoration. Use type.
- ❌ Backgrounds, gradients, shadows, rounded corners.
- ❌ `<h4>` and `<h5>` for arbitrary subheadings. h5 is column-title only; h4 unused — keep it that way.
- ❌ A new section class because a slide "feels different". Either it fits an existing layout or it's the wrong content for this deck.
- ❌ Long h1 / h2 text that wraps. Compress to 1–4 words.
- ❌ Multiple consecutive h3 sub-sections per chapter without an h2 to anchor them.

## Quick decision tree

```
Is this the first slide?              → Cover
Is this the outline?                  → <section class="outline"></section>
Is this a chapter boundary?           → h1 divider, ≤3 words
Comparing two short sets?             → .cols
A hero image + explanation?           → .pic-caption
Extending a parent h2 in-chapter?     → h3 (auto breadcrumb)
Anything else?                        → Standard h2 content slide
Content doesn't fit even with auto-fit? → Split into two slides
```
