"""Command line entry point: python -m leadfinder"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import os
import sys
from pathlib import Path

from . import osm, places
from .audit import audit_website
from .scoring import MAX_GAP, demand_score, gap_score, tier

COLUMNS = [
    "score", "tier", "name", "category", "pitch_angle", "phone", "website",
    "rating", "reviews", "address", "maps_url", "place_id",
]


def load_env(path: Path = Path(".env")) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        key, sep, value = line.partition("=")
        if sep and not key.strip().startswith("#"):
            os.environ.setdefault(key.strip(), value.strip())


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Find Brisbane businesses that need a new website.")
    p.add_argument("--config", default="config.json")
    p.add_argument("--categories", nargs="+", help="override categories from config")
    p.add_argument("--limit", type=int, default=0, help="max businesses to audit (0 = all)")
    p.add_argument("--pagespeed", action="store_true", help="also run Google PageSpeed (slow, more accurate)")
    p.add_argument("--min-tier", choices=["A", "B", "C"], default="C", help="only export this tier or better")
    p.add_argument("--source", choices=["google", "osm"], help="default: google if GOOGLE_API_KEY is set, else osm")
    p.add_argument("--out", help="CSV output path")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    load_env()
    api_key = os.environ.get("GOOGLE_API_KEY")
    source = args.source or ("google" if api_key else "osm")
    if source == "google" and not api_key:
        print("GOOGLE_API_KEY is not set (copy .env.example to .env), or use --source osm.", file=sys.stderr)
        return 1

    config = json.loads(Path(args.config).read_text())
    categories = args.categories or config["categories"]
    print(f"Source: {source}", file=sys.stderr)

    seen: dict[str, places.Business] = {}
    for category in categories:
        if source == "google":
            found = places.search(api_key, category, config["area"])
        elif category in config["osm_tags"]:
            found = osm.search(category, config["osm_tags"][category], config["osm_bbox"])
        else:
            print(f"{category}: no OSM tags in config, skipped", file=sys.stderr)
            continue
        print(f"{category}: {len(found)} businesses", file=sys.stderr)
        for b in found:
            seen.setdefault(b.place_id, b)

    candidates = list(seen.values())
    if source == "google":  # OSM has no ratings, so there is nothing to filter on
        candidates = [
            b for b in candidates
            if b.rating >= config.get("min_rating", 0) and b.reviews >= config.get("min_reviews", 0)
        ]
        candidates.sort(key=lambda b: b.reviews, reverse=True)
    if args.limit:
        candidates = candidates[: args.limit]

    rows = []
    for i, b in enumerate(candidates, 1):
        print(f"[{i}/{len(candidates)}] auditing {b.name}", file=sys.stderr)
        audit = audit_website(b.website, api_key, args.pagespeed)
        if source == "google":
            score = demand_score(b.rating, b.reviews) + gap_score(audit)
        else:  # no demand data: scale the website gap to 0-100
            score = round(gap_score(audit) * 100 / MAX_GAP)
        rows.append({
            "score": score, "tier": tier(score), "name": b.name, "category": b.category,
            "pitch_angle": "; ".join(audit.issues), "phone": b.phone, "website": b.website,
            "rating": b.rating, "reviews": b.reviews, "address": b.address,
            "maps_url": b.maps_url, "place_id": b.place_id,
        })

    rows = [r for r in rows if r["tier"] <= args.min_tier]
    rows.sort(key=lambda r: r["score"], reverse=True)

    out = Path(args.out or f"output/leads-{dt.date.today():%Y%m%d}.csv")
    out.parent.mkdir(parents=True, exist_ok=True)
    # utf-8-sig adds a BOM so Excel on Windows shows business names correctly.
    with out.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {len(rows)} leads to {out}", file=sys.stderr)
    return 0
