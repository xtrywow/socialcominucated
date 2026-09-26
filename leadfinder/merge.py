"""Merge per-region lead CSVs into one, dropping duplicates by place_id.

python -m leadfinder.merge OUT.csv IN1.csv IN2.csv ...
"""

from __future__ import annotations

import csv
import sys
from pathlib import Path

from .cli import COLUMNS


def merge(inputs: list[Path], out: Path) -> int:
    rows: dict[str, dict] = {}
    for path in inputs:
        for row in csv.DictReader(open(path, encoding="utf-8-sig")):
            rows.setdefault(row["place_id"], row)
    merged = sorted(rows.values(), key=lambda r: int(r["score"]), reverse=True)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(merged)
    return len(merged)


if __name__ == "__main__":
    out, *inputs = sys.argv[1:]
    print(f"{merge([Path(p) for p in inputs], Path(out))} leads merged into {out}")
