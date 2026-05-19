// Shared deck setup + rendering. Imported by slides.js (standalone),
// live.js, presenter.js — anything that mounts the full <section>s.
// control.js doesn't use this; it has its own minimal markup.

export function initDeck(options = {}) {
	const {
		enableKeyboard = true,
		enableSwipe = true,
		enableHash = true,
		enableOverview = true,
		onSlideChange = null, // (newIndex) => void  — called on every i change
	} = options;

	const deck = document.querySelector("#deck");
	if (!deck) return null;
	const sections = [...deck.querySelectorAll(":scope > section")];
	const total = sections.length;
	const pageNumberEl = document.querySelector("#page-number");
	const progressFillEl = document.querySelector("#progress-fill");

	if (!total) return null;

	const pad = (n) => String(n).padStart(2, "0");
	const chapters = [];

	sections.forEach((s, idx) => {
		const firstHeading = s.querySelector("h1, h2, h3, h4, h5");
		if (firstHeading && firstHeading.tagName === "H1") {
			s.classList.add("divider");
			chapters.push({ idx, title: firstHeading.textContent.trim() });
		}
		if (firstHeading && firstHeading.tagName === "H3") {
			for (let j = idx - 1; j >= 0; j--) {
				if (sections[j].querySelector("h1")) break;
				const candidate = sections[j].querySelector("h2");
				if (candidate) {
					firstHeading.dataset.parent = candidate.textContent.trim();
					break;
				}
			}
		}
		if (firstHeading) {
			const next = firstHeading.nextElementSibling;
			if (!next || next.tagName !== "H6") {
				firstHeading.insertAdjacentElement(
					"afterend",
					document.createElement("h6"),
				);
			}
		}
		s.dataset.num = pad(idx + 1);
		s.dataset.total = pad(total);
		s.style.setProperty("--progress", ((idx + 1) / total) * 100 + "%");
	});

	const nav = document.createElement("nav");
	nav.id = "chapters";
	chapters.forEach((c) => {
		const a = document.createElement("a");
		a.href = `#/${c.idx + 1}`;
		a.textContent = c.title;
		a.dataset.idx = c.idx;
		nav.appendChild(a);
	});
	if (chapters.length)
		document.body.insertBefore(nav, document.body.firstChild);

	const outlineSection = document.querySelector("section.outline");
	if (outlineSection) {
		outlineSection.innerHTML = "";
		const grid = document.createElement("div");
		grid.className = "outline-grid";
		const label = document.createElement("div");
		label.className = "outline-label";
		label.textContent = "OUTLINE";
		grid.appendChild(label);
		const list = document.createElement("ol");
		list.className = "outline-list";
		chapters.slice(1).forEach((c) => {
			const li = document.createElement("li");
			const a = document.createElement("a");
			a.href = `#/${c.idx + 1}`;
			a.textContent = c.title;
			li.appendChild(a);
			list.appendChild(li);
		});
		grid.appendChild(list);
		outlineSection.appendChild(grid);
	}

	const navLinks = [...nav.querySelectorAll("a")];
	const activeChapterIdx = () => {
		let active = chapters.length ? chapters[0].idx : -1;
		for (const c of chapters) {
			if (c.idx <= i) active = c.idx;
			else break;
		}
		return active;
	};

	const readHash = () => {
		const m = location.hash.match(/^#\/(\d+)$/);
		if (!m) return null;
		const n = parseInt(m[1], 10) - 1;
		return n >= 0 && n < total ? n : null;
	};

	let i = (enableHash ? readHash() : null) ?? 0;
	let suppressHashSync = false;
	let suppressOnChange = false;

	const render = () => {
		sections.forEach((s, idx) => s.classList.toggle("active", idx === i));
		if (pageNumberEl) pageNumberEl.textContent = `${pad(i + 1)} / ${pad(total)}`;
		if (progressFillEl)
			progressFillEl.style.width = ((i + 1) / total) * 100 + "%";
		document.body.classList.toggle("cover", i === 0);
		const activeIdx = activeChapterIdx();
		navLinks.forEach((a) =>
			a.classList.toggle("active", Number(a.dataset.idx) === activeIdx),
		);
		if (enableHash) {
			const target = `#/${i + 1}`;
			if (location.hash !== target) {
				suppressHashSync = true;
				location.hash = target;
			}
		}
	};

	const setCurrent = (n, { silent = false } = {}) => {
		const next = Math.max(0, Math.min(total - 1, n));
		if (next === i) return;
		i = next;
		render();
		if (!silent && !suppressOnChange && onSlideChange) onSlideChange(i);
	};

	const setCurrentSilent = (n) => {
		suppressOnChange = true;
		setCurrent(n);
		suppressOnChange = false;
	};

	const go = (delta) => setCurrent(i + delta);

	if (enableKeyboard) {
		window.addEventListener("keydown", (e) => {
			if (e.target.matches("input, textarea, [contenteditable]")) return;
			switch (e.key) {
				case "ArrowRight":
				case "ArrowDown":
				case "PageDown":
					e.preventDefault();
					go(+1);
					break;
				case "ArrowLeft":
				case "ArrowUp":
				case "PageUp":
					e.preventDefault();
					go(-1);
					break;
				case " ":
					e.preventDefault();
					go(e.shiftKey ? -1 : +1);
					break;
				case "Home":
					e.preventDefault();
					setCurrent(0);
					break;
				case "End":
					e.preventDefault();
					setCurrent(total - 1);
					break;
				case "o":
				case "O":
					if (enableOverview) document.body.classList.toggle("overview");
					break;
				case "Escape":
					if (enableOverview) document.body.classList.remove("overview");
					break;
			}
		});
	}

	if (enableSwipe) {
		let startX = 0,
			startY = 0,
			tracking = false;
		window.addEventListener("pointerdown", (e) => {
			if (e.pointerType !== "touch") return;
			startX = e.clientX;
			startY = e.clientY;
			tracking = true;
		});
		window.addEventListener("pointerup", (e) => {
			if (!tracking) return;
			tracking = false;
			const dx = e.clientX - startX;
			const dy = e.clientY - startY;
			if (Math.abs(dx) < 50) return;
			if (Math.abs(dy) > Math.abs(dx)) return;
			go(dx < 0 ? +1 : -1);
		});
	}

	if (enableHash) {
		window.addEventListener("hashchange", () => {
			if (suppressHashSync) {
				suppressHashSync = false;
				return;
			}
			const n = readHash();
			if (n !== null && n !== i) setCurrent(n);
		});
	}

	if (enableOverview) {
		deck.addEventListener("click", (e) => {
			if (!document.body.classList.contains("overview")) return;
			const s = e.target.closest("section");
			if (!s) return;
			const idx = sections.indexOf(s);
			if (idx < 0) return;
			document.body.classList.remove("overview");
			setCurrent(idx);
		});
	}

	const fitSections = () => {
		sections.forEach((s) => {
			s.style.setProperty("--body-scale", "1");
			const wasInactive = !s.classList.contains("active");
			if (wasInactive) {
				s.style.display = "flex";
				s.style.visibility = "hidden";
			}

			const footerEl = s.querySelector(":scope > footer");
			const bodyChildren = [...s.children].filter(
				(c) => c !== footerEl && getComputedStyle(c).display !== "none",
			);
			const lastBody = bodyChildren[bodyChildren.length - 1];

			if (lastBody) {
				const reserveGap = 24;
				const minScale = 0.4;
				const step = 0.05;
				let scale = 1;
				const overflows = () => {
					const bodyBottom = lastBody.offsetTop + lastBody.offsetHeight;
					const limit = footerEl ? footerEl.offsetTop : s.clientHeight;
					return bodyBottom + reserveGap > limit;
				};
				while (scale > minScale && overflows()) {
					scale -= step;
					s.style.setProperty("--body-scale", scale.toFixed(2));
				}
			}

			if (wasInactive) {
				s.style.display = "";
				s.style.visibility = "";
			}
		});
	};

	let resizeTimer;
	window.addEventListener("resize", () => {
		clearTimeout(resizeTimer);
		resizeTimer = setTimeout(fitSections, 150);
	});

	if (document.fonts && document.fonts.ready) {
		document.fonts.ready.then(fitSections);
	} else {
		window.addEventListener("load", fitSections);
	}

	window.addEventListener("beforeprint", fitSections);
	window.addEventListener("afterprint", fitSections);

	render();
	fitSections();

	return {
		total,
		getCurrent: () => i,
		setCurrent,
		setCurrentSilent,
		go,
		render,
		fitSections,
	};
}
