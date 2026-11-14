#!/usr/bin/env bash
# Run the browser tests.  Usage:
#   bash tests/run.sh quick          features, story beats, menus, touch, pranks, the relay function, 2-player online,
#                                    videos + pranks online, joining (relays, retries, the host's lobby), the lobby on phones (~10 min)
#   bash tests/run.sh full           quick + all 4 story periods, Hard, random input, connection edge cases,
#                                    failed joins (no relay, timeouts, a taken code), 3-player chaos (~17 min)
#   bash tests/run.sh features ui    just those
# Logs: tests/out/<name>.log   Screenshots: tests/out/*.png
set -u
cd "$(dirname "$0")"
TESTS_DIR="$PWD"
ROOT_DIR="$(cd .. && pwd)"
mkdir -p out

QUICK="features beats ui touch touch_phone pranks turn_api mp mp_video mp_prank mp_net mp_lobby"
FULL="$QUICK story1 story2 story3 story4 hard fuzz mp_edge mp_fail mp_chaos"
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

# Ports: TEST_PORT / PEER_PORT let several copies of the repo run tests at the same time.
PORT="${TEST_PORT:-8765}"
PEER_PORT="${PEER_PORT:-9000}"
export PEER_PORT BASE_URL="http://localhost:$PORT" PEER="127.0.0.1:$PEER_PORT"

# the game, served from the repo (plus api/turn, answered like Vercel does with no relay set up)
STARTED=()
if ! curl -s -o /dev/null "http://localhost:$PORT/index.html"; then
  (cd "$ROOT_DIR" && exec python3 tests/serve.py "$PORT" >/dev/null 2>&1) &
  STARTED+=($!)
  for _ in $(seq 1 30); do curl -s -o /dev/null "http://localhost:$PORT/index.html" && break; sleep 0.3; done
fi
# a local PeerJS server for the online tests
if [[ " $NAMES " == *" mp"* ]]; then
  [ -d node_modules/peer ] || npm install --no-audit --no-fund --silent
  if ! curl -s -o /dev/null "http://127.0.0.1:$PEER_PORT/"; then
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
