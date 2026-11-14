#!/usr/bin/env python3
"""The web server for the tests: the game's files (like `python3 -m http.server`), plus
GET /api/turn answering the way the Vercel function (api/turn.js) does with nothing set up:
{"iceServers": []}. Without it every online test would see a 404 in the browser console.
Tests that need other answers fake them with Playwright's page.route.

    python3 tests/serve.py 8765        (run from the repo root; tests/run.sh does this)
"""
import contextlib
import http.server
import socket
import sys


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.split("?")[0].rstrip("/") == "/api/turn":
            body = b'{"iceServers":[]}'
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def log_message(self, *args):
        pass


class Server(http.server.ThreadingHTTPServer):
    """IPv4 and IPv6 like `python3 -m http.server` (localhost may be either)"""
    address_family = socket.AF_INET6

    def server_bind(self):
        with contextlib.suppress(Exception):
            self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        return super().server_bind()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    try:
        httpd = Server(("::", port), Handler)
    except OSError:
        Server.address_family = socket.AF_INET
        httpd = Server(("0.0.0.0", port), Handler)
    httpd.serve_forever()
