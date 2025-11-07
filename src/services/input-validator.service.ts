// src/services/input-validator.service.ts
import { log } from "../utils/logger";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ENV } from "../config/env";
import { z } from "zod";

export interface ValidationResult {
  isValid: boolean;
  sanitized: string;
  violations: string[];
  severity: "low" | "medium" | "high";
  reason?: string;
}

// Zod schema for AI validation response
const AIValidationSchema = z.object({
  isValid: z.boolean().describe("true nếu input hợp lệ và liên quan đến món ăn, false nếu không"),
  isFoodRelated: z.boolean().describe("true nếu input liên quan đến món ăn/nấu nướng"),
  containsInappropriate: z.boolean().describe("true nếu chứa nội dung không phù hợp (bạo lực, tình dục, chính trị, spam, code injection)"),
  sanitizedInput: z.string().describe("Input đã được làm sạch, loại bỏ ký tự đặc biệt không cần thiết"),
  violations: z.array(z.string()).describe("Danh sách các vấn đề phát hiện được"),
  severity: z.enum(["low", "medium", "high"]).describe("Mức độ nghiêm trọng: low (nhẹ), medium (trung bình), high (nghiêm trọng)"),
  reason: z.string().describe("Lý do chi tiết tại sao input không hợp lệ (nếu có)"),
});

export class InputValidatorService {
  private aiValidator: ChatGoogleGenerativeAI;
  private validationCache: Map<string, ValidationResult> = new Map();
  private readonly CACHE_TTL = 3600000; // 1 hour
  private readonly MAX_CACHE_SIZE = 1000;

  constructor() {
    // Use Gemini for validation (free and fast)
    this.aiValidator = new ChatGoogleGenerativeAI({
      apiKey: ENV.GOOGLE_API_KEY,
      model: "gemini-2.0-flash-exp", // Fast model for validation
      temperature: 0.1, // Low temperature for consistent validation
    });
  }

  /**
   * Validate input using AI
   */
  async validateWithAI(input: string, context: "recipe" | "chat" | "search" = "recipe"): Promise<ValidationResult> {
    // Check cache first
    const cacheKey = `${context}:${input}`;
    if (this.validationCache.has(cacheKey)) {
      log.debug("Using cached validation result");
      return this.validationCache.get(cacheKey)!;
    }

    try {
      const prompt = this.buildValidationPrompt(input, context);
      
      // Use structured output with Zod schema
      const structuredLLM = this.aiValidator.withStructuredOutput(AIValidationSchema, {
        name: "input_validation",
      });

      const startTime = Date.now();
      const result = await structuredLLM.invoke(prompt);
      const duration = Date.now() - startTime;

      log.debug(`AI validation completed in ${duration}ms`, { 
        input: input.substring(0, 50),
        isValid: result.isValid,
        violations: result.violations,
      });

      const validationResult: ValidationResult = {
        isValid: result.isValid && result.isFoodRelated && !result.containsInappropriate,
        sanitized: result.sanitizedInput,
        violations: result.violations,
        severity: result.severity,
        reason: result.reason,
      };

      // Cache the result
      this.cacheValidationResult(cacheKey, validationResult);

      return validationResult;
    } catch (error: any) {
      log.error("AI validation failed, falling back to basic validation", error);
      // Fallback to basic validation if AI fails
      return this.basicValidate(input, context);
    }
  }

  /**
   * Build validation prompt for AI
   */
  private buildValidationPrompt(input: string, context: "recipe" | "chat" | "search"): string {
    const contextInstructions: Record<"recipe" | "chat" | "search", string> = {
      recipe: `
Bạn là một hệ thống kiểm duyệt input cho ứng dụng tạo công thức nấu ăn.
Nhiệm vụ: Kiểm tra xem input có phù hợp để tạo công thức món ăn không.

Input cần kiểm tra: "${input}"

Hãy phân tích và trả về JSON với các tiêu chí sau:

1. **isValid**: Input có hợp lệ không?
   - ✅ HỢP LỆ nếu: Là tên món ăn, nguyên liệu, hoặc yêu cầu nấu ăn
   - ❌ KHÔNG HỢP LỆ nếu: Chứa nội dung không phù hợp hoặc không liên quan món ăn

2. **isFoodRelated**: Input có liên quan đến món ăn/nấu nướng không?
   - Ví dụ HỢP LỆ: "Phở Bò", "Cơm Gà Hải Nam", "Bánh Mì", "món chay", "món Việt"
   - Ví dụ KHÔNG HỢP LỆ: "xe hơi", "điện thoại", "bóng đá", "chính trị"

3. **containsInappropriate**: Input có chứa nội dung không phù hợp?
   - Bạo lực, tình dục, chính trị nhạy cảm
   - Spam, quảng cáo, URL, email
   - Code injection (SQL, XSS, script tags)
   - Từ ngữ xúc phạm, phân biệt chủng tộc

4. **sanitizedInput**: Làm sạch input
   - Loại bỏ ký tự đặc biệt không cần thiết
   - Giữ lại chữ cái, số, dấu cách, dấu câu cơ bản
   - Trim whitespace

5. **violations**: Liệt kê các vấn đề (nếu có)

6. **severity**: Mức độ nghiêm trọng
   - "low": Vấn đề nhỏ (ví dụ: input hơi ngắn, có ký tự lạ)
   - "medium": Vấn đề trung bình (ví dụ: không liên quan món ăn)
   - "high": Vấn đề nghiêm trọng (ví dụ: nội dung không phù hợp, spam, injection)

7. **reason**: Giải thích chi tiết tại sao không hợp lệ (nếu có)

Hãy NGHIÊM NGẶT với:
- Nội dung bạo lực, tình dục, chính trị
- Spam, quảng cáo, URL
- Code injection attempts
- Nội dung không liên quan món ăn

Hãy LINH HOẠT với:
- Tên món ăn bằng tiếng Việt hoặc tiếng Anh
- Món ăn quốc tế (Ý, Nhật, Hàn, Thái, v.v.)
- Yêu cầu nấu ăn ("món chay", "món ít dầu", "món cho bé")
- Nguyên liệu ("gà", "tôm", "rau củ")
`,
      chat: `
Bạn là một hệ thống kiểm duyệt tin nhắn chat cho ứng dụng nấu ăn.
Nhiệm vụ: Kiểm tra xem tin nhắn có phù hợp không.

Tin nhắn: "${input}"

Chat có thể linh hoạt hơn recipe, nhưng vẫn cần kiểm tra:
- Nội dung không phù hợp (bạo lực, tình dục, chính trị)
- Spam, quảng cáo
- Code injection

Tin nhắn chat KHÔNG BẮT BUỘC phải liên quan món ăn (có thể hỏi chung chung).
`,
      search: `
Bạn là một hệ thống kiểm duyệt từ khóa tìm kiếm cho ứng dụng nấu ăn.
Nhiệm vụ: Kiểm tra xem từ khóa tìm kiếm có phù hợp không.

Từ khóa: "${input}"

Kiểm tra:
- Có liên quan món ăn không?
- Có chứa nội dung không phù hợp không?
- Có phải spam/injection không?
`,
    };

    return contextInstructions[context];
  }

  /**
   * Cache validation result
   */
  private cacheValidationResult(key: string, result: ValidationResult): void {
    // Clear old cache if too large
    if (this.validationCache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.validationCache.keys().next().value;
      if (firstKey) {
        this.validationCache.delete(firstKey);
      }
    }

    this.validationCache.set(key, result);

    // Auto-clear after TTL
    setTimeout(() => {
      this.validationCache.delete(key);
    }, this.CACHE_TTL);
  }

  /**
   * Basic validation (fallback when AI fails)
   */
  private basicValidate(input: string, context: "recipe" | "chat" | "search"): ValidationResult {
    const violations: string[] = [];
    let sanitized = input.trim();
    let severity: "low" | "medium" | "high" = "low";

    // Basic length check
    if (sanitized.length === 0) {
      return {
        isValid: false,
        sanitized: "",
        violations: ["Input rỗng"],
        severity: "low",
      };
    }

    if (sanitized.length > 500) {
      violations.push("Input quá dài (> 500 ký tự)");
      sanitized = sanitized.substring(0, 500);
      severity = "medium";
    }

    // Basic XSS/injection check
    if (/<script|javascript:|onerror=|onclick=/gi.test(sanitized)) {
      violations.push("Phát hiện code injection");
      severity = "high";
      return { isValid: false, sanitized: "", violations, severity };
    }

    // Remove excessive whitespace
    sanitized = sanitized.replace(/\s+/g, " ").trim();

    // Remove special characters (keep Vietnamese)
    sanitized = sanitized.replace(/[^\p{L}\p{N}\s,.\-()\/]/gu, "");

    const isValid = sanitized.length > 0 && (severity === "low" || severity === "medium");

    return {
      isValid,
      sanitized,
      violations,
      severity,
    };
  }

  /**
   * Validate dish name specifically (async with AI)
   */
  async validateDishName(dishName: string): Promise<ValidationResult> {
    const result = await this.validateWithAI(dishName, "recipe");

    // Additional checks for dish names
    if (result.sanitized.length < 2) {
      result.isValid = false;
      result.violations.push("Tên món ăn quá ngắn (< 2 ký tự)");
      result.severity = "medium";
    }

    if (result.sanitized.length > 100) {
      result.violations.push("Tên món ăn quá dài (> 100 ký tự)");
      result.sanitized = result.sanitized.substring(0, 100);
      result.severity = "medium";
    }

    // Check if it's just numbers
    if (/^\d+$/.test(result.sanitized)) {
      result.isValid = false;
      result.violations.push("Tên món ăn không thể chỉ là số");
      result.severity = "medium";
    }

    return result;
  }

  /**
   * Validate ingredients list (async with AI)
   */
  async validateIngredients(ingredients: string): Promise<ValidationResult> {
    const result = await this.validateWithAI(ingredients, "recipe");

    // Additional checks for ingredients
    if (result.sanitized.length < 5) {
      result.isValid = false;
      result.violations.push("Danh sách nguyên liệu quá ngắn");
      result.severity = "medium";
    }

    return result;
  }

  /**
   * Validate chat message (async with AI)
   */
  async validateChatMessage(message: string): Promise<ValidationResult> {
    return await this.validateWithAI(message, "chat");
  }

  /**
   * Validate search query (async with AI)
   */
  async validateSearchQuery(query: string): Promise<ValidationResult> {
    const result = await this.validateWithAI(query, "search");

    if (result.sanitized.length < 2) {
      result.isValid = false;
      result.violations.push("Từ khóa tìm kiếm quá ngắn (< 2 ký tự)");
      result.severity = "medium";
    }

    return result;
  }

  /**
   * Get user-friendly error message
   */
  getErrorMessage(result: ValidationResult): string {
    if (result.isValid) {
      return "";
    }

    let message = "";
    switch (result.severity) {
      case "high":
        message = "❌ Input chứa nội dung không phù hợp và đã bị chặn.";
        break;
      case "medium":
        message = "⚠️ Input có vấn đề: " + result.violations.join(", ") + ".";
        break;
      case "low":
        message = "ℹ️ " + result.violations.join(", ");
        break;
      default:
        message = "Input không hợp lệ.";
    }

    // Add AI reason if available
    if (result.reason) {
      message += ` ${result.reason}`;
    }

    return message;
  }

  /**
   * Get warning message for valid but suspicious input
   */
  getWarningMessage(result: ValidationResult): string {
    if (!result.isValid || result.violations.length === 0) {
      return "";
    }

    return "⚠️ Lưu ý: " + result.violations.join(", ");
  }
}

// Singleton instance
export const inputValidator = new InputValidatorService();

