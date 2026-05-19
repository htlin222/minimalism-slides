#!/usr/bin/env python3
# Dev server that mimics Cloudflare Pages extensionless routing.
#
# Production (Pages + worker.js) resolves /<slug>/presenter to /presenter.html,
# but `python3 -m http.server` only serves literal paths, so `make serve` would
# return 404 on /presenter, /live, /control. This handler intercepts those mode
# paths and serves index.html — slides.js reads location.pathname so the mode
# is detected correctly.

import http.server
import socketserver
import sys
import os

KNOWN_MODES = {"live", "presenter", "control"}
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?", 1)[0].split("#", 1)[0]
        segments = [s for s in path.strip("/").split("/") if s]
        if segments and segments[-1] in KNOWN_MODES and not os.path.exists("." + path):
            self.path = "/index.html"
        return super().do_GET()


def main():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as srv:
        print(f"Serving on http://localhost:{PORT}  (mode routes: /live /presenter /control)")
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
