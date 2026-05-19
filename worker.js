// Cloudflare Worker — path-based router for slides.hsiehting.com
//
//   GET  /<slug>/_ws            (Upgrade: websocket)  -> SessionDO(slug)
//   GET  /<slug>/<rest>                                -> https://<slug>.pages.dev/<rest>
//
// Deploy:
//     make worker              # wrangler deploy --config worker.toml
//
// The Durable Object holds per-deck session state (current slide) and brokers
// WebSocket connections between /live (viewer), /presenter (PIN, controller),
// and /control (PIN, controller). PIN is read from env.SLIDES_PIN — set it
// with `wrangler secret put SLIDES_PIN --config worker.toml`.

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const segments = url.pathname.split("/").filter(Boolean);
		const slug = segments[0];

		if (!slug) {
			// Apex with no slug -> redirect to the default deck.
			// Override via env.DEFAULT_SLUG (worker.toml [vars]) when more decks exist.
			const defaultSlug = env.DEFAULT_SLUG || "minimalism-slides";
			return Response.redirect(`${url.origin}/${defaultSlug}/`, 302);
		}

		// WebSocket upgrade -> Durable Object keyed by slug.
		if (
			segments[1] === "_ws" &&
			request.headers.get("Upgrade")?.toLowerCase() === "websocket"
		) {
			const id = env.SESSIONS.idFromName(slug);
			const stub = env.SESSIONS.get(id);
			return stub.fetch(request);
		}

		// /<slug> -> /<slug>/  so relative URLs inside the deck resolve.
		if (segments.length === 1 && !url.pathname.endsWith("/")) {
			return Response.redirect(`${url.origin}/${slug}/${url.search}`, 301);
		}

		const rest = segments.slice(1).join("/");
		const target = `https://${slug}.pages.dev/${rest}${url.search}`;

		return fetch(target, {
			method: request.method,
			headers: request.headers,
			body: request.body,
			redirect: "manual",
		});
	},
};

// ---- Durable Object: per-slug session state -----------------------------
// One instance per deck slug. Holds the current slide index in storage,
// brokers messages between live (read) and presenter/control (write) sockets.
// Uses the Hibernation WebSocket API so idle sessions don't accrue cost.

export class SessionDO {
	constructor(state, env) {
		this.state = state;
		this.env = env;
		this.current = 0;
		this.state.blockConcurrencyWhile(async () => {
			this.current = (await state.storage.get("current")) ?? 0;
		});
	}

	async fetch(_request) {
		const pair = new WebSocketPair();
		const [client, server] = Object.values(pair);
		// Hibernation API — DO can sleep between messages, WS state persists.
		this.state.acceptWebSocket(server);
		return new Response(null, { status: 101, webSocket: client });
	}

	webSocketMessage(ws, raw) {
		let msg;
		try {
			msg = typeof raw === "string" ? JSON.parse(raw) : null;
		} catch {
			return;
		}
		if (!msg || typeof msg !== "object") return;

		if (msg.type === "hello") {
			const role = msg.role;
			if (role !== "live" && msg.pin !== this.env.SLIDES_PIN) {
				ws.send(JSON.stringify({ type: "deny", reason: "bad-pin" }));
				return ws.close(4001, "bad-pin");
			}
			ws.serializeAttachment({ role });
			ws.send(JSON.stringify({ type: "welcome", current: this.current }));
			return;
		}

		const att = ws.deserializeAttachment();
		const role = att?.role;
		if (role !== "presenter" && role !== "control") return; // viewers / pre-hello sockets can't mutate

		if (msg.type === "jump" && Number.isInteger(msg.index)) {
			this.setCurrent(msg.index);
		} else if (msg.type === "go" && Number.isInteger(msg.delta)) {
			this.setCurrent(this.current + msg.delta);
		}
	}

	setCurrent(n) {
		const next = Math.max(0, n);
		if (next === this.current) return;
		this.current = next;
		this.state.storage.put("current", next);
		const payload = JSON.stringify({ type: "state", current: next });
		for (const ws of this.state.getWebSockets()) {
			try { ws.send(payload); } catch { /* socket closed; ignore */ }
		}
	}

	webSocketClose(_ws, _code, _reason, _wasClean) {
		// no-op — hibernation API auto-removes from getWebSockets()
	}

	webSocketError(_ws, _err) {
		// no-op
	}
}
