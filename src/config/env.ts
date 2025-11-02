// src/config/env.ts
import * as dotenv from "dotenv";

dotenv.config();

export const ENV = {
  // Server
  PORT: parseInt(process.env.PORT || "3000", 10),
  NODE_ENV: process.env.NODE_ENV || "development",
  API_URL: process.env.API_URL || "http://localhost:3000",
  
  // LLM Provider Selection
  LLM_PROVIDER: (process.env.LLM_PROVIDER || "gemini") as "gemini" | "openai",
  
  // Google AI
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || "",
  
  // OpenAI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  OPENAI_EMBEDDING_DIMENSIONS: parseInt(process.env.OPENAI_EMBEDDING_DIMENSIONS || "512", 10), // Reduced from 1536 to save quota
  
  // MongoDB Atlas
  MONGODB_ATLAS_URI: process.env.MONGODB_ATLAS_URI || "",
  MONGODB_ATLAS_DB_NAME: process.env.MONGODB_ATLAS_DB_NAME || "ai_recipe_db",
  MONGODB_ATLAS_COLLECTION_NAME: process.env.MONGODB_ATLAS_COLLECTION_NAME || "recipes",
  MONGODB_ATLAS_INDEX_NAME: process.env.MONGODB_ATLAS_INDEX_NAME || "vector_index",
  
  // Chat
  CHAT_HISTORY_COLLECTION: "chat_history",
  SESSION_INACTIVITY_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  
  // AI Model Settings (Gemini)
  GEMINI_RECIPE_MODEL: process.env.GEMINI_RECIPE_MODEL || "gemini-flash-latest",
  GEMINI_CHAT_MODEL: process.env.GEMINI_CHAT_MODEL || "gemini-flash-latest",
  GEMINI_EMBEDDING_MODEL: process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004",
  
  // AI Model Settings (OpenAI)
  OPENAI_RECIPE_MODEL: process.env.OPENAI_RECIPE_MODEL || "gpt-4o-mini",
  OPENAI_CHAT_MODEL: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
  OPENAI_EMBEDDING_MODEL: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
  
  // Backward compatibility
  RECIPE_MODEL: process.env.RECIPE_MODEL || "gemini-flash-latest",
  CHAT_MODEL: process.env.CHAT_MODEL || "gemini-flash-latest",
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || "text-embedding-004",
  
  // Generation Settings
  MAX_OUTPUT_TOKENS: 2048,
  TEMPERATURE: 0.3,
  CHAT_TEMPERATURE: 0.7,
  REQUEST_TIMEOUT: 30000, // 30 seconds
  
  // RAG Settings
  RAG_TOP_K: 5,
  RAG_SIMILARITY_THRESHOLD: 0.15, // Lowered from 0.4 - cosine similarity with embeddings is typically < 0.3
  RAG_CONTEXT_LIMIT: 3,
  
  // Document size optimization
  MAX_RECIPE_TEXT_LENGTH: 500, // Limit recipe text for embeddings to reduce size
  
  // Embedding weight optimization
  DISHNAME_WEIGHT: parseInt(process.env.DISHNAME_WEIGHT || "3", 10), // Repeat dishName N times for higher priority
  CATEGORY_WEIGHT: parseInt(process.env.CATEGORY_WEIGHT || "2", 10), // Repeat categories N times
} as const;

export function validateEnv(): void {
  // Check LLM provider keys
  if (ENV.LLM_PROVIDER === "gemini" && !ENV.GOOGLE_API_KEY) {
    console.warn("⚠️  LLM_PROVIDER=gemini but GOOGLE_API_KEY not set - AI features will not work");
  }
  
  if (ENV.LLM_PROVIDER === "openai" && !ENV.OPENAI_API_KEY) {
    console.warn("⚠️  LLM_PROVIDER=openai but OPENAI_API_KEY not set - AI features will not work");
  }
  
  if (!ENV.MONGODB_ATLAS_URI) {
    console.warn("⚠️  MONGODB_ATLAS_URI not set - Vector search and chat persistence disabled");
  }
  
  console.log(`✅ LLM Provider: ${ENV.LLM_PROVIDER.toUpperCase()}`);
}

