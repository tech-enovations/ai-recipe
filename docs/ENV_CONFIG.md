# Environment Configuration Guide

## LLM Provider Strategy

This application supports **dual LLM providers**: Google Gemini and OpenAI.

### Quick Setup

#### Option 1: Use Google Gemini (Default)
```bash
LLM_PROVIDER=gemini
GOOGLE_API_KEY=your_google_api_key_here
```

#### Option 2: Use OpenAI
```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key_here
```

### Full Configuration

```bash
# Server
PORT=3000
NODE_ENV=development
API_URL=http://localhost:3000

# ==============================================
# LLM Provider Selection (gemini or openai)
# ==============================================
LLM_PROVIDER=gemini

# Google Gemini API
GOOGLE_API_KEY=your_google_api_key_here

# OpenAI API
OPENAI_API_KEY=your_openai_api_key_here

# MongoDB Atlas
MONGODB_ATLAS_URI=mongodb+srv://username:password@cluster.mongodb.net/
MONGODB_ATLAS_DB_NAME=ai_recipe_db
MONGODB_ATLAS_COLLECTION_NAME=recipes
MONGODB_ATLAS_INDEX_NAME=vector_index

# Gemini Models
GEMINI_RECIPE_MODEL=gemini-flash-latest
GEMINI_CHAT_MODEL=gemini-flash-latest
GEMINI_EMBEDDING_MODEL=text-embedding-004

# OpenAI Models
OPENAI_RECIPE_MODEL=gpt-4o-mini
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

## Provider Comparison

| Feature | Gemini | OpenAI |
|---------|--------|--------|
| Recipe Model | gemini-flash-latest | gpt-4o-mini |
| Chat Model | gemini-flash-latest | gpt-4o-mini |
| Embedding Model | text-embedding-004 | text-embedding-3-small |
| Embedding Dims | **768** | **1536** |
| Speed | Fast | Medium |
| Cost | Free tier generous | Pay per token |
| Structured Output | ✅ | ✅ |

## Switching Providers

### 1. Switch from Gemini to OpenAI

```bash
# Step 1: Set provider
LLM_PROVIDER=openai

# Step 2: Ensure OpenAI key is set
OPENAI_API_KEY=sk-...

# Step 3: (IMPORTANT) Clear existing embeddings
# MongoDB embeddings are 768-dim (Gemini)
# OpenAI needs 1536-dim

# Option A: Drop and recreate collection
# Option B: Create new collection with different index
```

### 2. MongoDB Vector Index Dimensions

**Gemini (768 dimensions):**
```json
{
  "fields": [{
    "type": "vector",
    "path": "embedding",
    "numDimensions": 768,
    "similarity": "cosine"
  }]
}
```

**OpenAI (1536 dimensions):**
```json
{
  "fields": [{
    "type": "vector",
    "path": "embedding",
    "numDimensions": 1536,
    "similarity": "cosine"
  }]
}
```

## Strategy Pattern Architecture

### Files Structure
```
src/services/
├── llm.service.ts                    # Main service (uses strategy)
├── llm-provider.interface.ts         # Interface definition
├── providers/
│   ├── gemini.provider.ts           # Gemini implementation
│   └── openai.provider.ts           # OpenAI implementation
└── vector-store.service.ts          # Auto-selects embedding provider
```

### How It Works

```typescript
// 1. Interface defines contract
interface ILLMProvider {
  getRecipeLLM(): BaseChatModel;
  getChatLLM(): BaseChatModel;
  getStructuredLLM(): any;
  getProviderName(): string;
  isAvailable(): boolean;
}

// 2. Each provider implements interface
class GeminiProvider implements ILLMProvider { ... }
class OpenAIProvider implements ILLMProvider { ... }

// 3. Service selects provider at runtime
class LLMService {
  private provider: ILLMProvider;
  
  constructor() {
    this.provider = ENV.LLM_PROVIDER === "openai" 
      ? new OpenAIProvider() 
      : new GeminiProvider();
  }
}
```

## Benefits

1. **Easy Switching**: Change one env variable
2. **Fallback**: If one provider fails, switch to another
3. **Cost Optimization**: Use free tier when possible
4. **A/B Testing**: Compare quality between providers
5. **No Code Changes**: Just update .env

## Usage

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

### Test Recipe Generation
```bash
# Works with both providers!
curl -X POST http://localhost:3000/api/generate-recipe \
  -H "Content-Type: application/json" \
  -d '{"dishName": "Phở Bò", "servingSize": 2}'
```

## Troubleshooting

### "Provider not available" error
- Check API key is set correctly
- Verify key format (Gemini vs OpenAI different)
- Test key with direct API call

### Different results with same provider
- Temperature setting affects randomness
- Set `TEMPERATURE=0` for deterministic output

### Embeddings dimension mismatch
- Cannot mix Gemini (768) and OpenAI (1536) in same index
- Must clear DB when switching providers
- Or use separate collections per provider


