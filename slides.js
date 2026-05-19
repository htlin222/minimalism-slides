// Entry point. Detects mode from URL path, branches behaviour.
//
//   /<slug>/            standalone   no WS, local nav
//   /<slug>/live        live         WS read-only, follows DO state
//   /<slug>/presenter   presenter    WS read+write, PIN-gated, keyboard sends commands
//   /<slug>/control     control      WS read+write, PIN-gated, minimal remote UI
//
// Pages serves the same index.html for every path under the slug (see _redirects).
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

({
	standalone: () => initDeck(),
	live: () => liveMode(),
	presenter: () => presenterMode(),
	control: () => controlMode(),
})[mode]?.();

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

	const pin = sessionStorage.getItem("slides.pin") || (await promptForPin());

	const conn = connect({
		role: "presenter",
		pin,
		total: deck.total,
		onWelcome: (m) => {
			hidePinPrompt();
			if (typeof m.current === "number") deck.setCurrentSilent(m.current);
		},
		onState: (m) => deck.setCurrentSilent(m.current),
		onDeny: async () => {
			const nextPin = await promptForPin("PIN rejected, try again");
			sessionStorage.setItem("slides.pin", nextPin);
			location.reload();
		},
	});

	window.addEventListener("keydown", (e) => {
		if (e.target.matches("input, textarea, [contenteditable]")) return;
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
		if (!conn.isConnected()) return;
		if (abs !== null) conn.send({ type: "jump", index: abs });
		else conn.send({ type: "go", delta });
	});

	let startX = 0, startY = 0, tracking = false;
	window.addEventListener("pointerdown", (e) => {
		if (e.pointerType !== "touch") return;
		startX = e.clientX; startY = e.clientY; tracking = true;
	});
	window.addEventListener("pointerup", (e) => {
		if (!tracking) return;
		tracking = false;
		if (!conn.isConnected()) return;
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;
		if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
		conn.send({ type: "go", delta: dx < 0 ? +1 : -1 });
	});
}

async function controlMode() {
	document.body.classList.add("hide-deck");
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

	const pin = sessionStorage.getItem("slides.pin") || (await promptForPin());

	const setCurrent = (n) => {
		current = Math.max(0, Math.min(total - 1, n));
		currentEl.textContent = pad(current + 1);
	};

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
		if (conn.isConnected()) conn.send({ type: "go", delta: -1 });
	});
	next.addEventListener("click", () => {
		if (conn.isConnected()) conn.send({ type: "go", delta: +1 });
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
