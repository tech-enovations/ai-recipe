// src/services/rag.service.ts
import { Document } from "@langchain/core/documents";
import { CATEGORY_PROMPT_HINTS, SupportedCategory } from "../config/constants";
import { ENV } from "../config/env";
import { log } from "../utils/logger";
import { vectorStoreService } from "./vector-store.service";

export class RAGService {
  async retrieveContext(
    dishName: string,
    categories: string[]
  ): Promise<{
    context: string;
    recipesFound: number;
    queriesUsed: string[];
    topResults?: Document[];
  }> {
    if (!vectorStoreService.isAvailable()) {
      log.warn("Vector store not available - skipping RAG");
      return { context: "", recipesFound: 0, queriesUsed: [] };
    }

    try {
      log.rag.searching(dishName);

      // Use vector search directly - already returns sorted results (best first)
      const resultsWithScore = await vectorStoreService.searchSimilarRecipes(
        dishName,
        ENV.RAG_TOP_K * 3, // Fetch more for deduplication and boosting
        ENV.RAG_SIMILARITY_THRESHOLD
      );

      if (resultsWithScore.length === 0) {
        log.warn("No recipes found above threshold - generating from scratch");
        return { context: "", recipesFound: 0, queriesUsed: [dishName] };
      }

      log.rag.found(resultsWithScore.length, ENV.RAG_SIMILARITY_THRESHOLD);

      // Deduplicate by dishName (keep best score for each)
      const deduped = new Map<string, [Document, number]>();
      resultsWithScore.forEach(([doc, score]) => {
        const dishKey = doc.metadata?.dishName || "unknown";
        const existing = deduped.get(dishKey);
        if (!existing || score < existing[1]) {
          deduped.set(dishKey, [doc, score]);
        }
      });

      const dedupedResults = Array.from(deduped.values());
      log.debug(`Deduplication: ${resultsWithScore.length} → ${dedupedResults.length} unique recipes`);

      // Take top results (already sorted by vector similarity)
      const topResults = dedupedResults.slice(0, ENV.RAG_CONTEXT_LIMIT);
      
      // Log top picks
      log.info(`Top ${topResults.length} RAG results (pure vector search):`);
      topResults.forEach(([doc, score], idx) => {
        const similarity = 1 - score;
        log.info(`  ${idx + 1}. "${doc.metadata?.dishName}" - similarity: ${similarity.toFixed(4)}`);
      });

      // Build rich context
      const contextString = topResults
        .map(([doc, score], idx) => {
          const similarity = (1 - score).toFixed(2);
          return `Công thức tham khảo ${idx + 1} (độ tương đồng: ${similarity}):
${doc.metadata?.dishName} - ${doc.metadata?.description || "N/A"}
Nguyên liệu chính: ${doc.pageContent.split(".")[2] || "N/A"}
Thời gian: Chuẩn bị ${doc.metadata?.prepTime}, Nấu ${
            doc.metadata?.cookTime
          }, Phục vụ ${doc.metadata?.servings}`;
        })
        .join("\n\n");

      const formattedContext = `\n\n=== THAM KHẢO CÁC CÔNG THỨC TƯƠNG TỰ ===\n${contextString}\n\n=== YÊU CẦU ===\nDựa vào các công thức trên, tạo công thức MỚI và SÁNG TẠO với phong cách riêng. Đảm bảo có ít nhất 3 bước chi tiết.`;

      log.info(
        `Using ${topResults.length} high-quality similar recipes from ${dedupedResults.length} total matches`
      );

      return {
        context: formattedContext,
        recipesFound: topResults.length,
        queriesUsed: [dishName],
        topResults: topResults.map(([doc]) => doc),
      };
    } catch (error: any) {
      // Handle quota errors specifically
      if (
        error?.name === "InsufficientQuotaError" ||
        error?.message?.includes("quota")
      ) {
        log.error("Embedding quota exceeded during RAG search", {
          provider: ENV.LLM_PROVIDER,
          suggestion:
            "Switch to Gemini provider (LLM_PROVIDER=gemini) - it's free!",
        });
      } else {
        log.error("RAG retrieval failed", error);
      }
      return { context: "", recipesFound: 0, queriesUsed: [] };
    }
  }
}

// Singleton instance
export const ragService = new RAGService();
