// src/services/rag.service.ts
import { Document } from "@langchain/core/documents";
import { vectorStoreService } from "./vector-store.service";
import { CATEGORY_PROMPT_HINTS, SupportedCategory } from "../config/constants";
import { ENV } from "../config/env";

export class RAGService {
  async retrieveContext(
    dishName: string,
    categories: string[]
  ): Promise<{ context: string; recipesFound: number }> {
    if (!vectorStoreService.isAvailable()) {
      console.log("⚠️  Vector store not available - skipping RAG");
      return { context: "", recipesFound: 0 };
    }

    try {
      // Enhanced query with category context
      const categoryContext =
        categories.length > 0
          ? categories
              .map((c) => CATEGORY_PROMPT_HINTS[c as SupportedCategory])
              .join(" ")
          : "";
      const enhancedQuery = `${dishName} món ăn công thức ${categoryContext}`.trim();

      console.log(`🔍 Enhanced RAG search: "${enhancedQuery}"`);

      // Retrieve with scores
      const resultsWithScore = await vectorStoreService.searchSimilarRecipes(
        enhancedQuery,
        ENV.RAG_TOP_K,
        ENV.RAG_SIMILARITY_THRESHOLD
      );

      console.log(`📊 Retrieved ${resultsWithScore.length} candidates`);

      // Log similarity scores
      resultsWithScore.forEach(([doc, score]) => {
        const similarity = (1 - score).toFixed(3);
        console.log(
          `   - ${doc.metadata?.dishName || "Unknown"}: similarity ${similarity}`
        );
      });

      // Take top results
      const topResults = resultsWithScore.slice(0, ENV.RAG_CONTEXT_LIMIT);

      if (topResults.length === 0) {
        console.log("⚠️  No recipes above threshold - generating from scratch");
        return { context: "", recipesFound: 0 };
      }

      // Build rich context
      const contextString = topResults
        .map(([doc, score], idx) => {
          const similarity = (1 - score).toFixed(2);
          return `Công thức tham khảo ${idx + 1} (độ tương đồng: ${similarity}):
${doc.metadata?.dishName} - ${doc.metadata?.description || "N/A"}
Nguyên liệu chính: ${doc.pageContent.split(".")[2] || "N/A"}
Thời gian: Chuẩn bị ${doc.metadata?.prepTime}, Nấu ${doc.metadata?.cookTime}, Phục vụ ${doc.metadata?.servings}`;
        })
        .join("\n\n");

      const formattedContext = `\n\n=== THAM KHẢO CÁC CÔNG THỨC TƯƠNG TỰ ===\n${contextString}\n\n=== YÊU CẦU ===\nDựa vào các công thức trên, tạo công thức MỚI và SÁNG TẠO với phong cách riêng. Đảm bảo có ít nhất 3 bước chi tiết.`;

      console.log(`✅ Using ${topResults.length} high-quality similar recipes`);

      return {
        context: formattedContext,
        recipesFound: topResults.length,
      };
    } catch (error: any) {
      console.error("⚠️  RAG retrieval failed:", error.message);
      return { context: "", recipesFound: 0 };
    }
  }
}

// Singleton instance
export const ragService = new RAGService();
