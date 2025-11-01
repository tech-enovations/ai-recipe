// src/services/vector-store.service.ts
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { MongoClient, Collection } from "mongodb";
import { Document } from "@langchain/core/documents";
import { ENV } from "../config/env";
import { log } from "../utils/logger";

export class VectorStoreService {
  private client: MongoClient | null = null;
  private vectorStore: MongoDBAtlasVectorSearch | null = null;
  private embeddings: GoogleGenerativeAIEmbeddings;

  constructor() {
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: ENV.GOOGLE_API_KEY,
      model: ENV.EMBEDDING_MODEL,
    });
  }

  async initialize(): Promise<void> {
    if (!ENV.MONGODB_ATLAS_URI) {
      log.db.vectorStoreDisabled();
      return;
    }

    try {
      this.client = new MongoClient(ENV.MONGODB_ATLAS_URI);
      await this.client.connect();
      log.db.connected();

      const collection = this.client
        .db(ENV.MONGODB_ATLAS_DB_NAME)
        .collection(ENV.MONGODB_ATLAS_COLLECTION_NAME);

      this.vectorStore = new MongoDBAtlasVectorSearch(this.embeddings, {
        collection,
        indexName: ENV.MONGODB_ATLAS_INDEX_NAME,
        textKey: "text",
        embeddingKey: "embedding",
      });

      log.db.vectorStoreInit();
    } catch (error) {
      log.error("Failed to initialize vector store", error);
      this.vectorStore = null;
    }
  }

  async addRecipe(recipe: any, categories: string[], language: string): Promise<void> {
    if (!this.vectorStore) {
      log.warn("Vector store not available");
      return;
    }

    const recipeText = `${recipe.dishName}. ${recipe.description}. Ingredients: ${recipe.ingredients
      .map((i: any) => `${i.name} ${i.quantity}`)
      .join(", ")}. Categories: ${categories.join(", ")}`;

    const doc = new Document({
      pageContent: recipeText,
      metadata: {
        dishName: recipe.dishName,
        description: recipe.description,
        categories,
        language,
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        servings: recipe.servings,
        createdAt: new Date().toISOString(),
      },
    });

    await this.vectorStore.addDocuments([doc]);
    log.recipe.stored(recipe.dishName);
  }

  async searchSimilarRecipes(
    query: string,
    limit: number = ENV.RAG_TOP_K,
    threshold: number = ENV.RAG_SIMILARITY_THRESHOLD
  ): Promise<Array<[Document, number]>> {
    if (!this.vectorStore) {
      return [];
    }

    const results = await this.vectorStore.similaritySearchWithScore(query, limit);
    
    // Filter by threshold
    return results.filter(([_, score]) => {
      const similarity = 1 - score;
      return similarity >= threshold;
    });
  }

  async searchRecipes(query: string, limit: number = 5): Promise<Document[]> {
    if (!this.vectorStore) {
      throw new Error("Vector store not available");
    }

    return await this.vectorStore.similaritySearch(query, limit);
  }

  getClient(): MongoClient | null {
    return this.client;
  }

  getCollection(collectionName: string): Collection | null {
    if (!this.client) return null;
    return this.client
      .db(ENV.MONGODB_ATLAS_DB_NAME)
      .collection(collectionName);
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      log.db.disconnected();
    }
  }

  isAvailable(): boolean {
    return this.vectorStore !== null;
  }
}

// Singleton instance
export const vectorStoreService = new VectorStoreService();

