import datetime as dt

from leadfinder.audit import Audit, analyse_html, audit_website, is_social_only, latest_copyright_year
from leadfinder.places import parse_place
from leadfinder.scoring import demand_score, gap_score, tier

TODAY = dt.date(2026, 9, 25)
GOOD_HTML = """<html><head><title>Smith Plumbing</title>
<meta name="viewport" content="width=device-width">
<meta name="description" content="Brisbane plumbers"></head>
<body><footer>&copy; 2026 Smith Plumbing</footer></body></html>"""
OLD_HTML = "<html><head><title></title></head><body>Copyright 2017 Old Co</body></html>"


def test_modern_site_has_no_issues():
    assert analyse_html(GOOD_HTML, "https://smith.com.au/", 1.2, TODAY) == []


def test_old_site_issues():
    issues = analyse_html(OLD_HTML, "http://old.com.au/", 4.5, TODAY)
    assert issues == [
        "no HTTPS (browser shows 'Not secure')",
        "not mobile-friendly (no viewport tag)",
        "looks outdated (copyright 2017)",
        "missing page title",
        "missing meta description",
        "slow to load (4.5s)",
    ]


def test_copyright_year_takes_latest():
    assert latest_copyright_year("© 2019 - 2024 Co") == 2024
    assert latest_copyright_year("no year here") is None


def test_social_only_and_missing_websites():
    assert is_social_only("https://www.facebook.com/smithplumbing")
    assert not is_social_only("https://smithplumbing.com.au")
    assert audit_website("").status == "none"
    assert audit_website("https://m.facebook.com/x").status == "social_only"


def test_demand_rewards_reviews_and_rating():
    assert demand_score(5.0, 0) == 0
    assert demand_score(5.0, 200) == 40
    assert demand_score(4.8, 150) > demand_score(4.8, 10)
    assert demand_score(4.9, 100) > demand_score(3.5, 100)


def test_gap_score():
    assert gap_score(Audit(status="unreachable")) == 50
    assert gap_score(Audit(status="ok", issues=[])) == 0
    issues = ["no HTTPS (x)", "not mobile-friendly (x)", "looks outdated (x)", "slow to load (x)", "poor mobile performance (x)"]
    assert gap_score(Audit(status="ok", issues=issues)) == 60


def test_tiers():
    assert (tier(75), tier(45), tier(10)) == ("A", "B", "C")


def test_parse_place_skips_closed():
    place = {"id": "p1", "displayName": {"text": "Smith"}, "rating": 4.7, "userRatingCount": 88}
    business = parse_place(place, "plumber")
    assert business.name == "Smith" and business.reviews == 88 and business.website == ""
    assert parse_place({**place, "businessStatus": "CLOSED_PERMANENTLY"}, "plumber") is None


def test_cli_imports_and_requires_key(monkeypatch, tmp_path):
    from leadfinder import cli

    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    assert cli.main(["--source", "google"]) == 1


def test_osm_parse_and_query():
    from leadfinder.osm import build_query, parse_element

    el = {"type": "node", "id": 7, "tags": {"name": "Bean Cafe", "addr:street": "Ann St", "contact:website": "http://bean.au"}}
    b = parse_element(el, "cafe")
    assert b.place_id == "osm:node/7" and b.website == "http://bean.au" and b.address == "Ann St"
    assert "google.com/maps/search" in b.maps_url
    assert parse_element({"type": "node", "id": 8, "tags": {}}, "cafe") is None
    assert build_query(['"amenity"="cafe"'], [-27.7, 152.8, -27.2, 153.25]) == (
        '[out:json][timeout:120];(nwr["amenity"="cafe"](-27.7,152.8,-27.2,153.25););out tags center;'
    )


def test_cli_osm_end_to_end(monkeypatch, tmp_path):
    import csv
    import json

    from leadfinder import cli, osm
    from leadfinder.places import Business

    config = {"area": "Brisbane", "categories": ["cafe", "plumber"], "osm_bbox": [0, 0, 1, 1], "osm_tags": {"cafe": ["x"]}}
    (tmp_path / "config.json").write_text(json.dumps(config))
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.setattr(osm, "search", lambda c, t, b: [
        Business("osm:node/1", "No Site Cafe", c, "", "", "", 0.0, 0, ""),
        Business("osm:node/2", "FB Cafe", c, "", "", "https://facebook.com/fb", 0.0, 0, ""),
    ])
    assert cli.main(["--out", "leads.csv"]) == 0
    raw = (tmp_path / "leads.csv").read_bytes()
    assert raw.startswith(b"\xef\xbb\xbf")  # BOM for Excel
    rows = list(csv.DictReader(raw.decode("utf-8-sig").splitlines()))
    assert [(r["name"], r["score"], r["tier"]) for r in rows] == [("FB Cafe", "75", "A"), ("No Site Cafe", "58", "B")]


def test_blocked_site_is_not_reported_broken(monkeypatch):
    import leadfinder.audit as audit_mod

    class Resp:
        status_code = 403

    monkeypatch.setattr(audit_mod.requests, "get", lambda *a, **k: Resp())
    result = audit_website("https://protected.com.au")
    assert result.status == "blocked" and gap_score(result) == 0
