"""Checks contacts/<ncaaOrgId>.json files (see collect/CONTACTS.md).

    python3 collect/validate_contacts.py /home/user/vbelite-data [ids...]
Prints problems; exits 1 if any file has errors.
"""

from __future__ import annotations

import gzip
import json
import re
import sys
from pathlib import Path

ROLES = {"program", "head", "recruiting", "assistant", "operations"}
EMAIL = re.compile(r"^[A-Za-z0-9._%+'-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$")


def base_domain(host: str) -> str:
    parts = host.lower().removeprefix("www.").split(".")
    return ".".join(parts[-2:])


def main() -> None:
    data = Path(sys.argv[1])
    ids = set(sys.argv[2:])
    schools = {str(s["ncaaOrgId"]): s for s in json.load(gzip.open(data / "seed" / "schools.json.gz"))}
    bad = 0
    for p in sorted((data / "contacts").glob("*.json")):
        if ids and p.stem not in ids:
            continue
        errs, warns = [], []
        try:
            r = json.loads(p.read_text())
        except json.JSONDecodeError as e:
            print(f"{p.name}: invalid JSON: {e}")
            bad += 1
            continue
        s = schools.get(p.stem)
        if not s:
            errs.append("unknown ncaaOrgId")
        own = {base_domain(x) for x in [(s or {}).get("website") or "", (s or {}).get("athleticsWebsite") or ""] if x}
        for k in ["ncaaOrgId", "school", "checkedAt", "method", "contacts", "notes"]:
            if k not in r:
                errs.append(f"missing {k}")
        seen = set()
        for c in r.get("contacts", []):
            if c.get("role") not in ROLES:
                errs.append(f"bad role {c.get('role')!r}")
            e = c.get("email")
            if e:
                if not EMAIL.match(e):
                    errs.append(f"bad email {e!r}")
                elif e.lower() in seen:
                    errs.append(f"duplicate email {e}")
                else:
                    seen.add(e.lower())
                    dom = base_domain(e.split("@")[1])
                    if not dom.endswith(".edu") and dom not in own:
                        warns.append(f"non-school domain {e}")
            if c.get("role") != "program" and not c.get("name"):
                errs.append("person without a name")
        for m in errs:
            print(f"{p.name} ({r.get('school')}): ERROR {m}")
        for m in warns:
            print(f"{p.name} ({r.get('school')}): warning {m}")
        bad += bool(errs)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
