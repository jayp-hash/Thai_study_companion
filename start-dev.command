#!/bin/bash
# Double-click this file in Finder to start the Thai Study Companion dev
# server — no Terminal typing, no cd-ing, no hunting for the right port.
#
# What it does:
#   1. Moves into this project folder (wherever it's actually located)
#   2. Kills any leftover dev server still holding port 3000 (this is what
#      caused the "moved to 3001" confusion earlier)
#   3. Starts `npm run dev`
#   4. Opens http://localhost:3000 in your browser automatically

cd "$(dirname "$0")"

PORT=3000
PID=$(lsof -ti tcp:$PORT)
if [ -n "$PID" ]; then
  echo "Port $PORT was still in use (leftover server) — stopping it first..."
  kill -9 $PID
  sleep 1
fi

echo "Starting dev server..."
( sleep 3 && open "http://localhost:$PORT" ) &

npm run dev
