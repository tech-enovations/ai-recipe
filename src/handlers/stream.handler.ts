// src/handlers/stream.handler.ts
import { Request, Response } from "express";
import { llmService } from "../services/llm.service";
import { ragService } from "../services/rag.service";
import { vectorStoreService } from "../services/vector-store.service";
import { log } from "../utils/logger";

export async function generateRecipeStreamHandler(req: Request, res: Response) {
  const { dishName, categories, category, language = "vi", servingSize } = req.body as {
    dishName?: string;
    categories?: string[];
    category?: string;
    language?: string;
    servingSize?: number;
  };

  if (!dishName) {
    return res
      .status(400)
      .json({ error: "Vui lòng cung cấp 'dishName' trong body request." });
  }

  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable buffering for nginx
  res.flushHeaders();

  const sendEvent = (phase: string, data: any) => {
    res.write(`event: ${phase}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    sendEvent("start", { message: "Bắt đầu tạo công thức...", dishName });

    // Phase 1: Validate and prepare
    const providedCategories: string[] = Array.isArray(categories)
      ? categories
      : category
      ? [category]
      : [];

    sendEvent("phase", {
      phase: 1,
      name: "Chuẩn bị",
      message: "Xác thực thông tin đầu vào",
      progress: 10,
    });

    // Phase 2: RAG Retrieval
    sendEvent("phase", {
      phase: 2,
      name: "Tìm kiếm",
      message: "Đang tìm công thức tương tự...",
      progress: 30,
    });

    const { context: ragContext, recipesFound, topResults = [] } = await ragService.retrieveContext(
      dishName,
      providedCategories
    );

    // Update phase 2 with result
    sendEvent("phase", {
      phase: 2,
      name: "Tìm kiếm",
      message: recipesFound > 0 
        ? `✓ Tìm thấy ${recipesFound} công thức tương tự ${topResults.map((doc) => doc.metadata?.dishName).join(", ")}` 
        : "✓ Không tìm thấy công thức tương tự, sẽ tạo mới",
      progress: 35,
      complete: true,
    });

    // Phase 3: Generate with AI
    sendEvent("phase", {
      phase: 3,
      name: "Tạo công thức",
      message: "Đang sử dụng AI để tạo công thức...",
      progress: 50,
    });

    const categoryInstruction =
      providedCategories.length > 0 ? ` Categories: ${providedCategories.join(", ")}.` : "";
    const languageInstruction = language === "eng" ? " English." : " Tiếng Việt.";
    const servingInstruction = servingSize 
      ? ` Tính cho ${servingSize} người ăn.` 
      : " Tính cho 2-4 người ăn (mặc định).";

    const prompt = `Tạo công thức chi tiết cho: ${dishName}.${categoryInstruction}${servingInstruction}${languageInstruction}
     Trả về JSON với:
     - dishName, description, prepTime, cookTime, servings (số người theo yêu cầu)
     - ingredients: [{name, quantity (điều chỉnh theo số người), whereToFind (nơi mua ở Việt Nam)}]
     - steps: [{stepNumber, description, videoUrl (YouTube/TikTok nếu có)}]
     - shoppingTips: Gợi ý mua nguyên liệu ở VN (chợ nào, siêu thị, thời gian)
     Tối thiểu 3 bước, tối đa 6 bước.
     ${ragContext}`;

    const { result, duration } = await llmService.generateRecipe(prompt);

    // Update phase 3 complete
    sendEvent("phase", {
      phase: 3,
      name: "Tạo công thức",
      message: `✓ Đã tạo xong công thức (${duration}ms)`,
      progress: 70,
      complete: true,
    });

    // Add metadata
    const enrichedResult = {
      ...result,
      generatedAt: new Date().toISOString(),
      generationTime: `${duration}ms`,
    };

    // Phase 4: Finalize
    sendEvent("phase", {
      phase: 4,
      name: "Hoàn thiện",
      message: "Đang chuẩn bị công thức...",
      progress: 80,
    });

    if (vectorStoreService.isAvailable()) {
      try {
        await vectorStoreService.addRecipe(result, providedCategories, language);
      } catch (storeError) {
        log.error("Failed to store recipe in stream", storeError);
      }
    }

    // Update phase 4 complete
    sendEvent("phase", {
      phase: 4,
      name: "Hoàn thiện",
      message: "✓ Công thức đã sẵn sàng!",
      progress: 90,
      complete: true,
    });

    // Phase 5: Complete
    sendEvent("phase", {
      phase: 5,
      name: "Hoàn thành",
      message: "✓ Tạo công thức thành công!",
      progress: 100,
      complete: true,
    });

    sendEvent("complete", {
      recipe: enrichedResult,
      duration: `${duration}ms`,
      message: "Tạo công thức thành công!",
    });

    res.end();
  } catch (error: any) {
    console.log('error',error);
    
    log.error("Error in stream handler", error);
    sendEvent("error", {
      message: "Lỗi khi tạo công thức",
      error: error.message,
      
    });
    res.end();
  }
}

