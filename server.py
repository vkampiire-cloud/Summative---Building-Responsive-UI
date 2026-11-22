#!/usr/bin/python3
"""
MediGuard - Drug Safety & Medication Recall Backend Server
Serves static frontend assets, handles health checks, and proxies openFDA API.
"""
from http.server import HTTPServer, SimpleHTTPRequestHandler
import json
import os
import socket
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

PORT = int(os.environ.get("PORT", "5000"))
HOST = os.environ.get("HOST", "127.0.0.1")
PUBLIC_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_TTL = 300
CACHE = {}


class MediGuardHandler(SimpleHTTPRequestHandler):
    """Custom request handler for MediGuard API proxy and static frontend."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    def _set_json_headers(self, status=200):
        """Set standard JSON response headers with CORS support."""
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self._set_json_headers(200)

    def do_GET(self):
        """Route incoming GET requests to API endpoints or static files."""
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query_params = urllib.parse.parse_qs(parsed_url.query)

        if path == "/api/health":
            self.handle_health_check()
            return

        if path == "/api/recalls":
            self.handle_recalls(query_params)
            return

        super().do_GET()

    def handle_health_check(self):
        """Health check endpoint for HAProxy and status monitoring."""
        payload = {
            "status": "UP",
            "service": "mediguard-api",
            "hostname": socket.gethostname(),
            "port": self.server.server_address[1],
            "timestamp": int(time.time()),
        }
        self._set_json_headers(200)
        self.wfile.write(json.dumps(payload).encode("utf-8"))

    def handle_recalls(self, query_params):
        """Proxy requests to openFDA with in-memory caching and error handling."""
        search_query = query_params.get("search", [""])[0].strip()
        limit = query_params.get("limit", ["50"])[0].strip()

        if not limit.isdigit():
            limit = "50"
        limit = str(max(1, min(int(limit), 100)))

        cache_key = f"{search_query}::{limit}"
        now = time.time()

        if cache_key in CACHE:
            cached_item = CACHE[cache_key]
            if now < cached_item["expires"]:
                self._set_json_headers(200)
                self.wfile.write(cached_item["data"])
                return

        fda_base = "https://api.fda.gov/drug/enforcement.json"
        if search_query:
            clean_term = (
                search_query.replace('"', ' ').replace('\\', ' ').strip()
            )
            params = urllib.parse.urlencode({
                "search": f'product_description:"{clean_term}"',
                "limit": limit
            })
        else:
            params = urllib.parse.urlencode({"limit": limit})
        fda_url = f"{fda_base}?{params}"

        req = urllib.request.Request(
            fda_url,
            headers={"User-Agent": "MediGuard-ALU-Student-App/1.0"},
        )

        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                raw_data = response.read()
                CACHE[cache_key] = {
                    "data": raw_data,
                    "expires": now + CACHE_TTL,
                }
                self._set_json_headers(200)
                self.wfile.write(raw_data)
        except urllib.error.HTTPError as err:
            if err.code == 404:
                empty = json.dumps(
                    {"results": [], "total": 0}
                ).encode("utf-8")
                self._set_json_headers(200)
                self.wfile.write(empty)
            elif err.code == 429:
                err_payload = json.dumps(
                    {"error": "Rate limit exceeded. Please wait a moment."}
                ).encode("utf-8")
                self._set_json_headers(err.code)
                self.wfile.write(err_payload)
            else:
                err_payload = json.dumps(
                    {"error": f"OpenFDA request failed with status {err.code}."}
                ).encode("utf-8")
                self._set_json_headers(err.code)
                self.wfile.write(err_payload)
        except urllib.error.URLError:
            err_payload = json.dumps(
                {"error": "Network timeout: Unable to reach OpenFDA servers."}
            ).encode("utf-8")
            self._set_json_headers(504)
            self.wfile.write(err_payload)


def run():
    """Start the MediGuard HTTP server."""
    host = sys.argv[1] if len(sys.argv) > 1 else HOST
    port = int(sys.argv[2]) if len(sys.argv) > 2 else PORT
    server = HTTPServer((host, port), MediGuardHandler)
    print(f"[*] MediGuard Server running at http://{host}:{port}/")
    print(f"[*] Serving static assets from: {PUBLIC_DIR}")
    print(f"[*] Health check endpoint: http://{host}:{port}/api/health")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[!] Shutting down server gracefully...")
        server.server_close()


if __name__ == "__main__":
    run()
