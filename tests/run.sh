#!/usr/bin/env bash
# Run the browser tests.  Usage:
#   bash tests/run.sh quick          features, story beats, menus, touch, 2-player online, videos online (~15 min)
#   bash tests/run.sh full           quick + all 4 story periods, Hard, random input, connection edge cases, 3-player chaos (~60 min)
#   bash tests/run.sh features ui    just those
# Logs: tests/out/<name>.log   Screenshots: tests/out/*.png
set -u
cd "$(dirname "$0")"
TESTS_DIR="$PWD"
ROOT_DIR="$(cd .. && pwd)"
mkdir -p out

QUICK="features beats ui touch touch_phone mp mp_video"
FULL="$QUICK story1 story2 story3 story4 hard fuzz mp_edge mp_chaos"
case "${1:-quick}" in
  quick) NAMES="$QUICK" ;;
  full) NAMES="$FULL" ;;
  *) NAMES="$*" ;;
esac

cmd_for() {
  case "$1" in
    story1) echo "story.js story 0 careful 0 1000" ;;
    story2) echo "story.js story 1 careful 0 1000" ;;
    story3) echo "story.js story 2 careful 0 1000" ;;
    story4) echo "story.js story 3 careful 0 1000" ;;
    hard) echo "story.js free 0 careful 0 600 --hard" ;;
    fuzz) echo "fuzz.js 1" ;;
    mp_chaos) echo "mp_chaos.js easy,hard" ;;
    *) [ -f "$1.js" ] && echo "$1.js" ;;
  esac
}

# the game, served from the repo
STARTED=()
if ! curl -s -o /dev/null "http://localhost:8765/index.html"; then
  (cd "$ROOT_DIR" && exec python3 -m http.server 8765 >/dev/null 2>&1) &
  STARTED+=($!)
  for _ in $(seq 1 30); do curl -s -o /dev/null "http://localhost:8765/index.html" && break; sleep 0.3; done
fi
# a local PeerJS server for the online tests
if [[ " $NAMES " == *" mp"* ]]; then
  [ -d node_modules/peer ] || npm install --no-audit --no-fund --silent
  if ! curl -s -o /dev/null "http://127.0.0.1:9000/"; then
    node peer-server.cjs >out/peer.log 2>&1 &
    STARTED+=($!)
    sleep 1
  fi
fi
cleanup() { for p in "${STARTED[@]:-}"; do [ -n "$p" ] && kill "$p" 2>/dev/null; done; }
trap cleanup EXIT

export NODE_PATH="$(npm root -g):$TESTS_DIR/node_modules"
FAILED=()
printf '%-12s %-6s %s\n' TEST RESULT TIME
for n in $NAMES; do
  c="$(cmd_for "$n")"
  if [ -z "$c" ]; then echo "unknown test: $n"; FAILED+=("$n"); continue; fi
  t0=$(date +%s)
  # shellcheck disable=SC2086
  timeout 3600 node $c >"out/$n.log" 2>&1
  code=$?
  dt=$(( $(date +%s) - t0 ))
  if [ $code -eq 0 ]; then printf '%-12s %-6s %ss\n' "$n" PASS "$dt"
  else printf '%-12s %-6s %ss   %s\n' "$n" FAIL "$dt" "$(grep -m1 '^RESULT' "out/$n.log" | cut -c1-140)"; FAILED+=("$n"); fi
done
if [ ${#FAILED[@]} -eq 0 ]; then echo "ALL PASSED"; exit 0; fi
echo "FAILED: ${FAILED[*]}   (see tests/out/<name>.log)"
exit 1
