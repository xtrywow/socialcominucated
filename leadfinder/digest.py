"""Every weekday morning, hand the team the next batch of leads with ready-to-send DMs.

python -m leadfinder.digest results/leads-latest.csv --count 20     (TELEGRAM_TOKEN, TELEGRAM_CHAT)

Sent leads are remembered in results/digest-state.json so nobody gets the same
business twice. The team still sends every DM by hand, from the AceAds account.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from pathlib import Path

import requests

from .exclude import is_competitor
from .outreach_excel import classify, opener

STATE = Path("results/digest-state.json")
PRIORITY_ORDER = {"HIGH": 0, "MEDIUM": 1, "VERIFY FIRST": 2}


def next_batch(rows: list[dict], sent: set[str], count: int) -> list[dict]:
    todo = [r for r in rows if r["place_id"] not in sent and (r["instagram"] or r["facebook"])
            and not is_competitor(r["name"], r["category"])]
    todo.sort(key=lambda r: (PRIORITY_ORDER[classify(r["pitch_angle"])[1]], -int(float(r["score"] or 0))))
    return todo[:count]


def message(r: dict) -> str:
    _, priority, lead_type = classify(r["pitch_angle"])
    platform = "Instagram" if r["instagram"] else "Facebook"
    return (f"[{priority}] {r['name']} ({r['category']}, {r['region']})\n"
            f"{lead_type}. DM on {platform}: {r['instagram'] or r['facebook']}\n"
            f"Check: {r['maps_url']}\n\n{opener(r, lead_type, platform)}")


def send(text: str) -> None:
    token, chat = os.environ.get("TELEGRAM_TOKEN"), os.environ.get("TELEGRAM_CHAT")
    if not token or not chat:
        print(text + "\n" + "-" * 40)
        return
    requests.post(f"https://api.telegram.org/bot{token}/sendMessage",
                  data={"chat_id": chat, "text": text, "disable_web_page_preview": "true"}, timeout=20).raise_for_status()


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("csv", nargs="?", default="results/leads-all.csv")
    ap.add_argument("--count", type=int, default=20)
    ap.add_argument("--state", default=str(STATE))
    args = ap.parse_args(argv)
    state = Path(args.state)
    sent = set(json.loads(state.read_text())) if state.exists() else set()
    rows = list(csv.DictReader(open(args.csv, encoding="utf-8-sig")))
    batch = next_batch(rows, sent, args.count)
    if not batch:
        send("AceAds: no leads left in the list. Time to run the finder again.")
        return 0
    send(f"AceAds: today's {len(batch)} leads. Open each profile, replace the [bracket], send by hand. "
         f"{len(rows) - len(sent) - len(batch)} left after today.")
    for r in batch:
        send(message(r))
    sent.update(r["place_id"] for r in batch)
    state.parent.mkdir(parents=True, exist_ok=True)
    state.write_text(json.dumps(sorted(sent), indent=0))
    print(f"sent {len(batch)} leads", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
