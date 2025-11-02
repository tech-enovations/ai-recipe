// src/services/vector-store.service.ts
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Embeddings } from "@langchain/core/embeddings";
import { MongoClient, Collection } from "mongodb";
import { Document } from "@langchain/core/documents";
import { ENV } from "../config/env";
import { log } from "../utils/logger";

export class VectorStoreService {
  private client: MongoClient | null = null;
  private vectorStore: MongoDBAtlasVectorSearch | null = null;
  private embeddings: Embeddings;

  constructor() {
    // Select embedding provider based on LLM_PROVIDER
    this.embeddings = this.createEmbeddings();
    log.info(`Vector store using ${ENV.LLM_PROVIDER} embeddings`);
  }
  
  private createEmbeddings(): Embeddings {
    if (ENV.LLM_PROVIDER === "openai") {
      return new OpenAIEmbeddings({
        apiKey: ENV.OPENAI_API_KEY,
        modelName: ENV.OPENAI_EMBEDDING_MODEL,
        dimensions: ENV.OPENAI_EMBEDDING_DIMENSIONS, // Reduced from 1536 to save quota
      });
    } else {
      return new GoogleGenerativeAIEmbeddings({
        apiKey: ENV.GOOGLE_API_KEY,
        model: ENV.GEMINI_EMBEDDING_MODEL,
      });
    }
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

    try {
      // Optimize recipe text to reduce embedding size and cost
      const ingredientList = recipe.ingredients
        .slice(0, 8) // Limit to top 8 ingredients
        .map((i: any) => i.name) // Just name, skip quantity to save space
        .join(", ");
      
      const shortDescription = recipe.description?.substring(0, 150) || ""; // Limit description
      
      // Increase weight of dishName by repeating it N times (configurable)
      // This makes embeddings prioritize dish name matching
      const dishNameRepeated = Array(ENV.DISHNAME_WEIGHT)
        .fill(recipe.dishName)
        .join(" ");
      
      // Increase weight of categories by repeating them N times (configurable)
      const categoriesRepeated = categories.length > 0 
        ? Array(ENV.CATEGORY_WEIGHT)
            .fill(categories.join(" "))
            .join(" ")
        : "";
      
      const recipeText = `${dishNameRepeated}. ${categoriesRepeated}. ${shortDescription}. ${ingredientList}`;
      
      // Truncate to max length to reduce embedding size
      const truncatedText = recipeText.substring(0, ENV.MAX_RECIPE_TEXT_LENGTH);

      const doc = new Document({
        pageContent: truncatedText,
        metadata: {
          dishName: recipe.dishName,
          description: shortDescription,
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
      log.debug(`Recipe text length: ${truncatedText.length} chars, dishName weight: ${ENV.DISHNAME_WEIGHT}x, category weight: ${ENV.CATEGORY_WEIGHT}x`);
    } catch (error: any) {
      // Handle quota errors gracefully
      if (error?.name === "InsufficientQuotaError" || error?.message?.includes("quota")) {
        log.error("Embedding quota exceeded - recipe not stored in vector DB", {
          dishName: recipe.dishName,
          provider: ENV.LLM_PROVIDER,
          suggestion: "Switch to Gemini provider (free) or upgrade OpenAI plan"
        });
        // Don't throw - allow recipe generation to continue
        return;
      }
      throw error; // Re-throw other errors
    }
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

  /**
   * Re-generate embeddings for existing recipes with updated weights
   * Use this when DISHNAME_WEIGHT or CATEGORY_WEIGHT changes
   */
  async reindexRecipe(dishName: string): Promise<void> {
    if (!this.vectorStore || !this.client) {
      log.warn("Vector store not available for reindexing");
      return;
    }

    try {
      const collection = this.client
        .db(ENV.MONGODB_ATLAS_DB_NAME)
        .collection(ENV.MONGODB_ATLAS_COLLECTION_NAME);

      // Find the recipe by dishName in metadata
      const existingDoc = await collection.findOne({
        "metadata.dishName": dishName,
      });

      if (!existingDoc) {
        log.warn(`Recipe "${dishName}" not found for reindexing`);
        return;
      }

      // Reconstruct the recipe text with current weights
      const metadata = existingDoc.metadata;
      const categories = metadata.categories || [];
      
      // Rebuild with current weight settings
      const dishNameRepeated = Array(ENV.DISHNAME_WEIGHT)
        .fill(metadata.dishName)
        .join(" ");
      
      const categoriesRepeated = categories.length > 0 
        ? Array(ENV.CATEGORY_WEIGHT)
            .fill(categories.join(" "))
            .join(" ")
        : "";
      
      const shortDescription = metadata.description?.substring(0, 150) || "";
      
      // Extract ingredients from pageContent (not stored in metadata)
      const oldText = existingDoc.text || "";
      const ingredientMatch = oldText.split(".")[3] || "";
      
      const recipeText = `${dishNameRepeated}. ${categoriesRepeated}. ${shortDescription}. ${ingredientMatch}`;
      const truncatedText = recipeText.substring(0, ENV.MAX_RECIPE_TEXT_LENGTH);

      // Generate new embedding
      const newEmbedding = await this.embeddings.embedQuery(truncatedText);

      // Update the document with new embedding and text
      await collection.updateOne(
        { _id: existingDoc._id },
        {
          $set: {
            text: truncatedText,
            embedding: newEmbedding,
            updatedAt: new Date().toISOString(),
          },
        }
      );

      log.info(`Reindexed recipe: "${dishName}" with weights (dish: ${ENV.DISHNAME_WEIGHT}x, category: ${ENV.CATEGORY_WEIGHT}x)`);
    } catch (error) {
      log.error(`Failed to reindex recipe "${dishName}"`, error);
      throw error;
    }
  }

  /**
   * Re-generate ALL embeddings with updated weights
   * WARNING: This is expensive! Use only when weights change significantly
   */
  async reindexAll(): Promise<{ total: number; success: number; failed: number }> {
    if (!this.vectorStore || !this.client) {
      throw new Error("Vector store not available");
    }

    const collection = this.client
      .db(ENV.MONGODB_ATLAS_DB_NAME)
      .collection(ENV.MONGODB_ATLAS_COLLECTION_NAME);

    const allRecipes = await collection.find({}).toArray();
    
    log.info(`Starting reindex of ${allRecipes.length} recipes with weights (dish: ${ENV.DISHNAME_WEIGHT}x, category: ${ENV.CATEGORY_WEIGHT}x)`);

    let success = 0;
    let failed = 0;

    for (const doc of allRecipes) {
      try {
        const dishName = doc?.dishName;
        if (!dishName) {
          log.warn("Skipping recipe without dishName");
          failed++;
          continue;
        }

        await this.reindexRecipe(dishName);
        success++;
        
        // Log progress every 10 recipes
        if ((success + failed) % 10 === 0) {
          log.info(`Reindex progress: ${success + failed}/${allRecipes.length}`);
        }
      } catch (error) {
        log.error(`Failed to reindex recipe`, error);
        failed++;
      }
    }

    log.info(`Reindex complete: ${success} success, ${failed} failed out of ${allRecipes.length} total`);
    
    return { total: allRecipes.length, success, failed };
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

