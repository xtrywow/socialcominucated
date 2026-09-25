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
    assert cli.main([]) == 1
