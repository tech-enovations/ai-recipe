// src/services/llm-provider.interface.ts
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

export interface ILLMProvider {
  // Get LLM instances
  getRecipeLLM(): BaseChatModel;
  getChatLLM(): BaseChatModel;
  getStructuredLLM(): any;
  
  // Provider info
  getProviderName(): string;
  isAvailable(): boolean;
}

export interface LLMGenerationResult {
  result: any;
  duration: number;
}


