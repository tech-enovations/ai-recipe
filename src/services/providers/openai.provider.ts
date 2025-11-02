// src/services/providers/openai.provider.ts
import { ChatOpenAI } from "@langchain/openai";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ENV } from "../../config/env";
import { RecipeSchema } from "../../schemas/recipe.schema";
import { ILLMProvider } from "../llm-provider.interface";

export class OpenAIProvider implements ILLMProvider {
  private recipeLLM: BaseChatModel;
  private chatLLM: BaseChatModel;
  private structuredLLM: any;

  constructor() {
    console.log("Initializing OpenAI provider");
    
    // LLM for recipe generation
    const recipeModel = new ChatOpenAI({
      modelName: ENV.OPENAI_RECIPE_MODEL,
      temperature: ENV.TEMPERATURE,
      apiKey: ENV.OPENAI_API_KEY,
      maxTokens: ENV.MAX_OUTPUT_TOKENS,
    });
    this.recipeLLM = recipeModel as BaseChatModel;

    // LLM for chat conversations
    const chatModel = new ChatOpenAI({
      modelName: ENV.OPENAI_CHAT_MODEL,
      temperature: ENV.CHAT_TEMPERATURE,
      apiKey: ENV.OPENAI_API_KEY,
      maxTokens: 1024,
    });
    this.chatLLM = chatModel as BaseChatModel;

    // Structured output for recipes
    this.structuredLLM = recipeModel.withStructuredOutput(RecipeSchema, {
      name: "recipe",
    });
    
    console.log(`OpenAI configured: recipe=${ENV.OPENAI_RECIPE_MODEL}, chat=${ENV.OPENAI_CHAT_MODEL}`);
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
  
  getProviderName(): string {
    return "openai";
  }
  
  isAvailable(): boolean {
    return !!ENV.OPENAI_API_KEY;
  }
}

