# Fix: "Cannot read properties of undefined (reading 'parts')"

## Problem
Error occurs when using Google Gemini with LangChain:
```
Cannot read properties of undefined (reading 'parts')
```

## Root Causes
1. **Gemini API Rate Limit**: Too many requests in short time
2. **Invalid Response Format**: Gemini returns malformed response
3. **API Errors**: Internal Gemini server errors (503, 429)
4. **Timeout**: Request takes too long

## Solution Implemented

### 1. Better Error Handling
`src/services/llm.service.ts` - Added try-catch with specific error messages:

```typescript
async generateRecipe(prompt: string, timeout: number, retries: number = 2)
```

**Features:**
- Catches 'parts' error and provides user-friendly message
- Validates result structure before returning
- Specific error messages for different failure types

### 2. Automatic Retry with Exponential Backoff
- **Max retries**: 2 (total 3 attempts)
- **Backoff delays**: 1s, 2s, 5s (max)
- **Smart retry**: Skips retry for timeout/validation errors

### 3. Error Messages

**Before:**
```
Error: Cannot read properties of undefined (reading 'parts')
```

**After:**
```
Gemini API error: Response format invalid. 
This usually means rate limit or API error. 
Please try again in a few moments.
```

## How It Works

### Flow:
```
Attempt 1: Generate recipe
    ↓ (fails with 'parts' error)
Wait 1 second
    ↓
Attempt 2: Retry
    ↓ (fails again)
Wait 2 seconds
    ↓
Attempt 3: Final retry
    ↓ (success or throw user-friendly error)
```

### Retry Logic:
```typescript
for (let attempt = 0; attempt <= retries; attempt++) {
  try {
    if (attempt > 0) {
      // Exponential backoff: 1s, 2s, 5s
      await delay(Math.min(1000 * Math.pow(2, attempt - 1), 5000));
    }
    return await this.structuredLLM.invoke(prompt);
  } catch (error) {
    // Don't retry timeout/validation errors
    if (isNonRetryable(error)) break;
  }
}
```

## Testing

### Test Rate Limit Scenario:
```bash
# Generate 5 recipes quickly to trigger rate limit
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/generate-recipe \
    -H "Content-Type: application/json" \
    -d '{"dishName": "Phở Bò '$i'", "servingSize": 2}'
  sleep 1
done
```

**Expected behavior:**
- First 2-3 succeed
- 4th-5th may fail initially
- Auto-retry kicks in
- Eventually succeeds or shows clear error message

### Monitor Retries:
Check server logs for:
```
Retry attempt 1/2 after 1000ms delay...
Retry attempt 2/2 after 2000ms delay...
```

## Prevention Tips

1. **Rate Limit Prevention:**
   - Add delay between requests in UI
   - Implement request queue
   - Cache results when possible

2. **Timeout Management:**
   - Default: 30 seconds (ENV.REQUEST_TIMEOUT)
   - Increase for complex recipes: `generateRecipe(prompt, 60000)`

3. **Fallback Strategy:**
   - If structured output fails repeatedly
   - Consider fallback to non-structured LLM
   - Store last successful recipe as template

## Configuration

### Adjust Retry Settings:
```typescript
// In handler
const { result, duration } = await llmService.generateRecipe(
  prompt, 
  30000,  // timeout ms
  3       // max retries (default: 2)
);
```

### Environment Variables:
```bash
REQUEST_TIMEOUT=30000  # 30 seconds default
```

## Files Modified
- `src/services/llm.service.ts` - Added retry logic and better error handling

## Related Issues
- Gemini API quotas: https://ai.google.dev/pricing
- LangChain Gemini docs: https://js.langchain.com/docs/integrations/chat/google_generativeai

