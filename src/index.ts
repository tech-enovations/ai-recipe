// src/index.ts

import * as dotenv from "dotenv";
import express, { Request, Response } from "express";
import { ChatOpenAI } from "@langchain/openai";
// Removed PromptTemplate usage to avoid subpath import issues in v1
import { z } from "zod"; // Sử dụng Zod để định nghĩa schema dễ dàng hơn

dotenv.config();

const app = express();
const port = 3000;

app.use(express.json());

// --- 1. Định nghĩa Cấu trúc Đầu ra (Schema) bằng Zod ---
const RecipeSchema = z.object({
  dishName: z.string().describe("Tên đầy đủ của món ăn."),
  prepTime: z.string().describe("Thời gian chuẩn bị (ví dụ: 15 phút)."),
  cookTime: z.string().describe("Thời gian nấu (ví dụ: 30 phút)."),
  servings: z.string().describe("Số suất ăn (ví dụ: 4 người)."),
  ingredients: z
    .array(
      z.object({
        name: z.string().describe("Tên nguyên liệu."),
        quantity: z.string().describe("Số lượng và đơn vị (ví dụ: 2 củ)."),
      })
    )
    .describe("Danh sách các nguyên liệu cần thiết."),
  steps: z
    .array(z.string().describe("Mô tả chi tiết một bước nấu."))
    .describe("Các bước thực hiện để hoàn thành món ăn."),
});

// --- 2. Khởi tạo LangChain Components ---

// Khởi tạo LLM (Sử dụng model hỗ trợ function calling, như gpt-3.5-turbo)
const llm = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
});

const structuredLLM = llm.withStructuredOutput(RecipeSchema, { name: "recipe" });

// --- 3. Express Route ---
app.post("/generate-recipe", async (req: Request, res: Response) => {
  const { dishName } = req.body;

  if (!dishName) {
    return res
      .status(400)
      .json({ error: "Vui lòng cung cấp 'dishName' trong body request." });
  }

  try {
    console.log(`Đang tạo công thức cho: ${dishName}`);

    const prompt = `Bạn là trợ lý bếp trưởng. Nhiệm vụ của bạn là tạo ra công thức chi tiết cho món ăn sau: ${dishName}. Hãy đảm bảo trả lời bằng định dạng JSON đã được chỉ định.`;
    const result = await structuredLLM.invoke(prompt);

    // Trả về JSON có cấu trúc cho frontend
    res.json({
      success: true,
      recipe: result,
    });
  } catch (error) {
    console.error("Lỗi khi tạo công thức:", error);
    res.status(500).json({
      success: false,
      // error: "Không thể tạo công thức. Vui lòng thử lại sau." ,
      error
    });
  }
});

app.listen(port, () => {
  console.log(`Server đang chạy tại http://localhost:${port}`);
  console.log(
    "Sử dụng POST request tới /generate-recipe với body: { 'dishName': 'Tên món ăn' }"
  );
});
