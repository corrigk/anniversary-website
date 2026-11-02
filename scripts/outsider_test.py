"""Outsider test: act as a stranger with only the public key and no login.

Every table, RPC and the storage bucket must return nothing or an error.
Run from the repo root:   python scripts/outsider_test.py
Reads the URL and key from js/config.js. Uses only the Python standard library.
"""
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

CONFIG = Path(__file__).resolve().parent.parent / "js" / "config.js"
text = CONFIG.read_text(encoding="utf-8")
URL = re.search(r"SUPABASE_URL\s*=\s*'([^']+)'", text).group(1).rstrip("/")
KEY = re.search(r"SUPABASE_KEY\s*=\s*'([^']+)'", text).group(1)

TABLES = [
    "couple_members", "profiles", "settings", "memories", "memory_photos", "songs",
    "letters", "reasons", "coupons", "bucket_items", "countdowns", "puzzles",
    "puzzle_answers", "puzzle_progress", "finale",
]


def call(method, path, body=None):
    req = urllib.request.Request(
        URL + path,
        method=method,
        data=None if body is None else json.dumps(body).encode(),
        headers={"apikey": KEY, "Content-Type": "application/json", "Prefer": "return=representation"},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            raw = r.read().decode() or "null"
            return r.status, json.loads(raw)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:160]


def is_empty(status, data):
    """Pass if the request failed, or succeeded but leaked nothing."""
    if status >= 400:
        return True
    return data in (None, [], {}, False) or data == "null"


results = []

for t in TABLES:
    status, data = call("GET", f"/rest/v1/{t}?select=*&limit=5")
    results.append((f"read {t}", is_empty(status, data), status, data))

status, data = call("POST", "/rest/v1/reasons", {"text": "outsider was here"})
results.append(("insert into reasons", status >= 400, status, data))

status, data = call("PATCH", "/rest/v1/coupons?id=not.is.null", {"redeemed": True})
results.append(("update coupons", is_empty(status, data), status, data))

status, data = call("DELETE", "/rest/v1/reasons?id=not.is.null")
results.append(("delete reasons", is_empty(status, data), status, data))

status, data = call("POST", "/rest/v1/rpc/check_puzzle",
                    {"p_puzzle_id": "00000000-0000-0000-0000-000000000000", "p_guess": "x"})
results.append(("rpc check_puzzle", status >= 400 or data is False, status, data))

status, data = call("POST", "/rest/v1/rpc/get_finale", {})
results.append(("rpc get_finale", is_empty(status, data), status, data))

status, data = call("POST", "/storage/v1/object/list/memories", {"prefix": "", "limit": 10})
results.append(("list storage bucket", is_empty(status, data), status, data))

status, data = call("GET", "/storage/v1/object/public/memories/anything.jpg")
results.append(("public URL for bucket", status >= 400, status, data))

failed = 0
for name, ok, status, data in results:
    failed += not ok
    print(f"{'PASS' if ok else 'FAIL'}  {name:<24} HTTP {status}  {'' if ok else str(data)[:120]}")

print()
if failed:
    print(f"{failed} check(s) FAILED. Something is visible to strangers. Fix RLS before sharing the site.")
    sys.exit(1)
print("All checks passed: a stranger with the public key sees nothing.")
print("(If every table shows HTTP 404, the SQL hasn't been run yet, so re-run this afterwards.)")
