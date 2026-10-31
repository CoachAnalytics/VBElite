"""Picks the schools a refresh run should re-research, in batches of 4.

Least recently researched first; among equally old files, the weakest ones (no
complete roster, no commits) go first.

    python collect/refresh_queue.py 40      # prints JSON: [[school, ...], ...]
"""
import json
import sys

from common import RAW, read_json


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 40
    directory = {str(d["ncaaOrgId"]): d for d in read_json("directory.json")}
    rows = []
    for oid, d in directory.items():
        path = RAW / "research" / f"{oid}.json"
        r = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
        weak = (not (r.get("roster") or {}).get("complete")) + (not (r.get("commits") or {}).get("players"))
        rows.append((r.get("researchedAt") or "0000-00-00", -weak, d))
    rows.sort(key=lambda x: (x[0], x[1]))
    picked = [
        {k: d[k] for k in ("ncaaOrgId", "officialName", "team", "conference", "state", "athleticsWebsite")}
        for _, _, d in rows[:limit]
    ]
    print(json.dumps([picked[i : i + 4] for i in range(0, len(picked), 4)]))


if __name__ == "__main__":
    main()
