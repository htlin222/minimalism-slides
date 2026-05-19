// Entry point. Detects mode from URL path, branches behaviour.
//
//   /<slug>/            standalone   no WS, local nav
//   /<slug>/live        live         WS read-only, follows DO state
//   /<slug>/presenter   presenter    WS read+write, PIN-gated, keyboard sends commands
//   /<slug>/control     control      WS read+write, PIN-gated, minimal remote UI
//
// Pages serves index.html, live.html, presenter.html, control.html as separate
// files (Makefile generates the copies from index.html at deploy time).
import { initDeck } from "./core.js";

const KNOWN_MODES = ["live", "presenter", "control"];
const detectMode = () => {
	const segments = location.pathname.split("/").filter(Boolean);
	const last = segments.at(-1);
	return KNOWN_MODES.includes(last) ? last : "standalone";
};

const mode = detectMode();
document.body.dataset.mode = mode;
document.body.classList.add(`mode-${mode}`);

async function applyDeckMeta() {
	let meta;
	try {
		const res = await fetch("./slides.json");
		if (!res.ok) return;
		meta = await res.json();
	} catch { return; }
	if (!meta || typeof meta !== "object" || Array.isArray(meta)) return;

	if (meta.title) document.title = meta.title;

	const cover = document.getElementById("cover-slide");
	if (!cover) return;

	const h1 = cover.querySelector("h1");
	if (h1 && meta.title) h1.textContent = meta.title;

	const h6 = cover.querySelector("h6");
	if (h6 && meta.subtitle !== undefined) h6.textContent = meta.subtitle;

	const authorEl = cover.querySelector("p.author");
	if (authorEl && (meta.author || meta.affiliation || meta.email)) {
		authorEl.replaceChildren();

		if (meta.author) {
			let nameEl;
			if (meta.authorUrl && /^https?:\/\//i.test(meta.authorUrl)) {
				nameEl = document.createElement("a");
				nameEl.href = meta.authorUrl;
				nameEl.target = "_blank";
				nameEl.rel = "noopener";
			} else {
				nameEl = document.createElement("span");
			}
			nameEl.textContent = meta.author;
			authorEl.appendChild(nameEl);
			if (meta.affiliation) {
				const sep = document.createElement("span");
				sep.className = "sep";
				sep.textContent = "·";
				authorEl.appendChild(sep);
			}
		}

		if (meta.affiliation) {
			authorEl.appendChild(document.createTextNode(meta.affiliation));
		}

		if (meta.email) {
			if (meta.author || meta.affiliation) authorEl.appendChild(document.createElement("br"));
			const a = document.createElement("a");
			a.href = `mailto:${meta.email}`;
			a.textContent = meta.email;
			authorEl.appendChild(a);
		}
	}

	const deckFooter = document.getElementById("deck-footer");
	if (deckFooter && meta.footer) deckFooter.textContent = meta.footer;
}

// ---- WebSocket plumbing -------------------------------------------------

function wsUrl() {
	const u = new URL(location.href);
	u.pathname = u.pathname.replace(/\/[^/]*\/?$/, "/_ws");
	u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
	u.search = "";
	u.hash = "";
	return u;
}

function connect({ role, pin, total, onWelcome, onState, onDeny }) {
	let ws = null;
	let connected = false;

	const open = () => {
		ws = new WebSocket(wsUrl());
		ws.addEventListener("open", () => {
			const msg = { type: "hello", role, total };
			if (pin) msg.pin = pin;
			ws.send(JSON.stringify(msg));
		});
		ws.addEventListener("message", (e) => {
			let msg;
			try { msg = JSON.parse(e.data); } catch { return; }
			if (msg.type === "deny") {
				sessionStorage.removeItem("slides.pin");
				onDeny?.(msg.reason);
				return;
			}
			if (msg.type === "welcome") {
				connected = true;
				if (pin) sessionStorage.setItem("slides.pin", pin);
				document.body.classList.add("connected");
				onWelcome?.(msg);
				return;
			}
			if (msg.type === "state") onState?.(msg);
		});
		ws.addEventListener("close", (e) => {
			connected = false;
			document.body.classList.remove("connected");
			if (e.code === 4001) return; // bad PIN — caller handles
			setTimeout(open, 1500);       // auto-reconnect
		});
	};

	open();

	return {
		send: (m) => {
			if (!connected || !ws) return false;
			ws.send(JSON.stringify(m));
			return true;
		},
		isConnected: () => connected,
	};
}

// ---- Modes --------------------------------------------------------------

function liveMode() {
	const deck = initDeck({
		enableKeyboard: false,
		enableSwipe: false,
		enableHash: false,
		enableOverview: false,
	});
	if (!deck) return;
	connect({
		role: "live",
		total: deck.total,
		onWelcome: (m) => typeof m.current === "number" && deck.setCurrentSilent(m.current),
		onState: (m) => deck.setCurrentSilent(m.current),
	});
}

async function presenterMode() {
	const deck = initDeck({
		enableKeyboard: false,
		enableSwipe: false,
		enableHash: false,
		enableOverview: false,
	});
	if (!deck) return;

	setupPresenterPane(deck);

	const pin = sessionStorage.getItem("slides.pin") || (await promptForPin());

	const applyState = (n) => {
		deck.setCurrentSilent(n);
		updateNotesAndPreview(deck);
	};

	const conn = connect({
		role: "presenter",
		pin,
		total: deck.total,
		onWelcome: (m) => {
			hidePinPrompt();
			if (typeof m.current === "number") applyState(m.current);
		},
		onState: (m) => applyState(m.current),
		onDeny: async () => {
			const nextPin = await promptForPin("PIN rejected, try again");
			sessionStorage.setItem("slides.pin", nextPin);
			location.reload();
		},
	});

	// Move locally first, then broadcast if WS is live.
	const navigate = (delta, abs) => {
		const before = deck.getCurrent();
		if (abs !== null) deck.setCurrent(abs);
		else deck.go(delta);
		const after = deck.getCurrent();
		if (after === before) return;
		timer.start();
		updateNotesAndPreview(deck);
		if (conn.isConnected()) {
			conn.send({ type: "jump", index: after });
		}
	};

	document.querySelector("#presenter-prev")?.addEventListener("click", () => navigate(-1, null));
	document.querySelector("#presenter-next")?.addEventListener("click", () => navigate(+1, null));

	window.addEventListener("keydown", (e) => {
		if (e.target.matches("input, textarea, [contenteditable]")) return;
		if (e.key === "r" || e.key === "R") { timer.reset(); e.preventDefault(); return; }
		let abs = null;
		let delta = 0;
		switch (e.key) {
			case "ArrowRight": case "ArrowDown": case "PageDown": delta = +1; break;
			case "ArrowLeft":  case "ArrowUp":   case "PageUp":   delta = -1; break;
			case " ": delta = e.shiftKey ? -1 : +1; break;
			case "Home": abs = 0; break;
			case "End":  abs = deck.total - 1; break;
			case "o": case "O": document.body.classList.toggle("overview"); return;
			case "Escape": document.body.classList.remove("overview"); return;
			default: return;
		}
		e.preventDefault();
		navigate(delta, abs);
	});

	let startX = 0, startY = 0, tracking = false;
	window.addEventListener("pointerdown", (e) => {
		if (e.pointerType !== "touch") return;
		startX = e.clientX; startY = e.clientY; tracking = true;
	});
	window.addEventListener("pointerup", (e) => {
		if (!tracking) return;
		tracking = false;
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;
		if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
		navigate(dx < 0 ? +1 : -1, null);
	});

	// Tap-to-advance: click left half of the deck = prev, right half = next.
	const deckEl = document.querySelector("#deck");
	if (deckEl) {
		deckEl.addEventListener("click", (e) => {
			if (e.target.closest("a, button, input")) return;
			const rect = deckEl.getBoundingClientRect();
			const mid = rect.left + rect.width / 2;
			navigate(e.clientX < mid ? -1 : +1, null);
		});
	}

	// Chapter menu links set location.hash but initDeck runs with enableHash:false,
	// so the built-in hashchange listener is absent. Route hash jumps through navigate()
	// so the deck moves AND the DO is updated.
	window.addEventListener("hashchange", () => {
		const m = location.hash.match(/^#\/(\d+)$/);
		if (!m) return;
		const n = parseInt(m[1], 10) - 1;
		if (n >= 0 && n < deck.total) navigate(null, n);
	});
}

// ---- Presenter pane: timer, notes, next-slide preview ------------------

const timer = {
	startedAt: null,
	accumulated: 0,
	targetSeconds: 25 * 60,
	tickHandle: null,
	storageKey: "slides.timer",
	targetStorageKey: "slides.timer.targetSeconds",

	mount() {
		this.restore();
		this.bindTargetInput();
		this.render();
		this.tickHandle = setInterval(() => this.render(), 1000);
		const resetBtn = document.querySelector("#timer-reset");
		if (resetBtn) resetBtn.addEventListener("click", () => this.reset());
	},
	restore() {
		try {
			const saved = JSON.parse(sessionStorage.getItem(this.storageKey) || "null");
			if (saved && typeof saved === "object") {
				this.startedAt = saved.startedAt ?? null;
				this.accumulated = saved.accumulated ?? 0;
				if (typeof saved.targetSeconds === "number") this.targetSeconds = saved.targetSeconds;
			}
		} catch { /* ignore */ }
		const savedTarget = this.readStoredTarget();
		if (savedTarget !== null) this.targetSeconds = savedTarget;
	},
	save() {
		sessionStorage.setItem(this.storageKey, JSON.stringify({
			startedAt: this.startedAt,
			accumulated: this.accumulated,
		}));
	},
	readStoredTarget() {
		try {
			const saved = Number(localStorage.getItem(this.targetStorageKey));
			return Number.isFinite(saved) && saved > 0 ? Math.round(saved) : null;
		} catch {
			return null;
		}
	},
	saveTarget() {
		try {
			localStorage.setItem(this.targetStorageKey, String(this.targetSeconds));
		} catch { /* ignore */ }
	},
	parseTarget(value) {
		const raw = String(value).trim();
		if (!raw) return null;
		const match = raw.match(/^(\d{1,3})(?::([0-5]?\d))?$/);
		if (!match) return null;
		const minutes = Number(match[1]);
		const seconds = match[2] === undefined ? 0 : Number(match[2]);
		const total = minutes * 60 + seconds;
		return total > 0 ? Math.min(total, 999 * 60 + 59) : null;
	},
	setTarget(seconds) {
		this.targetSeconds = Math.round(seconds);
		this.saveTarget();
		this.render();
	},
	bindTargetInput() {
		const targetInput = document.querySelector("#timer-target");
		if (!(targetInput instanceof HTMLInputElement)) return;
		const commit = () => {
			const next = this.parseTarget(targetInput.value);
			if (next === null) {
				this.render();
				return;
			}
			this.setTarget(next);
		};
		targetInput.addEventListener("change", commit);
		targetInput.addEventListener("blur", commit);
		targetInput.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				targetInput.blur();
			}
			if (e.key === "Escape") {
				e.preventDefault();
				this.render();
				targetInput.blur();
			}
		});
	},
	start() {
		if (this.startedAt) return;
		this.startedAt = Date.now();
		this.save();
	},
	reset() {
		this.startedAt = null;
		this.accumulated = 0;
		this.save();
		this.render();
	},
	elapsedSeconds() {
		if (!this.startedAt) return this.accumulated;
		return this.accumulated + (Date.now() - this.startedAt) / 1000;
	},
	render() {
		const fmt = (s) => {
			const m = Math.floor(s / 60);
			const sec = Math.floor(s % 60);
			return String(m).padStart(2, "0") + ":" + String(sec).padStart(2, "0");
		};
		const elapsed = this.elapsedSeconds();
		const eEl = document.querySelector("#timer-elapsed");
		const tEl = document.querySelector("#timer-target");
		if (eEl) eEl.textContent = fmt(elapsed);
		if (tEl instanceof HTMLInputElement) {
			if (document.activeElement !== tEl) tEl.value = fmt(this.targetSeconds);
		} else if (tEl) {
			tEl.textContent = fmt(this.targetSeconds);
		}
		document.body.classList.toggle("overtime", elapsed > this.targetSeconds);
	},
};

function setupPresenterPane(deck) {
	const pane = document.querySelector("#presenter-pane");
	if (!pane) return;
	pane.hidden = false;
	timer.mount();
	updateNotesAndPreview(deck);
}

function updateNotesAndPreview(deck) {
	const sections = [...document.querySelectorAll("#deck > section")];
	const cur = sections[deck.getCurrent()];
	const next = sections[deck.getCurrent() + 1];

	// notes
	const notesEl = document.querySelector("#presenter-notes");
	if (notesEl) {
		const aside = cur?.querySelector(":scope > aside.notes");
		notesEl.textContent = aside ? aside.textContent.trim() : "";
	}

	// next slide preview — clone, scale via CSS class
	const preview = document.querySelector("#next-preview");
	if (preview) {
		preview.innerHTML = "";
		if (next) {
			const clone = next.cloneNode(true);
			clone.classList.add("preview", "active");
			preview.appendChild(clone);
		}
	}
}

async function controlMode() {
	const total = document.querySelectorAll("#deck > section").length;
	if (!total) return;

	const pad = (n) => String(n).padStart(2, "0");
	let current = 0;

	const remoteRoot = document.querySelector("#remote");
	const prev = document.querySelector("#remote-prev");
	const next = document.querySelector("#remote-next");
	const currentEl = document.querySelector("#remote-current");
	const totalEl = document.querySelector("#remote-total");

	remoteRoot.hidden = false;
	totalEl.textContent = pad(total);
	currentEl.textContent = pad(current + 1);

	const updateButtons = () => {
		prev.disabled = current <= 0;
		next.disabled = current >= total - 1;
	};

	const setCurrent = (n) => {
		current = Math.max(0, Math.min(total - 1, n));
		currentEl.textContent = pad(current + 1);
		updateButtons();
	};
	updateButtons();

	const pin = sessionStorage.getItem("slides.pin") || (await promptForPin());

	const conn = connect({
		role: "control",
		pin,
		total,
		onWelcome: (m) => { hidePinPrompt(); if (typeof m.current === "number") setCurrent(m.current); },
		onState: (m) => setCurrent(m.current),
		onDeny: async () => {
			const nextPin = await promptForPin("PIN rejected, try again");
			sessionStorage.setItem("slides.pin", nextPin);
			location.reload();
		},
	});

	prev.addEventListener("click", () => {
		if (current > 0 && conn.isConnected()) conn.send({ type: "go", delta: -1 });
	});
	next.addEventListener("click", () => {
		if (current < total - 1 && conn.isConnected()) conn.send({ type: "go", delta: +1 });
	});
}

// ---- PIN prompt ---------------------------------------------------------

function promptForPin(error = "") {
	showPinPrompt(error);
	const form = document.querySelector("#pin-form");
	const input = document.querySelector("#pin-input");
	input.value = "";
	return new Promise((resolve) => {
		const submit = (e) => {
			e.preventDefault();
			const pin = input.value.trim();
			if (!pin) return;
			form.removeEventListener("submit", submit);
			resolve(pin);
		};
		form.addEventListener("submit", submit);
	});
}

function showPinPrompt(error) {
	const overlay = document.querySelector("#pin-prompt");
	overlay.hidden = false;
	document.querySelector("#pin-error").textContent = error || "";
	requestAnimationFrame(() => document.querySelector("#pin-input").focus());
}

function hidePinPrompt() {
	document.querySelector("#pin-prompt").hidden = true;
	document.querySelector("#pin-error").textContent = "";
}

({
	standalone: async () => { await applyDeckMeta(); initDeck(); },
	live: () => liveMode(),
	presenter: () => presenterMode(),
	control: () => controlMode(),
})[mode]?.();
