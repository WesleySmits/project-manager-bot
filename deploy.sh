#!/bin/bash
set -e

ECHO_PREFIX="[DEPLOY-PM]"

echo "$ECHO_PREFIX 🚀 Starting deployment..."

# 1. Build
echo "$ECHO_PREFIX 📦 Installing..."
npm install
# Note: No build step as this is currently pure JS

# 2. Stop existing process
echo "$ECHO_PREFIX 🛑 Stopping old process..."
# Kill all instances of PM bot (index.js in this directory)
# We rely on specific identifying string if possible or CWD.
# Simplest for now: Kill node process running this index.js?
# PM2 is better, but for now we follow the PA pattern.
# WARNING: pkill -f "node index.js" might leave ambiguity if not careful.
# But since we run from specific dir, let's try to be safe.
# Actually, let's save the PID file?
# For now, simplistic approach:
pkill -f "node index.js" || echo "$ECHO_PREFIX No running process found."

# 3. Start new process
echo "$ECHO_PREFIX 🟢 Starting new process..."
LOG_OUT="/home/openclaw/temp_bots/logs/pm-bot.out.log"
LOG_ERR="/home/openclaw/temp_bots/logs/pm-bot.err.log"

nohup node index.js > "$LOG_OUT" 2> "$LOG_ERR" &
NEW_PID=$!

# 4. Verify
echo "$ECHO_PREFIX 👀 Verifying startup (PID: $NEW_PID)..."
sleep 3

if ps -p $NEW_PID > /dev/null; then
   echo "$ECHO_PREFIX ✅ Bot is running!"
   echo "$ECHO_PREFIX 📜 Last 5 log lines:"
   tail -n 5 "$LOG_OUT"
else
   echo "$ECHO_PREFIX ❌ Bot failed to start immediately."
   echo "$ECHO_PREFIX 📜 Error Log:"
   cat "$LOG_ERR"
   exit 1
fi
