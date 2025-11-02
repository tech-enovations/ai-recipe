# Troubleshooting Guide

## No Logs Showing When Running Local

### Problem

When you run `npm run dev`, you don't see any logs.

### Root Cause

**Multiple server instances running in background** - When you run commands with `&` or in background, their output goes to a different stream and you won't see logs in your current terminal.

### Solution 1: Use the Dev Script (Recommended)

```bash
# Stop all instances and start fresh with visible logs
./dev.sh
```

This script:
1. ✅ Stops all existing instances
2. ✅ Starts fresh instance
3. ✅ Shows all logs in current terminal
4. ✅ Runs in foreground

### Solution 2: Manual Cleanup

```bash
# 1. Stop all instances
pkill -f "nodemon"
pkill -f "ts-node"

# 2. Wait a moment
sleep 2

# 3. Verify all stopped
ps aux | grep -E "(nodemon|ts-node)" | grep -v grep
# Should show nothing

# 4. Start fresh (DON'T use & at the end!)
npm run dev
```

### Solution 3: Check Background Processes

```bash
# See what's running
ps aux | grep -E "(nodemon|ts-node)" | grep -v grep

# You might see multiple instances like:
# quill   76970  nodemon
# quill   15715  ts-node src/server.ts
# quill   16049  ts-node src/server.ts

# Kill specific PID
kill 76970 15715 16049

# Or kill all
pkill -f "nodemon"
```

## Why Multiple Instances Happen

### Common Causes

1. **Running with `&` (background)**
   ```bash
   npm run dev &  # ❌ Runs in background, logs hidden
   npm run dev    # ✅ Runs in foreground, logs visible
   ```

2. **Not killing previous instance before restarting**
   ```bash
   npm run dev  # First instance
   # Ctrl+C
   npm run dev  # Second instance (first one might still be running!)
   ```

3. **Terminal window closed but process still running**
   ```bash
   # If you close terminal, nodemon might keep running
   # Always check: ps aux | grep nodemon
   ```

## How to See Logs from Background Process

If you accidentally started in background:

### Method 1: Find and Follow Logs

```bash
# Nodemon might be writing to a log file
# Check package.json or nodemon.json for log config

# Or redirect future logs
npm run dev > dev.log 2>&1 &
tail -f dev.log
```

### Method 2: Attach to Process (Advanced)

```bash
# Not recommended - better to restart
# Use strace/dtrace but it's complex
```

### Method 3: Just Restart in Foreground

```bash
pkill -f "nodemon"
npm run dev  # No & at the end!
```

## Verify Logs Are Working

After starting the server, you should see:

```
[nodemon] 3.1.10
[nodemon] to restart at any time, enter `rs`
[nodemon] watching path(s): src/**/*
[nodemon] watching extensions: ts,ejs,json
[nodemon] starting `ts-node src/server.ts`

Initializing Gemini provider
Gemini configured: recipe=gemini-flash-latest
✅ LLM Provider: GEMINI
[INFO] LLM Service initialized with provider: gemini
[INFO] Vector store using gemini embeddings
[INFO] 🚀 Server starting
[INFO] ✅ MongoDB connected
[INFO] ✅ Vector store initialized
[INFO] ✅ Server started
```

If you DON'T see this, you have the "no logs" issue!

## Quick Check Checklist

- [ ] Only 1 nodemon process running?
  ```bash
  ps aux | grep nodemon | grep -v grep | wc -l
  # Should output: 1
  ```

- [ ] Server running in foreground (current terminal)?
  ```bash
  # You should see nodemon output in your terminal
  # If terminal is "free" to type, server is in background
  ```

- [ ] No `&` in your run command?
  ```bash
  npm run dev     # ✅ Good
  npm run dev &   # ❌ Bad (background)
  ```

## Common Log Issues

### Issue: "Server started" but no request logs

**Problem:** Requests aren't being logged

**Solution:** Check that request logging middleware is enabled:

```typescript
// src/app.ts should have:
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    log.info(`${req.method} ${req.path}`, {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${Date.now() - start}ms`,
    });
  });
  next();
});
```

### Issue: Logs showing but not colored

**Problem:** Pino-pretty not working

**Solution:**
```bash
# Check pino-pretty is installed
npm list pino-pretty

# Should show:
# pino-pretty@11.3.0

# If missing:
npm install --save pino-pretty
```

### Issue: Log level too high (missing debug logs)

**Problem:** `DEBUG` level logs not showing

**Solution:**
```typescript
// src/utils/logger.ts
const logger = pino({
  level: "trace",  // ← Should be "trace" not "info"
  // ...
});
```

## NPM Scripts

### Available Commands

```bash
# Development with hot reload (recommended)
npm run dev

# Development without hot reload (debugging)
npm run dev:no-reload

# Production build
npm run build

# Production start (no logs, use PM2 instead)
npm start

# Build and watch TypeScript
npm run build:watch
```

### Which One Shows Logs?

| Command | Logs Visible? | Use Case |
|---------|---------------|----------|
| `npm run dev` | ✅ Yes | Development (recommended) |
| `npm run dev:no-reload` | ✅ Yes | Debug without restart |
| `npm start` | ⚠️ Minimal | Production |
| `./dev.sh` | ✅ Yes | Best for development |

## Using the Dev Script

The `dev.sh` script is the **best way** to start development:

```bash
# Make executable (first time only)
chmod +x dev.sh

# Run it
./dev.sh
```

**Benefits:**
- ✅ Auto-stops old instances
- ✅ Shows provider info
- ✅ Logs visible
- ✅ Clean startup

**Output:**
```
╔═══════════════════════════════════════════════════════════╗
║              AI Recipe - Development Server               ║
╚═══════════════════════════════════════════════════════════╝

🔍 Checking for existing server instances...
✅ No existing instances found

🚀 Starting development server with hot reload...
   - Provider: gemini
   - Hot reload: enabled (nodemon)
   - Logs: visible in this terminal

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[nodemon] starting `ts-node src/server.ts`
Initializing Gemini provider
✅ Server started
```

## Still No Logs?

If you've tried everything and still no logs:

1. **Check if server is actually starting:**
   ```bash
   curl http://localhost:3000/health
   # Should return JSON
   ```

2. **Check port is not in use:**
   ```bash
   lsof -i :3000
   # Should show nodemon/ts-node
   ```

3. **Try with explicit output:**
   ```bash
   npm run dev 2>&1 | tee dev.log
   # Logs to both terminal and file
   ```

4. **Check NODE_ENV:**
   ```bash
   echo $NODE_ENV
   # Should be "development" or empty
   
   # If it's "production", logs are minimal
   # Fix:
   export NODE_ENV=development
   npm run dev
   ```

5. **Rebuild and try again:**
   ```bash
   npm run build
   npm run dev
   ```

## Summary

✅ **Best practice:** Use `./dev.sh` to start development
✅ **Always check:** `ps aux | grep nodemon` before starting
✅ **Never use `&`:** Unless you want background execution
✅ **Kill all first:** `pkill -f "nodemon"` before restart
✅ **Logs should be visible:** If not, you're in background mode

**If no logs showing → You have multiple instances or running in background!**

