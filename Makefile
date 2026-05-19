# Minimalism Slides
#
#   make pdf    →  slides.pdf, rendered by headless Chrome (honours @page,
#                  fires beforeprint so auto-fit runs)
#   make serve  →  http://localhost:8000 for live preview
#   make watch  →  rebuild slides.pdf on save (needs `watchexec`)
#   make dist   →  build dist/ with just the deck files for deploy
#   make page   →  deploy dist/ to Cloudflare Pages (slug/project from slides.json)
#   make worker →  deploy worker.js (path-based router for slides.hsiehting.com)
#   make preview→  preview.png — 3x3 thumbnail grid of slides 1-9 (for README)
#   make clean  →  remove slides.pdf, dist/, preview.png

PDF       := slides.pdf
SRC_DIR   := $(CURDIR)
INDEX     := index.html
DEPS      := index.html styles.css slides.js core.js
MODE_PAGES:= live.html presenter.html control.html
CONFIG    := slides.json
DIST      := dist

# Find a Chrome / Chromium binary on macOS or Linux.
# Override with `make pdf CHROME=/path/to/chrome` if needed.
CHROME ?= $(shell \
	if [ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then \
		echo "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"; \
	elif command -v google-chrome >/dev/null 2>&1; then \
		echo google-chrome; \
	elif command -v chromium >/dev/null 2>&1; then \
		echo chromium; \
	elif command -v chrome >/dev/null 2>&1; then \
		echo chrome; \
	fi)

.PHONY: all pdf serve watch dist page worker preview clean

all: pdf

pdf: $(PDF)

$(PDF): $(DEPS)
	@if [ -z "$(CHROME)" ]; then \
		echo "Chrome / Chromium not found. Install Google Chrome, or run:"; \
		echo "    make pdf CHROME=/path/to/chrome"; \
		exit 1; \
	fi
	@echo "Rendering $@ via $(CHROME)"
	"$(CHROME)" \
		--headless=new \
		--disable-gpu \
		--no-sandbox \
		--no-pdf-header-footer \
		--virtual-time-budget=10000 \
		--print-to-pdf="$(PDF)" \
		"file://$(SRC_DIR)/$(INDEX)"
	@echo "Wrote $(PDF) ($$(du -h $(PDF) | cut -f1))"

serve:
	@echo "Serving $(SRC_DIR) at http://localhost:8000"
	python3 -m http.server 8000

watch:
	@command -v watchexec >/dev/null 2>&1 || { echo "Install watchexec first (brew install watchexec)"; exit 1; }
	watchexec -e html,css,js -- $(MAKE) pdf

dist: $(DEPS) $(CONFIG)
	@command -v jq >/dev/null 2>&1 || { echo "Install jq first (brew install jq)"; exit 1; }
	@[ -f $(CONFIG) ] || { echo "Missing $(CONFIG)"; exit 1; }
	@rm -rf $(DIST)
	@mkdir -p $(DIST)
	@cp -- $(DEPS) $(DIST)/
	@for f in $(MODE_PAGES); do cp $(DIST)/index.html $(DIST)/$$f; done
	@echo "Built $(DIST)/ (slug: $$(jq -r .slug $(CONFIG)))"

page: dist
	@command -v wrangler >/dev/null 2>&1 || { echo "Install wrangler first: npm i -g wrangler"; exit 1; }
	@SLUG=$$(jq -r .slug $(CONFIG)); \
	PROJECT=$$(jq -r .project $(CONFIG)); \
	DOMAIN=$$(jq -r .domain $(CONFIG)); \
	BRANCH=$$(jq -r '.branch // "main"' $(CONFIG)); \
	wrangler pages project create $$PROJECT --production-branch=$$BRANCH >/dev/null 2>&1 || true; \
	echo "Deploying $(DIST)/ to Cloudflare Pages project '$$PROJECT' (branch: $$BRANCH)"; \
	wrangler pages deploy $(DIST) --project-name=$$PROJECT --branch=$$BRANCH --commit-dirty=true && \
	echo "" && \
	echo "Live at:  https://$$DOMAIN/$$SLUG/"

worker: worker.js worker.toml
	@command -v wrangler >/dev/null 2>&1 || { echo "Install wrangler first: npm i -g wrangler"; exit 1; }
	wrangler deploy --config worker.toml

preview: $(PDF)
	@command -v pdftocairo >/dev/null 2>&1 || { echo "Install poppler first (brew install poppler)"; exit 1; }
	@command -v montage >/dev/null 2>&1 || { echo "Install imagemagick first (brew install imagemagick)"; exit 1; }
	pdftocairo -png -scale-to 800 -f 1 -l 9 $(PDF) preview-page
	montage preview-page-*.png -tile 3x3 -geometry 500x+6+6 -background "#fff" preview.png
	@rm -f preview-page-*.png
	@echo "Wrote preview.png ($$(du -h preview.png | cut -f1))"

clean:
	@command -v rip >/dev/null 2>&1 && rip -f $(PDF) preview.png 2>/dev/null || rm -f $(PDF) preview.png
	@rm -rf $(DIST)
