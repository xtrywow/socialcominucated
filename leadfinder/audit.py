"""Website audit: finds the visible problems a web-design pitch can point to.

Only the business homepage is fetched. No email addresses are collected.
"""

from __future__ import annotations

import datetime as dt
import re
import time
from dataclasses import dataclass, field
from urllib.parse import urlparse

import requests

SOCIAL_HOSTS = (
    "facebook.com",
    "instagram.com",
    "linktr.ee",
    "business.site",  # retired Google Business Profile sites
    "yellowpages.com.au",
    "hipages.com.au",
    "oneflare.com.au",
)
USER_AGENT = "Mozilla/5.0 (compatible; AceAdsSiteAudit/0.1; +https://aceads.au)"
BLOCKED_STATUSES = {401, 403, 429}  # bot protection, not a broken site
PAGESPEED_URL = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"


@dataclass
class Audit:
    status: str  # none | unknown | social_only | ssl_error | dead | unreachable | blocked | ok
    issues: list[str] = field(default_factory=list)
    load_seconds: float | None = None
    mobile_performance: float | None = None  # PageSpeed score 0-1


def is_social_only(url: str) -> bool:
    host = urlparse(url).netloc.lower()
    return any(host == h or host.endswith("." + h) for h in SOCIAL_HOSTS)


def latest_copyright_year(html: str) -> int | None:
    notices = re.findall(r"(?:©|&copy;|copyright)([^<]{0,40})", html, re.IGNORECASE)
    years = [int(y) for notice in notices for y in re.findall(r"\b(?:19|20)\d{2}\b", notice)]
    return max(years) if years else None


def analyse_html(html: str, final_url: str, load_seconds: float, today: dt.date | None = None) -> list[str]:
    """Return human-readable issues found in a homepage."""
    today = today or dt.date.today()
    issues = []
    if urlparse(final_url).scheme != "https":
        issues.append("no HTTPS (browser shows 'Not secure')")
    if not re.search(r"<meta[^>]+name=[\"']viewport[\"']", html, re.IGNORECASE):
        issues.append("not mobile-friendly (no viewport tag)")
    year = latest_copyright_year(html)
    if year and today.year - year >= 3:
        issues.append(f"looks outdated (copyright {year})")
    if not re.search(r"<title[^>]*>\s*[^<\s]", html, re.IGNORECASE):
        issues.append("missing page title")
    if not re.search(r"<meta[^>]+name=[\"']description[\"']", html, re.IGNORECASE):
        issues.append("missing meta description")
    if load_seconds > 3:
        issues.append(f"slow to load ({load_seconds:.1f}s)")
    return issues


def pagespeed_score(url: str, api_key: str | None) -> float | None:
    """Mobile Lighthouse performance score (0-1), or None if unavailable."""
    try:
        resp = requests.get(
            PAGESPEED_URL,
            params={"url": url, "strategy": "mobile", "category": "performance", **({"key": api_key} if api_key else {})},
            timeout=90,
        )
        resp.raise_for_status()
        return resp.json()["lighthouseResult"]["categories"]["performance"]["score"]
    except (requests.RequestException, KeyError, ValueError):
        return None


def homepage(url: str) -> str:
    parts = urlparse(url)
    return f"{parts.scheme}://{parts.netloc}/"


def is_excluded(url: str) -> bool:
    """Government and education sites are not web-design prospects."""
    host = urlparse(url).netloc.lower()
    return host.endswith((".gov.au", ".edu.au"))


def audit_website(url: str, api_key: str | None = None, use_pagespeed: bool = False) -> Audit:
    if not url:
        return Audit(status="none", issues=["no website"])
    if is_social_only(url):
        return Audit(status="social_only", issues=[f"no real website (uses {urlparse(url).netloc})"])
    try:
        start = time.monotonic()
        resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=15)
        if resp.status_code in (404, 410) and urlparse(url).path not in ("", "/"):
            # Directories often store a stale deep link; judge the homepage instead.
            start = time.monotonic()
            resp = requests.get(homepage(url), headers={"User-Agent": USER_AGENT}, timeout=15)
        load = time.monotonic() - start
    except requests.exceptions.SSLError:
        return Audit(status="ssl_error", issues=["security certificate error (browsers warn visitors away)"])
    except (requests.ConnectionError, requests.Timeout):
        return Audit(status="dead", issues=["website address not working (check the business is still open)"])
    except requests.RequestException as exc:
        return Audit(status="unreachable", issues=[f"website broken ({type(exc).__name__})"])
    if resp.status_code in BLOCKED_STATUSES:
        return Audit(status="blocked", issues=[f"could not check (site refused automated visit, HTTP {resp.status_code})"])
    if resp.status_code >= 400:
        return Audit(status="unreachable", issues=[f"homepage shows an error page (HTTP {resp.status_code})"])

    audit = Audit(status="ok", issues=analyse_html(resp.text, resp.url, load), load_seconds=load)
    if use_pagespeed:  # works without a key, at a lower rate limit
        audit.mobile_performance = pagespeed_score(resp.url, api_key)
        if audit.mobile_performance is not None and audit.mobile_performance < 0.5:
            audit.issues.append(f"poor mobile performance (PageSpeed {round(audit.mobile_performance * 100)}/100)")
    return audit
