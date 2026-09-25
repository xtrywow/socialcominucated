"""Keyless business discovery through OpenStreetMap (Overpass API).

OSM has no ratings or reviews, and its coverage of trades is thinner than
Google's, but it needs no API key or billing account.
"""

from __future__ import annotations

import time
from urllib.parse import quote_plus

import requests

from .places import Business

OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
RETRY_STATUSES = {429, 502, 503, 504}
USER_AGENT = "AceAdsLeadFinder/0.1 (+https://aceads.au)"


def build_query(tags: list[str], bbox: list[float]) -> str:
    south, west, north, east = bbox
    selectors = "".join(f"nwr[{tag}]({south},{west},{north},{east});" for tag in tags)
    return f"[out:json][timeout:120];({selectors});out tags center;"


def google_maps_search_url(name: str, address: str) -> str:
    """Link a salesperson can click to check the business's Google reviews."""
    return "https://www.google.com/maps/search/?api=1&query=" + quote_plus(f"{name} {address}".strip())


def parse_element(element: dict, category: str) -> Business | None:
    t = element.get("tags", {})
    name = t.get("name")
    if not name or t.get("disused") == "yes":
        return None
    address = " ".join(
        part for part in [t.get("addr:housenumber"), t.get("addr:street"), t.get("addr:suburb") or t.get("addr:city")] if part
    )
    return Business(
        place_id=f"osm:{element['type']}/{element['id']}",
        name=name,
        category=category,
        address=address,
        phone=t.get("phone") or t.get("contact:phone", ""),
        website=t.get("website") or t.get("contact:website") or t.get("url", ""),
        rating=0.0,
        reviews=0,
        maps_url=google_maps_search_url(name, address),
    )


def fetch(query: str, attempts: int = 3) -> dict:
    """POST to Overpass, rotating mirrors and backing off while servers are busy."""
    last_error: Exception | None = None
    for attempt in range(attempts):
        for url in OVERPASS_URLS:
            try:
                resp = requests.post(url, data={"data": query}, headers={"User-Agent": USER_AGENT}, timeout=180)
                if resp.status_code in RETRY_STATUSES:
                    last_error = requests.HTTPError(f"{resp.status_code} from {url}")
                    continue
                resp.raise_for_status()
                return resp.json()
            except (requests.ConnectionError, requests.Timeout) as exc:
                last_error = exc
        time.sleep(10 * (attempt + 1))
    raise last_error or RuntimeError("Overpass request failed")


def search(category: str, tags: list[str], bbox: list[float]) -> list[Business]:
    results = []
    for element in fetch(build_query(tags, bbox)).get("elements", []):
        business = parse_element(element, category)
        if business:
            results.append(business)
    return results
