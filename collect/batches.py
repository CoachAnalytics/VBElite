"""Splits the D1 directory into research batches, tournament teams first.

    python collect/batches.py [batch_size]  ->  data/raw/research_batches.json
Schools that already have a research file are skipped.
"""
import sys

from common import RAW, read_json, write_json


def main():
    size = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    tournament = read_json("tournament.json")
    done = {p.stem for p in (RAW / "research").glob("*.json")}
    schools = [s for s in read_json("directory.json") if str(s["ncaaOrgId"]) not in done]
    schools.sort(key=lambda s: (-len(tournament.get(str(s["ncaaOrgId"]), {})), s["officialName"]))
    keep = ["ncaaOrgId", "officialName", "team", "conference", "state", "athleticsWebsite"]
    batches = [[{k: s[k] for k in keep} for s in schools[i : i + size]] for i in range(0, len(schools), size)]
    write_json("research_batches.json", batches)
    print(f"{len(schools)} schools to research in {len(batches)} batches of {size}")


if __name__ == "__main__":
    main()
