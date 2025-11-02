#!/bin/bash

# Development server startup script with proper logging

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║              AI Recipe - Development Server               ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Stop any existing instances
echo "🔍 Checking for existing server instances..."
EXISTING=$(ps aux | grep -E "(nodemon|ts-node src/server)" | grep -v grep | wc -l)

if [ "$EXISTING" -gt 0 ]; then
  echo "⚠️  Found $EXISTING running instance(s). Stopping them..."
  pkill -f "nodemon" 2>/dev/null
  pkill -f "ts-node src/server.ts" 2>/dev/null
  sleep 2
  echo "✅ Stopped all instances"
else
  echo "✅ No existing instances found"
fi

echo ""
echo "🚀 Starting development server with hot reload..."
echo "   - Provider: ${LLM_PROVIDER:-gemini}"
echo "   - Hot reload: enabled (nodemon)"
echo "   - Logs: visible in this terminal"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Run nodemon in foreground (logs visible)
npm run dev

