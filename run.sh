#!/usr/bin/env bash
#
# Start the MoreTasks Screens dev server.
#
#   ./run.sh          # port 3000
#   ./run.sh 3001     # port 3001
#   PORT=3001 ./run.sh
#
# Then open the printed URL and pick a tab: Birthday, MVP, Anniversary, Moments.
#
set -euo pipefail

# Run from the project this script lives in, whatever directory it was called
# from. This matters here: the repo is normally checked out more than once (a
# main copy plus per-task git worktrees), and each copy has to serve its own
# source, not whichever one happened to be the shell's cwd.
cd "$(dirname "${BASH_SOURCE[0]}")"

PORT="${1:-${PORT:-3000}}"

if ! [[ "$PORT" =~ ^[0-9]+$ ]]; then
  echo "run.sh: '$PORT' is not a port number" >&2
  exit 2
fi

# Every worktree needs its own node_modules. Symlinking one in from the main
# checkout looks like it should work and does not: Next's bundler refuses a
# node_modules that resolves outside the project root, and dies at startup.
if [ ! -d node_modules ]; then
  echo "==> Installing dependencies (first run in this checkout, ~1 min)"
  npm install --no-audit --no-fund
  echo
fi

# Checked before starting so the failure is one clear line, rather than Next
# booting, claiming the port, and then falling over.
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "run.sh: port $PORT is already in use." >&2
  echo "        another server is probably still running — try: ./run.sh $((PORT + 1))" >&2
  exit 1
fi

# npm skips these two packages' install scripts by default, which is easy to
# miss because the app itself runs fine without them: the "Download video"
# button encodes in the browser. Only the command-line render path needs them.
if [ ! -d "$HOME/.cache/puppeteer" ]; then
  echo "note: 'npm run render' / 'still' / 'diff' need a browser that has not been downloaded."
  echo "      to enable them:  npm approve-scripts --allow-scripts-pending"
  echo "      the app and its in-browser video export work regardless."
  echo
fi

echo "==> http://localhost:$PORT"
echo "    (ctrl-c to stop)"
echo

# exec so ctrl-c reaches Next directly instead of this wrapper.
exec npm run dev -- -p "$PORT"
