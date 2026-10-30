"""Shared helpers for the data collectors. Outputs go to data/raw/ (git-ignored)."""
import json
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
CACHE = RAW / "cache"
UA = "VBEliteDataCollector/0.1 (college volleyball recruiting research; https://github.com/CoachAnalytics/VBElite)"
SEASONS = [2021, 2022, 2023, 2024, 2025]


def fetch(url: str, cache_name: str | None = None, max_age_days: float = 7) -> str:
    """GET with an identifying user agent and an on-disk cache.

    A rate limit (429) is waited out as the server asks; any other refusal is final.
    """
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / (cache_name or re.sub(r"[^A-Za-z0-9._-]+", "_", url)[-180:])
    if path.exists() and time.time() - path.stat().st_mtime < max_age_days * 86400:
        return path.read_text(encoding="utf-8")
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                text = r.read().decode("utf-8", errors="replace")
            break
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == 3:
                raise
            time.sleep(int(e.headers.get("Retry-After") or 30 * (attempt + 1)))
    path.write_text(text, encoding="utf-8")
    time.sleep(1)  # be gentle with public sources
    return text


def wiki_title(href: str) -> str | None:
    """'https://en.wikipedia.org/wiki/Nebraska_Cornhuskers_women%27s_volleyball?x' -> "Nebraska Cornhuskers women's volleyball" """
    m = re.search(r"/wiki/([^?#]+)", href or "")
    if not m:
        return None
    return urllib.parse.unquote(m.group(1)).replace("_", " ").strip()


def norm(s: str) -> str:
    s = re.sub(r"[‐-―-]", " ", s)  # dashes separate words
    s = re.sub(r"['‘’ʻ`]", "", s)  # Hawaiʻi -> hawaii, Saint Mary's -> saint marys
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = s.lower().replace("&", " and ")
    s = re.sub(r"\bst\.?\b", "saint", s)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower().replace("&", "and")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def write_json(name: str, data) -> Path:
    RAW.mkdir(parents=True, exist_ok=True)
    path = RAW / name
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return path


def read_json(name: str):
    return json.loads((RAW / name).read_text(encoding="utf-8"))
