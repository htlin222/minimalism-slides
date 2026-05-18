// Cloudflare Worker — path-based router for slides.hsiehting.com
//
// Routes /<slug>/<rest>  →  https://<slug>.pages.dev/<rest>
// Preserves method, headers, body, and query string. Hash is client-side
// only and never reaches the worker.
//
// A trailing slash is enforced on the deck root (/<slug> → /<slug>/) so
// that relative URLs inside the deck's HTML (styles.css, slides.js) resolve
// against the slug path, not the apex.
//
// Deploy:
//     make worker              # wrangler deploy --config worker.toml
//
// One-time setup in the Cloudflare dashboard:
//   1. Workers & Pages → slides-router → Settings → Triggers → Routes
//      Add route: slides.hsiehting.com/*  (zone: hsiehting.com)
//   2. Or uncomment the [routes] block in worker.toml and redeploy.

export default {
	async fetch(request) {
		const url = new URL(request.url);
		const segments = url.pathname.split("/").filter(Boolean);
		const slug = segments[0];

		if (!slug) {
			return new Response(
				"slides.hsiehting.com\n\npick a deck path, e.g. /minimalism-slides/",
				{
					status: 200,
					headers: { "content-type": "text/plain; charset=utf-8" },
				},
			);
		}

		// /<slug> → /<slug>/  so relative URLs inside the deck resolve.
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
