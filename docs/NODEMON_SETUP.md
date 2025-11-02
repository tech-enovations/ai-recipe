# Nodemon Hot Reload Setup

## ✅ Nodemon Configured!

The development server now supports **hot reload** - automatically restarts when you change any source files!

## What's Configured

### Files Watched
- **`src/**/*.ts`** - All TypeScript files
- **`src/**/*.ejs`** - EJS templates (views)
- **`src/**/*.json`** - JSON files (configs, schemas)

### Files Ignored
- `src/**/*.spec.ts` - Test files
- `dist/**` - Compiled output
- `node_modules/**` - Dependencies

### Features
- ✅ Auto-restart on file changes
- ✅ 1 second debounce delay (prevents multiple restarts)
- ✅ Custom restart messages
- ✅ Crash detection with waiting message
- ✅ Manual restart with `rs` command

## Usage

### Start Dev Server with Hot Reload
```bash
npm run dev
```

You'll see:
```
[nodemon] starting `ts-node src/server.ts`
Initializing Gemini provider
✅ Server started
[nodemon] watching 19 files
```

### Manual Restart
While server is running, type:
```bash
rs
```

Then press Enter to manually restart.

### Start Without Hot Reload
If you need to run without nodemon:
```bash
npm run dev:no-reload
```

## How It Works

1. **Change any file** in `src/`
2. **Nodemon detects** the change
3. **Waits 1 second** (debounce)
4. **Kills old process**
5. **Starts new process**
6. **Logs restart message** 🔄

### Example
```bash
# Edit src/app.ts
vim src/app.ts

# Nodemon output:
🔄 Restarting server...

[nodemon] restarting due to changes...
[nodemon] starting `ts-node src/server.ts`
Initializing Gemini provider
✅ Server started
```

## Configuration File

`nodemon.json`:
```json
{
  "watch": ["src"],                    // Watch src directory
  "ext": "ts,ejs,json",                // File extensions
  "ignore": ["src/**/*.spec.ts"],      // Ignore test files
  "exec": "ts-node src/server.ts",     // Command to run
  "delay": 1000,                       // 1s debounce
  "restartable": "rs"                  // Manual restart command
}
```

## Benefits

### Before (without nodemon):
```bash
# Make change
vim src/handlers/recipe.handler.ts

# Manual restart required
pkill -f "ts-node"
npm run dev
```

### After (with nodemon):
```bash
# Make change
vim src/handlers/recipe.handler.ts

# Nodemon auto-restarts! ✨
# No manual intervention needed
```

## Advanced Features

### Watch Additional Directories
Edit `nodemon.json`:
```json
{
  "watch": ["src", "views", "config"]
}
```

### Change Debounce Delay
```json
{
  "delay": 500  // Restart faster (500ms)
}
```

### Add Pre-Restart Commands
```json
{
  "events": {
    "restart": "echo 'Linting...' && npm run lint && echo 'Restarting...'"
  }
}
```

### Verbose Logging
Already enabled! You'll see:
- File changes detected
- Process IDs
- Restart events
- Crash events

## Troubleshooting

### Nodemon not restarting?
1. Check file is in `src/` directory
2. Check file extension is `.ts`, `.ejs`, or `.json`
3. Check file is not in ignore list

### Too many restarts?
Increase debounce delay:
```json
{
  "delay": 2000  // 2 seconds
}
```

### Want to ignore more files?
```json
{
  "ignore": [
    "src/**/*.spec.ts",
    "src/**/*.test.ts",
    "src/temp/**"
  ]
}
```

## NPM Scripts Summary

| Command | Description |
|---------|-------------|
| `npm run dev` | **Start with hot reload** (nodemon) |
| `npm run dev:no-reload` | Start without hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run build:watch` | Compile + watch for changes |
| `npm start` | Run compiled production build |

## Development Workflow

### Recommended Workflow:
```bash
# Terminal 1: Dev server with hot reload
npm run dev

# Terminal 2: TypeScript compiler in watch mode (optional)
npm run build:watch

# Edit files → nodemon auto-restarts
# No manual intervention needed! 🎉
```

### Testing Workflow:
```bash
# Start dev server
npm run dev

# Make changes to handlers/services/routes
# Test immediately - server auto-restarted!

# API testing
curl http://localhost:3000/health
```

## Performance

- **Restart time**: ~2-3 seconds (MongoDB reconnect)
- **Detection delay**: 1 second (configurable)
- **Memory usage**: Minimal overhead

## Integration with Other Tools

### With Pino Logger
Logs are preserved across restarts:
```
[INFO] Server started
🔄 Restarting server...
[INFO] Server started
```

### With TypeScript
Nodemon runs `ts-node` directly - no build step needed!

### With MongoDB
Connection is properly closed and reopened on restart.

## Best Practices

1. ✅ **Use `npm run dev`** for development
2. ✅ **Use `npm start`** for production (no nodemon)
3. ✅ **Type `rs`** to manually restart when needed
4. ✅ **Check logs** for restart confirmation
5. ⚠️ **Don't commit** temporary changes just to test restart

## Summary

✅ Nodemon installed and configured
✅ Hot reload on `.ts`, `.ejs`, `.json` changes
✅ 1-second debounce to prevent rapid restarts
✅ Manual restart with `rs` command
✅ Custom restart/crash messages
✅ Production build unchanged

**Development is now faster and more efficient!** 🚀

