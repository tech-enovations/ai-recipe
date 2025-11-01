// src/services/llm.service.ts
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ENV } from "../config/env";
import { RecipeSchema } from "../schemas/recipe.schema";

export class LLMService {
  private recipeLLM: ChatGoogleGenerativeAI;
  private chatLLM: ChatGoogleGenerativeAI;
  private structuredLLM: any;

  constructor() {
    // LLM for recipe generation
    this.recipeLLM = new ChatGoogleGenerativeAI({
      model: ENV.RECIPE_MODEL,
      temperature: ENV.TEMPERATURE,
      apiKey: ENV.GOOGLE_API_KEY,
      maxOutputTokens: ENV.MAX_OUTPUT_TOKENS,
      topP: 0.95,
      topK: 40,
    });

    // LLM for chat conversations
    this.chatLLM = new ChatGoogleGenerativeAI({
      model: ENV.CHAT_MODEL,
      temperature: ENV.CHAT_TEMPERATURE,
      apiKey: ENV.GOOGLE_API_KEY,
      maxOutputTokens: 1024,
    });

    // Structured output for recipes
    this.structuredLLM = this.recipeLLM.withStructuredOutput(RecipeSchema, {
      name: "recipe",
    });
  }

  getRecipeLLM() {
    return this.recipeLLM;
  }

  getChatLLM() {
    return this.chatLLM;
  }

  getStructuredLLM() {
    return this.structuredLLM;
  }

  async generateRecipe(prompt: string, timeout: number = ENV.REQUEST_TIMEOUT) {
    const startTime = Date.now();
    
    const result = await Promise.race([
      this.structuredLLM.invoke(prompt),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timeout")), timeout)
      ),
    ]);
    
    const duration = Date.now() - startTime;
    
    return { result, duration };
  }
}

// Singleton instance
export const llmService = new LLMService();

