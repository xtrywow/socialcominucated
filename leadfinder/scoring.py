"""Lead scoring: demand signal (can they pay?) x website gap (do they need us?).

A business with no reviews and no website is usually a weak buyer. The best
web-design prospects have proven customer demand (many good reviews) and a
visibly weak website, so both halves carry weight.
"""

from __future__ import annotations

import math

from .audit import Audit

GAP_BY_STATUS = {"none": 35, "social_only": 45, "unreachable": 50}
GAP_BY_ISSUE = {
    "no HTTPS": 15,
    "not mobile-friendly": 20,
    "looks outdated": 12,
    "missing page title": 5,
    "missing meta description": 5,
    "slow to load": 10,
    "poor mobile performance": 15,
}
MAX_DEMAND = 40
MAX_GAP = 60


def demand_score(rating: float, reviews: int) -> int:
    """0-40: review volume (log scale, ~200 reviews saturates) weighted by rating."""
    if reviews <= 0:
        return 0
    volume = min(math.log10(reviews + 1) / math.log10(201), 1.0)
    quality = max(0.0, min((rating - 3.0) / 2.0, 1.0))
    return round(MAX_DEMAND * volume * (0.4 + 0.6 * quality))


def gap_score(audit: Audit) -> int:
    """0-60: how obviously the business needs a new website."""
    if audit.status in GAP_BY_STATUS:
        return GAP_BY_STATUS[audit.status]
    total = sum(points for prefix, points in GAP_BY_ISSUE.items() if any(i.startswith(prefix) for i in audit.issues))
    return min(total, MAX_GAP)


def tier(score: int) -> str:
    if score >= 60:
        return "A"
    if score >= 40:
        return "B"
    return "C"
