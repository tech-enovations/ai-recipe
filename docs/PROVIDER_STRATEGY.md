# LLM Provider Strategy - Dual Provider Support

## ✅ Implementation Complete

System now supports **both Google Gemini and OpenAI** with easy switching!

## Architecture

### Strategy Pattern
```
┌─────────────────────────────────────────┐
│          LLMService (Facade)            │
│  - Manages provider selection           │
│  - Handles retries & errors             │
│  - Exposes unified interface            │
└──────────────┬──────────────────────────┘
               │
               ├─── ILLMProvider (Interface)
               │    - getRecipeLLM()
               │    - getChatLLM()
               │    - getStructuredLLM()
               │    - isAvailable()
               │
               ├──► GeminiProvider
               │    - ChatGoogleGenerativeAI
               │    - Google embeddings (768-dim)
               │
               └──► OpenAIProvider
                    - ChatOpenAI
                    - OpenAI embeddings (1536-dim)
```

## Files Created

1. **`src/services/llm-provider.interface.ts`**
   - Interface definition for all providers

2. **`src/services/providers/gemini.provider.ts`**
   - Gemini implementation
   - Models: gemini-flash-latest
   - Embeddings: text-embedding-004 (768-dim)

3. **`src/services/providers/openai.provider.ts`**
   - OpenAI implementation
   - Models: gpt-4o-mini
   - Embeddings: text-embedding-3-small (1536-dim)

4. **`ENV_CONFIG.md`**
   - Complete configuration guide

## Files Modified

1. **`src/config/env.ts`**
   - Added `LLM_PROVIDER` selection
   - Separate configs for Gemini/OpenAI
   - Provider validation

2. **`src/services/llm.service.ts`**
   - Now uses strategy pattern
   - Auto-selects provider from ENV
   - Provider-specific error messages

3. **`src/services/vector-store.service.ts`**
   - Auto-selects embedding provider
   - Matches LLM provider choice

4. **`src/app.ts`**
   - Health endpoint shows current provider

## Usage

### Using Gemini (Default)
```bash
# .env
LLM_PROVIDER=gemini
GOOGLE_API_KEY=your_key_here
```

### Switching to OpenAI
```bash
# .env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your_key_here
```

### Check Current Provider
```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "healthy",
  "provider": {
    "llm": "gemini",
    "available": true
  }
}
```

## Provider Comparison

| Aspect | Gemini | OpenAI |
|--------|--------|--------|
| **Speed** | ⚡ Very Fast | 🐢 Medium |
| **Cost** | 💰 Free tier | 💸 Pay per token |
| **Quality** | ✨ Excellent | ✨ Excellent |
| **Rate Limits** | 15 RPM free | 3 RPM free, higher paid |
| **Models** | gemini-flash-latest | gpt-4o-mini |
| **Embeddings** | 768-dim | 1536-dim |
| **Structured Output** | ✅ Native | ✅ Function calling |

## Switching Checklist

### When switching FROM Gemini TO OpenAI:

1. ✅ Update `.env`:
   ```bash
   LLM_PROVIDER=openai
   OPENAI_API_KEY=sk-...
   ```

2. ⚠️ **IMPORTANT**: Clear existing embeddings
   ```bash
   # Option A: Drop collection
   # MongoDB Compass → Delete collection → Recreate
   
   # Option B: Create new collection
   MONGODB_ATLAS_COLLECTION_NAME=recipes_openai
   ```

3. ⚠️ Update MongoDB Atlas Vector Index:
   ```json
   {
     "fields": [{
       "type": "vector",
       "path": "embedding",
       "numDimensions": 1536,  // Changed from 768
       "similarity": "cosine"
     }]
   }
   ```

4. ✅ Restart server
   ```bash
   npm run dev
   ```

5. ✅ Verify in logs:
   ```
   Initializing OpenAI provider
   ✅ LLM Provider: OPENAI
   ```

### When switching FROM OpenAI TO Gemini:

Same steps, but:
- Set `numDimensions: 768`
- Use `MONGODB_ATLAS_COLLECTION_NAME=recipes` (original)

## Benefits

### 1. **Resilience**
```typescript
// If Gemini rate limited → Switch to OpenAI
LLM_PROVIDER=openai npm run dev
```

### 2. **Cost Optimization**
```
Development → Use Gemini (free)
Production → Use OpenAI (paid, more reliable)
```

### 3. **Quality Comparison**
```bash
# Test same recipe with both providers
LLM_PROVIDER=gemini npm run dev → Generate "Phở Bò"
LLM_PROVIDER=openai npm run dev → Generate "Phở Bò"
# Compare quality!
```

### 4. **No Code Changes**
```typescript
// Your handler code stays the same!
const { result } = await llmService.generateRecipe(prompt);

// LLMService internally uses correct provider
```

## Error Handling

### Provider-Specific Errors

**Gemini:**
```
Gemini API error: Response format invalid. 
Usually means rate limit.
```

**OpenAI:**
```
[OPENAI] Recipe generation failed after 3 attempts: 
Rate limit exceeded.
```

### Auto-Retry Logic
- 3 attempts total (0 + 2 retries)
- Exponential backoff: 1s, 2s, 5s
- Works for both providers

## Testing

### Test Both Providers

```bash
# Terminal 1: Gemini
LLM_PROVIDER=gemini npm run dev

# Test
curl -X POST http://localhost:3000/api/generate-recipe \
  -d '{"dishName": "Phở Bò"}' -H "Content-Type: application/json"

# Stop and switch

# Terminal 2: OpenAI
LLM_PROVIDER=openai npm run dev

# Test same request
curl -X POST http://localhost:3000/api/generate-recipe \
  -d '{"dishName": "Phở Bò"}' -H "Content-Type: application/json"
```

## Logs

### Gemini Startup:
```
Initializing Gemini provider
Gemini configured: recipe=gemini-flash-latest
✅ LLM Provider: GEMINI
Vector store using gemini embeddings
```

### OpenAI Startup:
```
Initializing OpenAI provider
OpenAI configured: recipe=gpt-4o-mini
✅ LLM Provider: OPENAI
Vector store using openai embeddings
```

## Future Enhancements

1. **Auto-Fallback**: If Gemini fails → auto-switch to OpenAI
2. **Load Balancing**: Distribute requests across providers
3. **Provider Stats**: Track success rate, latency per provider
4. **Cost Tracking**: Monitor API costs
5. **Provider Health Check**: Periodic availability testing

## Summary

✅ **Dual provider support implemented**
✅ **Easy switching via .env**
✅ **Auto-selects embeddings to match**
✅ **Provider-specific error handling**
✅ **Zero code changes in handlers**
✅ **Health endpoint shows current provider**

**Next Steps:**
1. Add OPENAI_API_KEY to .env
2. Test switching: `LLM_PROVIDER=openai npm run dev`
3. Update MongoDB index if switching permanently


