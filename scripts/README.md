# Scripts Directory

## reindex-embeddings.ts

Re-generate embeddings for all recipes with current weight settings.

### When to Use

Run this script when you:
- Change `DISHNAME_WEIGHT` in `.env`
- Change `CATEGORY_WEIGHT` in `.env`
- Switch `LLM_PROVIDER` (e.g., gemini → openai)
- Want to improve search quality with updated weights

### Usage

**Interactive (with confirmation):**
```bash
npm run reindex
```

**Auto-confirm (for scripts/CI):**
```bash
npm run reindex:confirm
```

**Direct execution:**
```bash
ts-node scripts/reindex-embeddings.ts --yes
```

### What It Does

1. ✅ Connects to MongoDB
2. ✅ Fetches all recipe documents
3. ✅ For each recipe:
   - Rebuilds text with current `DISHNAME_WEIGHT` & `CATEGORY_WEIGHT`
   - Generates new embedding
   - Updates document in MongoDB
4. ✅ Shows progress every 10 recipes
5. ✅ Reports final results

### Example Output

```
╔═══════════════════════════════════════════════════════════╗
║           Recipe Embeddings Reindexing Tool              ║
╚═══════════════════════════════════════════════════════════╝

📊 Current Settings:
   LLM Provider: gemini
   Dish Name Weight: 3x
   Category Weight: 2x
   Max Text Length: 500 chars

⚠️  WARNING: This will re-generate embeddings for ALL recipes!
   This operation:
   - May take several minutes
   - Uses embedding API quota
   - Cannot be undone

🚀 Starting reindex...

✅ Connected to MongoDB

[INFO] Starting reindex of 50 recipes with weights (dish: 3x, category: 2x)
[INFO] Reindex progress: 10/50
[INFO] Reindex progress: 20/50
[INFO] Reindex progress: 30/50
[INFO] Reindex progress: 40/50
[INFO] Reindex progress: 50/50
[INFO] Reindex complete: 50 success, 0 failed out of 50 total

╔═══════════════════════════════════════════════════════════╗
║                   REINDEX COMPLETE!                       ║
╚═══════════════════════════════════════════════════════════╝

📊 Results:
   Total recipes: 50
   ✅ Success: 50
   ❌ Failed: 0

🎉 All recipes reindexed successfully!
```

### Cost Estimate

**Gemini (FREE):**
- Cost: $0
- Time: ~2-5 minutes for 100 recipes

**OpenAI:**
- Model: text-embedding-3-small
- Dimensions: 512 (optimized)
- Cost: ~$0.002 per 100 recipes
- Time: ~3-7 minutes for 100 recipes

### Error Handling

If reindex fails:
1. Check logs for specific error
2. Common issues:
   - MongoDB connection timeout
   - Embedding API quota exceeded
   - Invalid document format
3. Fix issue and re-run
4. Script is idempotent - safe to re-run

### Safety

- ✅ **Idempotent**: Safe to run multiple times
- ✅ **In-place updates**: Original data preserved
- ✅ **Progress tracking**: Know where it failed
- ⚠️ **No rollback**: Cannot undo once complete

### Performance Tips

**For large datasets (1000+ recipes):**

1. **Use Gemini** (free, unlimited):
   ```bash
   LLM_PROVIDER=gemini npm run reindex:confirm
   ```

2. **Run during off-hours**:
   - Less API traffic
   - Better performance

3. **Monitor progress**:
   ```bash
   npm run reindex:confirm 2>&1 | tee reindex.log
   ```

4. **Batch processing** (future enhancement):
   - Split into chunks
   - Parallel processing
   - Rate limiting

### Troubleshooting

**"Cannot find module" error:**
```bash
# Make sure you're in project root
cd /path/to/ai-recipe
npm run reindex
```

**"MongoDB connection failed":**
```bash
# Check .env file
cat .env | grep MONGODB_ATLAS_URI

# Test connection
mongosh "$MONGODB_ATLAS_URI"
```

**"Insufficient quota" (OpenAI):**
```bash
# Switch to Gemini (free)
echo "LLM_PROVIDER=gemini" >> .env
npm run reindex:confirm
```

**Script hangs/stuck:**
```bash
# Kill and restart
pkill -f "ts-node"
npm run reindex:confirm
```

### Advanced Usage

**Reindex specific recipe:**

```typescript
// In Node REPL or custom script
import { vectorStoreService } from "./src/services/vector-store.service";

await vectorStoreService.initialize();
await vectorStoreService.reindexRecipe("Phở Gà");
await vectorStoreService.close();
```

**Dry run (check without updating):**

Add dry-run flag to script (future enhancement).

### See Also

- `EMBEDDING_WEIGHTS.md` - Weight optimization guide
- `EMBEDDING_OPTIMIZATION.md` - Size/cost optimization
- `RAG_BOOSTING.md` - Search quality improvements

