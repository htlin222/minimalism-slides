# Minimalism Slides

Self-contained presentation deck — pure HTML/CSS/JS, no build.

## Before editing slides

**Read `.claude/skills/slides-design/SKILL.md` first.** It documents:

- Every available layout (cover, outline, chapter divider, standard, h3 sub-section, two columns, picture with caption)
- When to pick each layout and what it's optimised for
- Limitations and content-density ceilings (auto-fit floor, table row counts, image sizing)
- The deck's single-typeface / three-value / one-scale system (Roboto Mono, black/gray/white, master `font-size: max(28px, 3.6vmin)`)
- Components inside slides (blockquote, callout, table, dl, pre, .cols)
- Anti-patterns to avoid (extra fonts, colors, animations)

Do not introduce a new layout, color, font weight, or animation without first checking the skill — the deck is a single design system, not a kitchen sink.

## File layout

    index.html       markup — one <section> per slide
    styles.css       typography, layout, overview, print rules
    slides.js        navigation, hash routing, auto-fit, outline injection
    Makefile         `make pdf` / `make serve` / `make watch`
