#!/usr/bin/env bash
#
# Double-click this file to play.
#
# It does everything the terminal instructions do — installs what is missing
# the first time, builds the app, starts the server and opens the browser —
# so a party night needs no typing. Close the window, or press Ctrl-C, to
# stop it.
#
# macOS may refuse to run it the first time, because it came out of a zip
# and has no signature: right-click the file and choose Open, then Open
# again, and it will run without asking ever after.

cd "$(dirname "$0")" || exit 1

say() { printf '\n  %s\n\n' "$1"; }
hold() {
  printf '  Press any key to close this window.'
  read -r -n 1 -s
  printf '\n'
}

if ! command -v node >/dev/null 2>&1; then
  say "Node.js is not installed."
  echo "  Get the LTS version from https://nodejs.org, then double-click this again."
  echo ""
  hold
  exit 1
fi

# The first run only: fetch the dependencies.
if [ ! -d node_modules ]; then
  say "First run — installing what the game needs. This takes a minute."
  if ! npm install; then
    say "That install did not finish. The message above says why."
    hold
    exit 1
  fi
fi

say "Building…"
if ! npm run build; then
  say "The build failed. The message above says why."
  hold
  exit 1
fi

PORT="${PORT:-5173}"
export PORT

# Give the server a moment to bind, then open a browser on this computer.
# Everybody else uses the address the server prints, which is the one on the
# wifi rather than this one.
(
  sleep 1.5
  if command -v open >/dev/null 2>&1; then
    open "http://localhost:${PORT}"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:${PORT}"
  fi
) &

node server/server.js
