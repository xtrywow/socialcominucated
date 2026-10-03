"""Businesses AceAds never pitches: wedding photographers and videographers are its competitors."""

from __future__ import annotations

import re

COMPETITOR_CATEGORIES = {"photographer", "wedding photo or video", "wedding photographer", "wedding videographer"}
COMPETITOR_NAME = re.compile(r"photograph|photo\s*(?:&|and)\s*(?:video|film)|videograph|cinematograph|\bfilms?\b|photo\s*booth",
                             re.IGNORECASE)


def is_competitor(name: str, category: str) -> bool:
    return category in COMPETITOR_CATEGORIES or bool(COMPETITOR_NAME.search(name))
