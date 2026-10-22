"""Region and size for each client.

SAMPLE DATA until real values exist. Resolution order for a client name:
  1. contracts/client_meta.json  (your real values; optional)
  2. the built-in sample table below
  3. a deterministic pseudo-random pick, so unknown clients still land somewhere
Example client_meta.json:
  {"Acme Corporation": {"continent": "North America", "country": "United States", "size": "Enterprise"}}
"""
from __future__ import annotations

import json
import zlib

from .config import ROOT

CONTINENTS = ["Africa", "Asia", "Europe", "North America", "Oceania", "South America"]
SIZES = ["Enterprise", "Large", "Mid-size", "Small"]

COUNTRIES = {
    "Africa": ["South Africa", "Kenya", "Egypt"],
    "Asia": ["India", "Singapore", "Japan"],
    "Europe": ["Germany", "United Kingdom", "France"],
    "North America": ["United States", "Canada", "Mexico"],
    "Oceania": ["Australia", "New Zealand"],
    "South America": ["Brazil", "Chile", "Colombia"],
}

SAMPLE = {
    "Acme Corporation": ("North America", "United States", "Enterprise"),
    "Globex Industries": ("Europe", "Germany", "Large"),
    "Hooli Systems": ("North America", "Canada", "Mid-size"),
    "Initech": ("Asia", "India", "Large"),
    "Umbrella Logistics": ("Africa", "South Africa", "Small"),
    "Wayne Retail Group": ("Oceania", "Australia", "Mid-size"),
}

META_FILE = ROOT / "contracts" / "client_meta.json"


def _overrides() -> dict:
    try:
        data = json.loads(META_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def client_meta(name: str) -> dict:
    raw = _overrides().get(name) or {}
    continent, country, size = raw.get("continent"), raw.get("country"), raw.get("size")
    if continent not in CONTINENTS or size not in SIZES:
        sample = SAMPLE.get(name)
        if sample:
            fallback = sample
        else:
            h = zlib.crc32(name.encode())
            cont = CONTINENTS[h % len(CONTINENTS)]
            fallback = (cont, COUNTRIES[cont][(h >> 3) % len(COUNTRIES[cont])], SIZES[(h >> 7) % len(SIZES)])
        if continent not in CONTINENTS:
            continent, country = fallback[0], fallback[1]
        if size not in SIZES:
            size = fallback[2]
    return {"continent": continent, "country": country or COUNTRIES[continent][0], "size": size}
