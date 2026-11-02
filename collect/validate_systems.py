"""Checks systems/<ncaaOrgId>.json files (see collect/SYSTEMS.md).

    python3 collect/validate_systems.py /home/user/vbelite-data [ids...]
Prints problems; exits 1 if any file has errors.
"""

import json
import sys
from pathlib import Path

SYSTEMS = {"5-1", "6-2", "mixed", None}
CONFIDENCE = {"confirmed", "likely", None}


def main() -> None:
    data = Path(sys.argv[1])
    ids = set(sys.argv[2:])
    bad = 0
    for p in sorted((data / "systems").glob("*.json")):
        if ids and p.stem not in ids:
            continue
        errs = []
        try:
            r = json.loads(p.read_text())
        except json.JSONDecodeError as e:
            print(f"{p.name}: invalid JSON: {e}")
            bad += 1
            continue
        for k in ["ncaaOrgId", "school", "season", "system", "confidence", "setters", "evidence", "checkedAt", "notes"]:
            if k not in r:
                errs.append(f"missing {k}")
        if r.get("system") not in SYSTEMS:
            errs.append(f"bad system {r.get('system')!r}")
        if r.get("confidence") not in CONFIDENCE:
            errs.append(f"bad confidence {r.get('confidence')!r}")
        if (r.get("system") is None) != (r.get("confidence") is None):
            errs.append("system and confidence must both be set or both null")
        if r.get("system") and not (r.get("evidence") or "").strip():
            errs.append("a system needs evidence")
        for s in r.get("setters") or []:
            if not s.get("name"):
                errs.append("setter without a name")
            aps = s.get("assistsPerSet")
            if aps is not None and not (0 <= aps <= 16):
                errs.append(f"implausible assists per set {aps}")
        for m in errs:
            print(f"{p.name} ({r.get('school')}): ERROR {m}")
        bad += bool(errs)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
