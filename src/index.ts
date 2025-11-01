// src/index.ts

import * as dotenv from "dotenv";
import express, { Request, Response } from "express";
import cors from "cors";
import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} from "@langchain/google-genai";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { MongoClient } from "mongodb";
import { Document } from "@langchain/core/documents";
import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables";
import { BufferMemory } from "langchain/memory";
import { MongoDBChatMessageHistory } from "@langchain/mongodb";
import { ConversationChain } from "langchain/chains";
import { 
  ChatPromptTemplate, 
  MessagesPlaceholder,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate 
} from "@langchain/core/prompts";
import { z } from "zod";

dotenv.config();

const app = express();
const port = 3000;

// CORS configuration
app.use(
  cors({
    origin: true, // Allow all origins, or specify: ['https://973b8f3a343a.ngrok-free.app']
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(express.static("public")); // Serve static files from 'public' directory

// --- 1. Định nghĩa Cấu trúc Đầu ra (Schema) bằng Zod ---
const StepSchema = z.object({
  description: z.string().describe("Mô tả chi tiết một bước nấu."),
  image: z
    .string()
    .describe("URL của hình ảnh minh hoạ bước nấu.")
    .nullable()
    .optional(),
});

// Simplified steps schema for Gemini - use array, it's more reliable
const StepsArraySchema = z
  .array(
    z.object({
      stepNumber: z.number().describe("Số thứ tự bước"),
      description: z.string().describe("Mô tả chi tiết bước nấu"),
    })
  )
  .describe("Danh sách các bước thực hiện (3-6 bước)");

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
  steps: StepsArraySchema,
});

// --- 2. Khởi tạo LangChain Components ---

// Khởi tạo LLM (Sử dụng Google Gemini)
const llm = new ChatGoogleGenerativeAI({
  model: "gemini-flash-latest", // Faster, smaller model
  temperature: 0.3, // Slight randomness for faster generation
  apiKey: process.env.GOOGLE_API_KEY,
  maxOutputTokens: 2048, // Limit output length
  topP: 0.95,
  topK: 40,
});

const structuredLLM = llm.withStructuredOutput(RecipeSchema, {
  name: "recipe",
});

// --- RunnableLambda Pipeline for Recipe Generation ---
interface RecipeInput {
  dishName: string;
  categories: string[];
  language: string;
  contextFromSimilarRecipes?: string;
}

// Step 1: Build optimized prompt
const buildPromptLambda = new RunnableLambda({
  func: (input: RecipeInput) => {
    const categoryHints = input.categories
      .map((cat) => CATEGORY_PROMPT_HINTS[cat as SupportedCategory])
      .filter(Boolean)
      .join(" ");

    const categoryInstruction = categoryHints ? ` ${categoryHints}` : "";
    const languageInstruction =
      input.language === "eng" ? " English." : " Tiếng Việt.";
    const context = input.contextFromSimilarRecipes || "";

    return `Tạo công thức chi tiết cho: ${input.dishName}.${categoryInstruction}${languageInstruction}
     Trả về JSON với:
     - dishName, description, prepTime, cookTime, servings
     - ingredients: [{name, quantity}]
     - steps: [{stepNumber: 1, description: "..."}, {stepNumber: 2, description: "..."}, ...]
     Tối thiểu 3 bước, tối đa 6 bước.
     ${context}`;
  },
});

// Step 2: Generate recipe with LLM
const generateRecipeLambda = new RunnableLambda({
  func: async (prompt: string) => {
    const startTime = Date.now();
    const result = await structuredLLM.invoke(prompt);
    const duration = Date.now() - startTime;
    console.log(`⏱️  Recipe generated in ${duration}ms`);
    return { recipe: result, duration };
  },
});

// Step 3: Post-process and enrich
const postProcessLambda = new RunnableLambda({
  func: async (data: { recipe: any; duration: number }) => {
    // Add metadata
    const enriched = {
      ...data.recipe,
      generatedAt: new Date().toISOString(),
      generationTime: `${data.duration}ms`,
    };
    return enriched;
  },
});

// Create the pipeline chain
const recipeGenerationChain = RunnableSequence.from([
  buildPromptLambda,
  generateRecipeLambda,
  postProcessLambda,
]);

// --- MongoDB Vector Store Setup ---
let vectorStore: MongoDBAtlasVectorSearch | null = null;
let mongoClient: MongoClient | null = null;

async function initializeVectorStore() {
  try {
    const MONGODB_ATLAS_URI = process.env.MONGODB_ATLAS_URI;
    const MONGODB_ATLAS_DB_NAME =
      process.env.MONGODB_ATLAS_DB_NAME || "ai_recipe_db";
    const MONGODB_ATLAS_COLLECTION_NAME =
      process.env.MONGODB_ATLAS_COLLECTION_NAME || "recipes";
    const MONGODB_ATLAS_INDEX_NAME =
      process.env.MONGODB_ATLAS_INDEX_NAME || "vector_index";

    if (!MONGODB_ATLAS_URI) {
      console.warn("⚠️  MONGODB_ATLAS_URI not set. Vector store disabled.");
      return;
    }

    mongoClient = new MongoClient(MONGODB_ATLAS_URI);
    await mongoClient.connect();
    console.log("✅ MongoDB connected");

    const collection = mongoClient
      .db(MONGODB_ATLAS_DB_NAME)
      .collection(MONGODB_ATLAS_COLLECTION_NAME);

    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_API_KEY,
      model: "text-embedding-004",
    });

    vectorStore = new MongoDBAtlasVectorSearch(embeddings, {
      collection,
      indexName: MONGODB_ATLAS_INDEX_NAME,
      textKey: "text",
      embeddingKey: "embedding",
    });

    console.log("✅ Vector store initialized");
  } catch (error) {
    console.error("❌ Failed to initialize vector store:", error);
    vectorStore = null;
  }
}

// Initialize on startup
initializeVectorStore();

// --- User Session Management with Memory ---
interface UserSession {
  userId: string;
  memory: BufferMemory;
  chain: ConversationChain;
  createdAt: Date;
  lastActivity: Date;
}

const userSessions = new Map<string, UserSession>();

// Cleanup inactive sessions every 30 minutes
setInterval(() => {
  const now = new Date();
  const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  
  for (const [userId, session] of userSessions.entries()) {
    const inactiveTime = now.getTime() - session.lastActivity.getTime();
    if (inactiveTime > INACTIVITY_TIMEOUT) {
      userSessions.delete(userId);
      console.log(`🗑️  Cleaned up inactive session: ${userId}`);
    }
  }
}, 30 * 60 * 1000);

async function getUserSession(userId: string): Promise<UserSession> {
  let session = userSessions.get(userId);
  
  if (!session) {
    if (!mongoClient) {
      throw new Error("MongoDB not connected - cannot create persistent chat sessions");
    }
    
    // Create MongoDB-backed chat history for persistence
    const chatHistoryCollection = mongoClient
      .db(process.env.MONGODB_ATLAS_DB_NAME || "ai_recipe_db")
      .collection("chat_history");
    
    const chatHistory = new MongoDBChatMessageHistory({
      collection: chatHistoryCollection,
      sessionId: userId,
    });
    
    // Create memory with MongoDB persistence
    const memory = new BufferMemory({
      returnMessages: true,
      memoryKey: "chat_history",
      chatHistory: chatHistory,
    });
    
    // Create conversational AI assistant
    const chatPrompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(
        `Bạn là Chef AI - trợ lý ảo chuyên về nấu ăn.

NHIỆM VỤ:
- Tư vấn món ăn, nguyên liệu, kỹ thuật nấu
- Gợi ý công thức phù hợp với sở thích user
- Trả lời câu hỏi về dinh dưỡng, thời gian nấu
- Nhớ preferences và ngữ cảnh cuộc trò chuyện
- Gợi ý món ăn dựa trên nguyên liệu có sẵn

HƯỚNG DẪN CÁCH SỬ DỤNG API:
- Nếu user muốn công thức chi tiết → Gợi ý dùng /generate-recipe
- Nếu user muốn tìm món tương tự → Gợi ý dùng /search-recipes

PHONG CÁCH: Thân thiện, nhiệt tình, chuyên nghiệp như đầu bếp giàu kinh nghiệm.
NGÔN NGỮ: Tự động phát hiện và trả lời bằng ngôn ngữ user sử dụng (Việt/English).`
      ),
      new MessagesPlaceholder("chat_history"),
      HumanMessagePromptTemplate.fromTemplate("{input}"),
    ]);
    
    const conversationalLLM = new ChatGoogleGenerativeAI({
      model: "gemini-flash-latest",
      temperature: 0.7, // More creative for conversation
      apiKey: process.env.GOOGLE_API_KEY,
      maxOutputTokens: 1024,
    });
    
    const chain = new ConversationChain({
      llm: conversationalLLM,
      memory: memory,
      prompt: chatPrompt,
    });
    
    session = {
      userId,
      memory,
      chain,
      createdAt: new Date(),
      lastActivity: new Date(),
    };
    
    userSessions.set(userId, session);
    console.log(`✨ Created persistent session for user: ${userId}`);
  } else {
    // Update last activity
    session.lastActivity = new Date();
  }
  
  return session;
}

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

    // RAG: Enhanced retrieval with better accuracy
    let contextFromSimilarRecipes = "";
    if (vectorStore) {
      try {
        // Enhanced query construction for better semantic matching
        const categoryContext =
          providedCategories.length > 0
            ? providedCategories
                .map((c) => CATEGORY_PROMPT_HINTS[c as SupportedCategory])
                .join(" ")
            : "";
        const enhancedQuery =
          `${dishName} món ăn công thức ${categoryContext}`.trim();

        console.log(`🔍 Enhanced RAG search: "${enhancedQuery}"`);
        console.log(
          `   Index: ${process.env.MONGODB_ATLAS_INDEX_NAME || "vector_index"}`
        );

        // Retrieve top 5 with scores for better filtering
        const resultsWithScore = await vectorStore.similaritySearchWithScore(
          enhancedQuery,
          5
        );
        console.log(`📊 Retrieved ${resultsWithScore.length} candidates`);

        // Filter by similarity threshold (0.7 = 70% similar)
        const SIMILARITY_THRESHOLD = 0.7;
        const filteredResults = resultsWithScore.filter(([doc, score]) => {
          // Lower score = more similar for some distance metrics
          // Adjust based on your MongoDB Atlas config (cosine similarity)
          const similarityScore = 1 - score; // Convert distance to similarity
          console.log(
            `   - ${
              doc.metadata?.dishName || "Unknown"
            }: similarity ${similarityScore.toFixed(3)}`
          );
          return similarityScore >= SIMILARITY_THRESHOLD;
        });

        console.log(
          `✅ ${filteredResults.length} recipes above threshold (${SIMILARITY_THRESHOLD})`
        );

        // Take top 3 most relevant
        const topResults = filteredResults.slice(0, 3);

        if (topResults.length > 0) {
          const context = topResults
            .map(([doc, score], idx) => {
              const similarity = (1 - score).toFixed(2);
              return `Công thức tham khảo ${
                idx + 1
              } (độ tương đồng: ${similarity}):
${doc.metadata?.dishName} - ${doc.metadata?.description || "N/A"}
Nguyên liệu chính: ${doc.pageContent.split(".")[2] || "N/A"}
Thời gian: Chuẩn bị ${doc.metadata?.prepTime}, Nấu ${
                doc.metadata?.cookTime
              }, Phục vụ ${doc.metadata?.servings}`;
            })
            .join("\n\n");

          contextFromSimilarRecipes = `\n\n=== THAM KHẢO CÁC CÔNG THỨC TƯƠNG TỰ ===\n${context}\n\n=== YÊU CẦU ===\nDựa vào các công thức trên, tạo công thức MỚI và SÁNG TẠO với phong cách riêng. Đảm bảo có ít nhất 3 bước chi tiết.`;
          console.log(
            `✅ Using ${topResults.length} high-quality similar recipes`
          );
        } else {
          console.log(
            `⚠️  No recipes above similarity threshold - generating from scratch`
          );
        }

        // Debug: If no results, check database
        if (resultsWithScore.length === 0 && mongoClient) {
          const col = mongoClient
            .db(process.env.MONGODB_ATLAS_DB_NAME || "ai_recipe_db")
            .collection(process.env.MONGODB_ATLAS_COLLECTION_NAME || "recipes");
          const totalDocs = await col.countDocuments();
          console.log(
            `   ℹ️  Total documents in DB: ${totalDocs} - Vector index may need refresh`
          );
        }
      } catch (ragError: any) {
        console.error("⚠️  RAG retrieval failed:", ragError.message);
      }
    } else {
      console.log("⚠️  Vector store not initialized - skipping RAG");
    }

    // Optimized prompt - shorter, more direct
    const prompt = `Tạo công thức chi tiết cho: ${dishName}.${categoryInstruction}${languageInstruction}
     Trả về JSON với:
     - dishName, description, prepTime, cookTime, servings
     - ingredients: [{name, quantity}]
     - steps: [{stepNumber: 1, description: "..."}, {stepNumber: 2, description: "..."}, ...]
     Tối thiểu 3 bước, tối đa 6 bước.
     ${contextFromSimilarRecipes}`;

    // Invoke with timeout to prevent long waits
    const startTime = Date.now();
    const result = (await Promise.race([
      structuredLLM.invoke(prompt),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timeout after 30s")), 30000)
      ),
    ])) as any;
    const duration = Date.now() - startTime;
    console.log(`⏱️  Recipe generated in ${duration}ms`);

    // Store recipe in vector store if available
    if (vectorStore) {
      try {
        const recipeText = `${result.dishName}. ${
          result.description
        }. Ingredients: ${result.ingredients
          .map((i: any) => `${i.name} ${i.quantity}`)
          .join(", ")}. Categories: ${providedCategories.join(", ")}`;

        const doc = new Document({
          pageContent: recipeText,
          metadata: {
            dishName: result.dishName,
            description: result.description,
            categories: providedCategories,
            language: lang,
            prepTime: result.prepTime,
            cookTime: result.cookTime,
            servings: result.servings,
            createdAt: new Date().toISOString(),
          },
        });

        await vectorStore.addDocuments([doc]);
        console.log(`✅ Recipe stored: ${result.dishName}`);
      } catch (storeError) {
        console.error("⚠️  Failed to store recipe:", storeError);
      }
    }

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

// --- 4. Generate Recipe with SSE (Server-Sent Events) Streaming ---
app.post("/generate-recipe-stream", async (req: Request, res: Response) => {
  const {
    dishName,
    categories,
    category,
    language = "vi",
  } = req.body as {
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
    let contextFromSimilarRecipes = "";
    if (vectorStore) {
      sendEvent("phase", {
        phase: 2,
        name: "Tìm kiếm",
        message: "Đang tìm công thức tương tự...",
        progress: 30,
      });

      try {
        const searchQuery = `${dishName} ${providedCategories.join(" ")}`;
        const similarRecipes = await vectorStore.similaritySearch(
          searchQuery,
          2
        );

        if (similarRecipes.length > 0) {
          const context = similarRecipes
            .map(
              (doc, idx) =>
                `Công thức tham khảo ${idx + 1}: ${doc.pageContent}\n` +
                `(Thời gian chuẩn bị: ${doc.metadata.prepTime}, Nấu: ${doc.metadata.cookTime}, Phục vụ: ${doc.metadata.servings})`
            )
            .join("\n\n");

          contextFromSimilarRecipes = `\n\nCác công thức tương tự để tham khảo:\n${context}\n\nDựa vào các công thức trên, hãy tạo công thức mới với phong cách riêng.`;

          sendEvent("rag", {
            found: similarRecipes.length,
            recipes: similarRecipes.map((doc) => doc.metadata.dishName),
            message: `Tìm thấy ${similarRecipes.length} công thức tương tự`,
          });
        } else {
          sendEvent("rag", {
            found: 0,
            message: "Không tìm thấy công thức tương tự, sẽ tạo mới từ đầu",
          });
        }
      } catch (ragError) {
        sendEvent("warning", {
          message: "Lỗi khi tìm kiếm, tiếp tục tạo công thức",
        });
      }
    }

    sendEvent("phase", {
      phase: 3,
      name: "Tạo công thức",
      message: "Đang sử dụng AI để tạo công thức...",
      progress: 50,
    });

    // Phase 3: Generate with AI
    const pipelineInput: RecipeInput = {
      dishName,
      categories: providedCategories,
      language,
      contextFromSimilarRecipes,
    };

    const startTime = Date.now();
    const result = await recipeGenerationChain.invoke(pipelineInput);
    const duration = Date.now() - startTime;

    sendEvent("phase", {
      phase: 4,
      name: "Xử lý kết quả",
      message: "Đang lưu trữ công thức...",
      progress: 80,
    });

    // Phase 4: Store in vector database
    if (vectorStore) {
      try {
        const recipeText = `${result.dishName}. ${
          result.description
        }. Ingredients: ${result.ingredients
          .map((i: any) => `${i.name} ${i.quantity}`)
          .join(", ")}. Categories: ${providedCategories.join(", ")}`;

        const doc = new Document({
          pageContent: recipeText,
          metadata: {
            dishName: result.dishName,
            description: result.description,
            categories: providedCategories,
            language,
            prepTime: result.prepTime,
            cookTime: result.cookTime,
            servings: result.servings,
            createdAt: new Date().toISOString(),
          },
        });

        await vectorStore.addDocuments([doc]);
        sendEvent("stored", { message: "Đã lưu công thức vào cơ sở dữ liệu" });
      } catch (storeError) {
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
      recipe: result,
      duration: `${duration}ms`,
      message: "Tạo công thức thành công!",
    });

    res.end();
  } catch (error: any) {
    sendEvent("error", {
      message: "Lỗi khi tạo công thức",
      error: error.message,
    });
    res.end();
  }
});

// --- 5. Generate Recipe with RunnableLambda Pipeline ---
app.post("/generate-recipe-pipeline", async (req: Request, res: Response) => {
  const {
    dishName,
    categories,
    category,
    language = "vi",
  } = req.body as {
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

    // Optional: Retrieve similar recipes for context
    let contextFromSimilarRecipes = "";
    if (vectorStore && providedCategories.length > 0) {
      try {
        const searchQuery = `${dishName} ${providedCategories.join(" ")}`;
        const similarRecipes = await vectorStore.similaritySearch(
          searchQuery,
          2
        );

        if (similarRecipes.length > 0) {
          const context = similarRecipes
            .map(
              (doc, idx) =>
                `Ref ${idx + 1}: ${doc.pageContent.substring(0, 100)}...`
            )
            .join("\n");
          contextFromSimilarRecipes = `\n\nTham khảo:\n${context}`;
        }
      } catch (err) {
        console.warn("RAG retrieval failed:", err);
      }
    }

    // Use the RunnableLambda pipeline
    console.log(`🔄 Using RunnableLambda pipeline for: ${dishName}`);
    const pipelineInput: RecipeInput = {
      dishName,
      categories: providedCategories,
      language,
      contextFromSimilarRecipes,
    };

    const result = await recipeGenerationChain.invoke(pipelineInput);

    // Store in vector store
    if (vectorStore) {
      try {
        const recipeText = `${result.dishName}. ${
          result.description
        }. Ingredients: ${result.ingredients
          .map((i: any) => `${i.name} ${i.quantity}`)
          .join(", ")}`;

        const doc = new Document({
          pageContent: recipeText,
          metadata: {
            dishName: result.dishName,
            categories: providedCategories,
            language,
            createdAt: result.generatedAt,
          },
        });

        await vectorStore.addDocuments([doc]);
        console.log(`✅ Recipe stored: ${result.dishName}`);
      } catch (storeError) {
        console.error("⚠️  Failed to store recipe:", storeError);
      }
    }

    res.json({
      success: true,
      recipe: result,
      mode: "pipeline",
    });
  } catch (error) {
    console.error("Lỗi pipeline:", error);
    res.status(500).json({
      success: false,
      error,
    });
  }
});

// --- 7. Fast Generate Recipe (Skip RAG for speed) ---
app.post("/generate-recipe-fast", async (req: Request, res: Response) => {
  const {
    dishName,
    categories,
    category,
    language = "vi",
  } = req.body as {
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

  // Validate categories (same as main endpoint)
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
    categoryInstruction = ` ${hints}`;
  }

  // Validate language
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

  const languageInstruction = lang === "eng" ? " English." : " Tiếng Việt.";

  try {
    console.log(`⚡ FAST mode: ${dishName}`);

    // Skip RAG for speed - direct generation
    const prompt = `Tạo nhanh công thức: ${dishName}.${categoryInstruction}${languageInstruction}`;

    const startTime = Date.now();
    const result = await structuredLLM.invoke(prompt);
    const duration = Date.now() - startTime;
    console.log(`⏱️  FAST recipe generated in ${duration}ms`);

    res.json({
      success: true,
      recipe: result,
      mode: "fast",
      duration: `${duration}ms`,
    });
  } catch (error) {
    console.error("Lỗi khi tạo công thức (fast):", error);
    res.status(500).json({
      success: false,
      error,
    });
  }
});

// --- 8. Check Vector Store Status ---
app.get("/vector-store-status", async (req: Request, res: Response) => {
  if (!vectorStore || !mongoClient) {
    return res.json({
      initialized: false,
      message: "Vector store not configured. Set MONGODB_ATLAS_URI in .env",
    });
  }

  try {
    const collection = mongoClient
      .db(process.env.MONGODB_ATLAS_DB_NAME || "ai_recipe_db")
      .collection(process.env.MONGODB_ATLAS_COLLECTION_NAME || "recipes");

    const count = await collection.countDocuments();
    const sampleDocs = await collection.find().limit(5).toArray();

    // Test vector search
    let vectorSearchWorks = false;
    let vectorSearchError = null;
    try {
      const testResults = await vectorStore.similaritySearch("test", 1);
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
});

// --- 9. Search Recipes Endpoint ---
app.post("/search-recipes", async (req: Request, res: Response) => {
  const { query, limit = 5 } = req.body as {
    query?: string;
    limit?: number;
  };

  if (!query) {
    return res
      .status(400)
      .json({ error: "Vui lòng cung cấp 'query' trong body request." });
  }

  if (!vectorStore) {
    return res.status(503).json({
      error:
        "Vector store không khả dụng. Vui lòng cấu hình MONGODB_ATLAS_URI.",
    });
  }

  try {
    const results = await vectorStore.similaritySearch(query, limit);

    const recipes = results.map((doc) => ({
      dishName: doc.metadata.dishName,
      description: doc.metadata.description,
      categories: doc.metadata.categories,
      language: doc.metadata.language,
      prepTime: doc.metadata.prepTime,
      cookTime: doc.metadata.cookTime,
      servings: doc.metadata.servings,
      createdAt: doc.metadata.createdAt,
      score: doc.metadata.score,
    }));

    res.json({
      success: true,
      query,
      count: recipes.length,
      recipes,
    });
  } catch (error) {
    console.error("Lỗi khi tìm kiếm công thức:", error);
    res.status(500).json({
      success: false,
      error: "Không thể tìm kiếm công thức.",
    });
  }
});

// --- 10. Chat Assistant Endpoint (Per-User Memory) ---
app.post("/chat", async (req: Request, res: Response) => {
  const { userId, message } = req.body as {
    userId?: string;
    message?: string;
  };

  if (!userId || !message) {
    return res.status(400).json({
      error: "Vui lòng cung cấp 'userId' và 'message'",
    });
  }

  try {
    // Get or create user session
    const session = await getUserSession(userId);
    
    console.log(`💬 Chat from ${userId}: "${message.substring(0, 50)}..."`);
    
    // Check if user is asking about recipes - enhance with RAG
    let context = "";
    if (vectorStore && (message.toLowerCase().includes("công thức") || 
        message.toLowerCase().includes("món") ||
        message.toLowerCase().includes("recipe"))) {
      try {
        const searchResults = await vectorStore.similaritySearch(message, 3);
        if (searchResults.length > 0) {
          context = `\n\nThông tin từ cơ sở dữ liệu:\n` +
            searchResults.map((doc, idx) => 
              `${idx + 1}. ${doc.metadata?.dishName}: ${doc.metadata?.description || doc.pageContent.substring(0, 100)}`
            ).join("\n");
          console.log(`   🔍 Enhanced with ${searchResults.length} related recipes`);
        }
      } catch (err) {
        console.warn("   ⚠️  Failed to enhance with RAG");
      }
    }
    
    // Add context if available
    const enhancedMessage = context ? `${message}${context}` : message;
    
    // Get response from conversational chain
    const response = await session.chain.call({ input: enhancedMessage });
    
    console.log(`   ✅ Response generated`);
    
    res.json({
      success: true,
      userId,
      message: response.response,
      sessionInfo: {
        createdAt: session.createdAt,
        messageCount: (await session.memory.chatHistory.getMessages()).length,
      },
    });
  } catch (error: any) {
    console.error("Lỗi chat:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// --- 11. Get Chat History ---
app.get("/chat/history/:userId", async (req: Request, res: Response) => {
  const { userId } = req.params;
  
  const session = userSessions.get(userId);
  
  if (!session) {
    return res.json({
      success: true,
      userId,
      exists: false,
      history: [],
    });
  }
  
  try {
    const messages = await session.memory.chatHistory.getMessages();
    
    res.json({
      success: true,
      userId,
      exists: true,
      messageCount: messages.length,
      history: messages.map((msg: any) => ({
        type: msg._getType(),
        content: msg.content,
      })),
      sessionInfo: {
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// --- 12. Clear Chat History ---
app.delete("/chat/history/:userId", async (req: Request, res: Response) => {
  const { userId } = req.params;
  
  const deleted = userSessions.delete(userId);
  
  res.json({
    success: true,
    userId,
    deleted,
    message: deleted 
      ? "Đã xóa lịch sử chat" 
      : "Không tìm thấy session",
  });
});

// --- 13. Active Sessions Status ---
app.get("/chat/sessions", (req: Request, res: Response) => {
  const sessions = Array.from(userSessions.entries()).map(([userId, session]) => ({
    userId,
    createdAt: session.createdAt,
    lastActivity: session.lastActivity,
    messageCount: session.memory.chatHistory ? "N/A" : 0,
  }));
  
  res.json({
    success: true,
    totalSessions: userSessions.size,
    sessions,
  });
});

// --- 14. Graceful Shutdown ---
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down gracefully...");
  if (mongoClient) {
    await mongoClient.close();
    console.log("✅ MongoDB connection closed");
  }
  process.exit(0);
});

app.listen(port, () => {
  console.log(`Server đang chạy tại http://localhost:${port}`);
  console.log(
    "Sử dụng POST request tới /generate-recipe với body: { 'dishName': 'Tên món ăn' }"
  );
  console.log(
    "Sử dụng POST request tới /search-recipes với body: { 'query': 'Tìm kiếm công thức' }"
  );
  console.log(
    "Sử dụng GET request tới /vector-store-status để kiểm tra trạng thái vector store"
  );
  console.log(
    "Sử dụng POST request tới /generate-recipe-pipeline để dùng RunnableLambda pipeline"
  );
  console.log(
    "Sử dụng POST request tới /generate-recipe-fast để tạo nhanh (skip RAG)"
  );
  console.log(
    "Sử dụng POST request tới /generate-recipe-stream để theo dõi tiến trình (SSE)"
  );
  console.log("\n💬 Chat Assistant APIs:");
  console.log(
    "  POST /chat với body: { userId, message } - Chat với trợ lý ảo"
  );
  console.log(
    "  GET /chat/history/:userId - Xem lịch sử chat"
  );
  console.log(
    "  DELETE /chat/history/:userId - Xóa lịch sử chat"
  );
  console.log(
    "  GET /chat/sessions - Xem tất cả sessions đang active"
  );
});
