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
const StepSchema = z.object({
  description: z.string().describe("Mô tả chi tiết một bước nấu."),
  image: z
    .string()
    .describe("URL của hình ảnh minh hoạ bước nấu.")
    .nullable()
    .optional(),
});

const StepsSchema = z
  .object({})
  .catchall(StepSchema)
  .describe(
    "Các bước ở dạng object, key là số thứ tự ('1','2',...) và value gồm description, image."
  );

const RecipeSchema = z.object({
  dishName: z.string().describe("Tên đầy đủ của món ăn."),
  description: z.string().describe("Mô tả món ăn"),
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
  step: StepsSchema,
});

// --- 2. Khởi tạo LangChain Components ---

// Khởi tạo LLM (Sử dụng model hỗ trợ function calling, như gpt-3.5-turbo)
const llm = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
});

const structuredLLM = llm.withStructuredOutput(RecipeSchema, {
  name: "recipe",
});

// Hỗ trợ các thể loại công thức để mở rộng prompt
const SUPPORTED_CATEGORIES = ["quick", "easy", "healthy"] as const;
type SupportedCategory = (typeof SUPPORTED_CATEGORIES)[number];
const CATEGORY_PROMPT_HINTS: Record<SupportedCategory, string> = {
  quick: "Ưu tiên công thức dưới 20 phút, ít bước, tối giản dụng cụ.",
  easy: "Dành cho người mới bắt đầu, bước rõ ràng, tránh kỹ thuật phức tạp.",
  healthy:
    "Tối ưu dinh dưỡng, ít dầu mỡ, cân bằng đạm-bột-xơ, gợi ý thay thế lành mạnh.",
};

// --- 3. Express Route ---
app.post("/generate-recipe", async (req: Request, res: Response) => {
  const {
    dishName,
    categories,
    category,
    language = "vi",
  } = req.body as {
    dishName?: string;
    categories?: string[];
    category?: string; // backward compatibility
    language?: string; // 'eng' | 'vi'
  };

  if (!dishName) {
    return res
      .status(400)
      .json({ error: "Vui lòng cung cấp 'dishName' trong body request." });
  }

  // Xác thực categories (ưu tiên mảng), vẫn hỗ trợ 'category' cũ
  let categoryInstruction = "";
  const providedCategories: string[] = Array.isArray(categories)
    ? categories
    : category
    ? [category]
    : [];

  if (providedCategories.length > 0) {
    const normalizedList = providedCategories.map((c) =>
      String(c).toLowerCase()
    );
    const unique = Array.from(new Set(normalizedList)) as SupportedCategory[];
    const hints = unique.map((k) => CATEGORY_PROMPT_HINTS[k]).join(" ");
    categoryInstruction = ` Thể loại: ${unique.join(", ")}. ${hints}`;
  }

  // Ngôn ngữ phản hồi (mặc định: vi)
  const SUPPORTED_LANGUAGES = ["eng", "vi"] as const;
  type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
  let lang: SupportedLanguage = "vi";
  if (language) {
    const normalizedLang = String(language).toLowerCase();
    if (!(SUPPORTED_LANGUAGES as readonly string[]).includes(normalizedLang)) {
      return res.status(400).json({
        error: `Language không hợp lệ. Hỗ trợ: ${SUPPORTED_LANGUAGES.join(
          ", "
        )}`,
      });
    }
    lang = normalizedLang as SupportedLanguage;
  }

  const languageInstruction =
    lang === "eng" ? " Respond in English." : " Trả lời bằng tiếng Việt.";

  try {
    console.log(`Đang tạo công thức cho: ${dishName}`);

    const prompt = 
    `Bạn là trợ lý bếp trưởng.
     Nhiệm vụ của bạn là tạo ra công thức chi tiết cho món ăn sau: ${dishName}.${categoryInstruction} 
     Hãy đảm bảo trả lời bằng định dạng JSON đã được chỉ định.${languageInstruction} 
     Với trường step, hãy trả về object có key là số thứ tự bước (ví dụ: '1','2','3'), mỗi bước là object gồm: description (bắt buộc) và image (URL, có thể null/optional).
     Với trường ingredients, hãy trả về array các object, mỗi object gồm: name (bắt buộc) và quantity (bắt buộc).`;
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
      error,
    });
  }
});

app.listen(port, () => {
  console.log(`Server đang chạy tại http://localhost:${port}`);
  console.log(
    "Sử dụng POST request tới /generate-recipe với body: { 'dishName': 'Tên món ăn' }"
  );
});
