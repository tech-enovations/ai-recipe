// src/handlers/stream.handler.ts
import { Request, Response } from "express";
import { llmService } from "../services/llm.service";
import { ragService } from "../services/rag.service";
import { vectorStoreService } from "../services/vector-store.service";
import { log } from "../utils/logger";

export async function generateRecipeStreamHandler(req: Request, res: Response) {
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

    const { context: ragContext, recipesFound } = await ragService.retrieveContext(
      dishName,
      providedCategories
    );

    if (recipesFound > 0) {
      sendEvent("rag", {
        found: recipesFound,
        message: `Tìm thấy ${recipesFound} công thức tương tự`,
      });
    } else {
      sendEvent("rag", {
        found: 0,
        message: "Không tìm thấy công thức tương tự, sẽ tạo mới từ đầu",
      });
    }

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

    const prompt = `Tạo công thức chi tiết cho: ${dishName}.${categoryInstruction}${languageInstruction}
     Trả về JSON với:
     - dishName, description, prepTime, cookTime, servings
     - ingredients: [{name, quantity}]
     - steps: [{stepNumber: 1, description: "..."}, {stepNumber: 2, description: "..."}, ...]
     Tối thiểu 3 bước, tối đa 6 bước.
     ${ragContext}`;

    const { result, duration } = await llmService.generateRecipe(prompt);

    // Add metadata
    const enrichedResult = {
      ...result,
      generatedAt: new Date().toISOString(),
      generationTime: `${duration}ms`,
    };

    // Phase 4: Store in database
    sendEvent("phase", {
      phase: 4,
      name: "Xử lý kết quả",
      message: "Đang lưu trữ công thức...",
      progress: 80,
    });

    if (vectorStoreService.isAvailable()) {
      try {
        await vectorStoreService.addRecipe(result, providedCategories, language);
        sendEvent("stored", { message: "Đã lưu công thức vào cơ sở dữ liệu" });
      } catch (storeError) {
        log.error("Failed to store recipe in stream", storeError);
        sendEvent("warning", {
          message: "Lưu công thức thất bại, nhưng vẫn trả về kết quả",
        });
      }
    }

    // Phase 5: Complete
    sendEvent("phase", {
      phase: 5,
      name: "Hoàn thành",
      message: "Công thức đã sẵn sàng!",
      progress: 100,
    });

    sendEvent("complete", {
      recipe: enrichedResult,
      duration: `${duration}ms`,
      message: "Tạo công thức thành công!",
    });

    res.end();
  } catch (error: any) {
    log.error("Error in stream handler", error);
    sendEvent("error", {
      message: "Lỗi khi tạo công thức",
      error: error.message,
    });
    res.end();
  }
}

