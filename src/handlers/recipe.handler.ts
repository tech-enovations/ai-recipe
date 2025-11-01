// src/handlers/recipe.handler.ts
import { Request, Response } from "express";
import { llmService } from "../services/llm.service";
import { ragService } from "../services/rag.service";
import { vectorStoreService } from "../services/vector-store.service";
import { SUPPORTED_CATEGORIES, SUPPORTED_LANGUAGES, SupportedLanguage } from "../config/constants";

export async function generateRecipeHandler(req: Request, res: Response) {
  const { dishName, categories, category, language = "vi" } = req.body as {
    dishName?: string;
    categories?: string[];
    category?: string;
    language?: string;
  };

  if (!dishName) {
    return res
      .status(400)
      .json({ error: "Vui lòng cung cấp 'dishName' trong body request." });
  }

  try {
    // Prepare categories
    const providedCategories: string[] = Array.isArray(categories)
      ? categories
      : category
      ? [category]
      : [];

    // Validate categories
    if (providedCategories.length > 0) {
      const normalizedList = providedCategories.map((c) => String(c).toLowerCase());
      const unique = Array.from(new Set(normalizedList));
      // Note: Add validation if needed
    }

    // Validate language
    let lang: SupportedLanguage = "vi";
    if (language) {
      const normalizedLang = String(language).toLowerCase();
      if (!(SUPPORTED_LANGUAGES as readonly string[]).includes(normalizedLang)) {
        return res.status(400).json({
          error: `Language không hợp lệ. Hỗ trợ: ${SUPPORTED_LANGUAGES.join(", ")}`,
        });
      }
      lang = normalizedLang as SupportedLanguage;
    }

    console.log(`Đang tạo công thức cho: ${dishName}`);

    // RAG retrieval
    const { context: ragContext, recipesFound } = await ragService.retrieveContext(
      dishName,
      providedCategories
    );

    // Build prompt
    const categoryInstruction = providedCategories.length > 0 
      ? ` Categories: ${providedCategories.join(", ")}.` 
      : "";
    const languageInstruction = lang === "eng" ? " English." : " Tiếng Việt.";

    const prompt = `Tạo công thức chi tiết cho: ${dishName}.${categoryInstruction}${languageInstruction}
     Trả về JSON với:
     - dishName, description, prepTime, cookTime, servings
     - ingredients: [{name, quantity}]
     - steps: [{stepNumber: 1, description: "..."}, {stepNumber: 2, description: "..."}, ...]
     Tối thiểu 3 bước, tối đa 6 bước.
     ${ragContext}`;

    // Generate recipe
    const { result, duration } = await llmService.generateRecipe(prompt);

    // Store in vector database
    if (vectorStoreService.isAvailable()) {
      try {
        await vectorStoreService.addRecipe(result, providedCategories, lang);
      } catch (storeError) {
        console.error("⚠️  Failed to store recipe:", storeError);
      }
    }

    res.json({
      success: true,
      recipe: result,
      meta: {
        duration: `${duration}ms`,
        ragUsed: recipesFound > 0,
        ragRecipes: recipesFound,
      },
    });
  } catch (error: any) {
    console.error("Lỗi khi tạo công thức:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

export async function searchRecipesHandler(req: Request, res: Response) {
  const { query, limit = 5 } = req.body as {
    query?: string;
    limit?: number;
  };

  if (!query) {
    return res
      .status(400)
      .json({ error: "Vui lòng cung cấp 'query' trong body request." });
  }

  if (!vectorStoreService.isAvailable()) {
    return res.status(503).json({
      error: "Vector store không khả dụng. Vui lòng cấu hình MONGODB_ATLAS_URI.",
    });
  }

  try {
    const results = await vectorStoreService.searchRecipes(query, limit);

    const recipes = results.map((doc) => ({
      dishName: doc.metadata.dishName,
      description: doc.metadata.description,
      categories: doc.metadata.categories,
      language: doc.metadata.language,
      prepTime: doc.metadata.prepTime,
      cookTime: doc.metadata.cookTime,
      servings: doc.metadata.servings,
      createdAt: doc.metadata.createdAt,
    }));

    res.json({
      success: true,
      query,
      count: recipes.length,
      recipes,
    });
  } catch (error: any) {
    console.error("Lỗi khi tìm kiếm công thức:", error);
    res.status(500).json({
      success: false,
      error: "Không thể tìm kiếm công thức.",
    });
  }
}

export async function vectorStoreStatusHandler(req: Request, res: Response) {
  const mongoClient = vectorStoreService.getClient();
  
  if (!vectorStoreService.isAvailable() || !mongoClient) {
    return res.json({
      initialized: false,
      message: "Vector store not configured. Set MONGODB_ATLAS_URI in .env",
    });
  }

  try {
    const collection = vectorStoreService.getCollection(
      process.env.MONGODB_ATLAS_COLLECTION_NAME || "recipes"
    );

    if (!collection) {
      return res.status(500).json({ error: "Collection not found" });
    }

    const count = await collection.countDocuments();
    const sampleDocs = await collection.find().limit(5).toArray();

    // Test vector search
    let vectorSearchWorks = false;
    let vectorSearchError = null;
    try {
      await vectorStoreService.searchRecipes("test", 1);
      vectorSearchWorks = true;
    } catch (vsError: any) {
      vectorSearchError = vsError.message;
    }

    res.json({
      initialized: true,
      recipeCount: count,
      vectorSearchWorks,
      vectorSearchError,
      indexName: process.env.MONGODB_ATLAS_INDEX_NAME || "vector_index",
      sampleRecipes: sampleDocs.map((doc: any) => ({
        dishName: doc.metadata?.dishName || doc.dishName,
        categories: doc.metadata?.categories || doc.categories,
        createdAt: doc.metadata?.createdAt || doc.createdAt,
        text: doc.text?.substring(0, 50) + "..." || "N/A",
        hasEmbedding: !!doc.embedding,
        embeddingDimension: doc.embedding?.length,
        rawKeys: Object.keys(doc),
      })),
    });
  } catch (error: any) {
    console.error("Error checking vector store status:", error);
    res.status(500).json({
      initialized: true,
      error: error.message,
    });
  }
}

