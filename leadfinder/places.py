"""Business discovery through the Google Places API (New) Text Search."""

from __future__ import annotations

import time
from dataclasses import dataclass

import requests

SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
FIELD_MASK = ",".join(
    [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.nationalPhoneNumber",
        "places.websiteUri",
        "places.rating",
        "places.userRatingCount",
        "places.businessStatus",
        "places.googleMapsUri",
        "nextPageToken",
    ]
)
MAX_PAGES = 3  # Text Search returns at most 60 results (3 pages of 20).


@dataclass
class Business:
    place_id: str
    name: str
    category: str
    address: str
    phone: str
    website: str
    rating: float
    reviews: int
    maps_url: str
    facebook: str = ""
    instagram: str = ""
    region: str = ""


def parse_place(place: dict, category: str) -> Business | None:
    """Convert a Places API result into a Business, skipping closed ones."""
    if place.get("businessStatus", "OPERATIONAL") != "OPERATIONAL":
        return None
    return Business(
        place_id=place["id"],
        name=place.get("displayName", {}).get("text", ""),
        category=category,
        address=place.get("formattedAddress", ""),
        phone=place.get("nationalPhoneNumber", ""),
        website=place.get("websiteUri", ""),
        rating=float(place.get("rating", 0.0)),
        reviews=int(place.get("userRatingCount", 0)),
        maps_url=place.get("googleMapsUri", ""),
    )


def search(api_key: str, category: str, area: str, session: requests.Session | None = None) -> list[Business]:
    """Return operational businesses for '<category> in <area>'."""
    http = session or requests.Session()
    headers = {"X-Goog-Api-Key": api_key, "X-Goog-FieldMask": FIELD_MASK}
    body: dict = {"textQuery": f"{category} in {area}", "pageSize": 20, "regionCode": "AU"}
    results: list[Business] = []
    for _ in range(MAX_PAGES):
        resp = http.post(SEARCH_URL, json=body, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        for place in data.get("places", []):
            business = parse_place(place, category)
            if business:
                results.append(business)
        token = data.get("nextPageToken")
        if not token:
            break
        body["pageToken"] = token
        time.sleep(1)  # page tokens need a moment before they become valid
    return results
