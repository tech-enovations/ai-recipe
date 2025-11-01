# AI Recipe Generator with Vector Search

API tạo công thức nấu ăn sử dụng Google Gemini và MongoDB Atlas Vector Search.

## Features

### 🥘 **Reverse Recipe Suggestion** (NEW!)
- **From Ingredients to Dish**: Input what you have in your kitchen, AI suggests what you can cook
- **Cooking Style Selection**: Choose between dry dishes (stir-fry, grilled), soup/broth, or any style
- **Feasibility Analysis**: Each suggestion includes feasibility rating and missing ingredients
- **Smart RAG Integration**: Finds similar recipes from the database to inspire suggestions
- **Vietnam-focused**: Optimized for Vietnamese ingredients and cooking styles



- ✅ Generate detailed recipes with structured output (ingredients, steps, timing)
- ✅ **RAG-Enhanced Generation**: Retrieves similar recipes to provide better context
- ✅ Support multiple categories: quick, easy, healthy
- ✅ Multi-language support: Vietnamese & English
- ✅ Vector-based semantic search powered by MongoDB Atlas
- ✅ Automatic recipe embedding and storage

## Prerequisites

- Node.js 18+
- MongoDB Atlas account (for vector search)
- Google AI API key (get from https://aistudio.google.com/app/apikey)

## Installation

```bash
npm install
```

## Environment Variables

Create a `.env` file in the root directory:

```env
# Google AI API Key
GOOGLE_API_KEY=your_google_api_key_here

# MongoDB Atlas Configuration (optional, enables vector search)
MONGODB_ATLAS_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
MONGODB_ATLAS_DB_NAME=ai_recipe_db
MONGODB_ATLAS_COLLECTION_NAME=recipes
MONGODB_ATLAS_INDEX_NAME=vector_index
```

### MongoDB Atlas Vector Search Setup

1. Create a MongoDB Atlas cluster
2. Create a database and collection
3. Create a vector search index with the following configuration:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 768,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "metadata.categories"
    },
    {
      "type": "filter",
      "path": "metadata.language"
    }
  ]
}
```

**Note**: Google's `text-embedding-004` model produces 768-dimensional embeddings (unlike OpenAI's 1536 dimensions).

## Usage

### Start Server

```bash
npm start
```

Server runs on `http://localhost:3000`

### API Endpoints

#### 1. Suggest Recipes from Ingredients (NEW!)

**POST** `/api/suggest-from-ingredients`

Get AI suggestions for what dishes you can make with the ingredients you have.

Request body:
```json
{
  "ingredients": ["2 cây hành baro", "muối", "đường", "1 vắt mì", "200g tôm", "50g thịt bò xay"],
  "cookingStyle": "dry",
  "servingSize": 2,
  "language": "vi"
}
```

Parameters:
- `ingredients` (required): Array of ingredients you have
- `cookingStyle` (optional): `"dry"` (xào, rim, nướng), `"soup"` (canh, súp), or `"any"` (default: `"any"`)
- `servingSize` (optional): Number of servings (default: 2-4)
- `language` (optional): `"vi"` or `"eng"` (default: `"vi"`)

Response:
```json
{
  "success": true,
  "suggestions": "**Món 1**: Mì Trộn Tôm Thịt Bò\n- **Độ khả thi**: Cao\n- **Nguyên liệu đang thiếu**: Đủ nguyên liệu\n...",
  "meta": {
    "ingredientsUsed": ["2 cây hành baro", "..."],
    "cookingStyle": "dry",
    "servingSize": 2,
    "duration": "6169ms",
    "similarRecipesFound": 5
  }
}
```

**UI**: Visit `/suggest` for the interactive web interface.

---

#### 2. Generate Recipe (with RAG)

**POST** `/generate-recipe`

This endpoint uses **Retrieval Augmented Generation (RAG)**:
1. Searches for 3 similar recipes in the vector store
2. Uses them as context to generate a better, more informed recipe
3. Automatically stores the new recipe for future RAG queries

Request body:
```json
{
  "dishName": "Phở Bò",
  "categories": ["quick", "healthy"],
  "language": "vi"
}
```

Parameters:
- `dishName` (required): Name of the dish
- `categories` (optional): Array of categories (`quick`, `easy`, `healthy`)
- `language` (optional): Response language (`vi` or `eng`, default: `vi`)

**How RAG Works**:
- First request: Generates recipe without context (no similar recipes exist yet)
- Subsequent requests: Retrieves similar recipes and uses them to inform generation
- Improves over time as more recipes are stored

Response:
```json
{
  "success": true,
  "recipe": {
    "dishName": "Phở Bò",
    "description": "...",
    "prepTime": "15 phút",
    "cookTime": "60 phút",
    "servings": "4 người",
    "ingredients": [
      { "name": "Xương bò", "quantity": "1kg" }
    ],
    "step": {
      "1": { "description": "...", "image": null },
      "2": { "description": "...", "image": null }
    }
  }
}
```

#### 2. Search Recipes (Vector Search)

**POST** `/search-recipes`

Request body:
```json
{
  "query": "món ăn nhanh cho người bận rộn",
  "limit": 5
}
```

Parameters:
- `query` (required): Search query (semantic search)
- `limit` (optional): Number of results (default: 5)

Response:
```json
{
  "success": true,
  "query": "món ăn nhanh cho người bận rộn",
  "count": 3,
  "recipes": [
    {
      "dishName": "Phở Bò",
      "description": "...",
      "categories": ["quick", "healthy"],
      "language": "vi",
      "prepTime": "15 phút",
      "cookTime": "60 phút",
      "servings": "4 người",
      "createdAt": "2025-11-01T10:00:00.000Z"
    }
  ]
}
```

## Technology Stack

- **LangChain**: AI orchestration framework
- **Google Gemini 1.5 Flash**: Recipe generation
- **Google text-embedding-004**: Vector embeddings (768 dimensions)
- **MongoDB Atlas Vector Search**: Semantic search
- **Express**: REST API framework
- **TypeScript**: Type safety
- **Zod**: Schema validation

## License

ISC
