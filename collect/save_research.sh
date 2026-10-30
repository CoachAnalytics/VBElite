#!/usr/bin/env bash
# Validates new research files, commits them to the private VBElite-data repo and pushes,
# and refreshes the merged seed file there.
#   collect/save_research.sh "Research: batch 3"
set -euo pipefail
cd "$(dirname "$0")"
python3 validate_research.py >/dev/null || python3 validate_research.py | grep -B1 ERROR || true
python3 build_seed.py
DATA=/home/user/vbelite-data
mkdir -p "$DATA/seed"
cp ../data/seed/schools.json.gz "$DATA/seed/schools.json.gz"
cd "$DATA"
git add -A
git diff --cached --quiet && { echo "nothing new"; exit 0; }
git commit -q -m "${1:-Research update}"
for i in 1 2 3 4; do git push -q && break || sleep $((2 ** i)); done
git log --oneline -1
