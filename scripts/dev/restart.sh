#!/bin/bash
# Restart the local server in the background (development helper).
cd "$(dirname "$0")/../.."
if [ -f /tmp/claude-0/server.pid ]; then kill "$(cat /tmp/claude-0/server.pid)" 2>/dev/null; sleep 0.4; fi
nohup node dist/server.cjs > /tmp/claude-0/server.log 2>&1 &
echo $! > /tmp/claude-0/server.pid
sleep 1.2
curl -s -o /dev/null -w "server: %{http_code}\n" http://localhost:3000/healthz
