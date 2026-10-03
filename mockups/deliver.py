"""Send a built preview (page, fonts, screenshots) back to the aceads.au WordPress site.

python mockups/deliver.py --slug SLUG --callback URL   (secret from PREVIEW_SECRET)

The WordPress plugin stores the files under /wp-content/uploads/aceads-previews/<slug>/
and then tells the team (Telegram + email) and the prospect (email) that it is ready.
"""

from __future__ import annotations

import argparse
import base64
import os
import sys
from pathlib import Path

import requests

ROOT = Path(__file__).parent
MAX_BYTES = 12 * 1024 * 1024  # keep well under typical PHP post_max_size


def payload(slug: str) -> dict:
    """{path: base64} for every file of one preview, paths relative to the preview folder."""
    folder = ROOT / "out" / slug
    files = {}
    for path in sorted(folder.rglob("*")):
        if path.is_file() and path.suffix in {".html", ".png", ".woff2"}:
            files[path.relative_to(folder).as_posix()] = base64.b64encode(path.read_bytes()).decode()
    if "index.html" not in files:
        raise SystemExit(f"{folder} has no index.html")
    total = sum(len(v) for v in files.values())
    if total > MAX_BYTES:
        raise SystemExit(f"preview is {total} bytes encoded, over the {MAX_BYTES} limit")
    return {"slug": slug, "files": files}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--slug", required=True)
    ap.add_argument("--callback", required=True, help="the lead's preview endpoint on the WordPress site")
    args = ap.parse_args(argv)
    secret = os.environ.get("PREVIEW_SECRET")
    if not secret:
        print("PREVIEW_SECRET is not set", file=sys.stderr)
        return 1
    resp = requests.post(args.callback, json=payload(args.slug), headers={"X-AceAds-Secret": secret}, timeout=120)
    print(resp.status_code, resp.text[:300])
    return 0 if resp.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
