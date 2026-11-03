"""Local dev server that never lets the browser cache files.

Run from the repo root:   python scripts/dev_server.py   (http://localhost:8080)
"""
import http.server
import sys
from functools import partial
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


http.server.ThreadingHTTPServer(("127.0.0.1", PORT), partial(NoCache, directory=str(ROOT))).serve_forever()
