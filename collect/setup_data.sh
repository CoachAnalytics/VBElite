#!/usr/bin/env bash
# Links a checkout of the private VBElite-data repo into data/raw/ so the collect/
# scripts work in a fresh environment (e.g. a scheduled refresh session).
#   collect/setup_data.sh [path-to-VBElite-data]   (default /home/user/vbelite-data)
set -euo pipefail
cd "$(dirname "$0")/.."
DATA=${1:-/home/user/vbelite-data}
[ -d "$DATA/research" ] || { echo "No VBElite-data checkout at $DATA"; exit 1; }
mkdir -p data/raw data/seed
for f in directory tournament scorecard research_batches; do
  [ -e "data/raw/$f.json" ] || ln -s "$DATA/raw/$f.json" "data/raw/$f.json"
done
[ -e data/raw/research ] || ln -s "$DATA/research" data/raw/research
echo "data/raw linked to $DATA"
