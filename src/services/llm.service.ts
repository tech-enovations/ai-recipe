// src/services/llm.service.ts
import { ENV } from "../config/env";
import { ILLMProvider } from "./llm-provider.interface";
import { GeminiProvider } from "./providers/gemini.provider";
import { OpenAIProvider } from "./providers/openai.provider";
import { log } from "../utils/logger";

export class LLMService {
  private provider: ILLMProvider;

  constructor() {
    // Select provider based on ENV
    this.provider = this.createProvider();
    
    if (!this.provider.isAvailable()) {
      throw new Error(`LLM Provider '${this.provider.getProviderName()}' is not available - check API key`);
    }
    
    log.info(`LLM Service initialized with provider: ${this.provider.getProviderName()}`);
  }
  
  private createProvider(): ILLMProvider {
    switch (ENV.LLM_PROVIDER) {
      case "gemini":
        return new GeminiProvider();
      case "openai":
        return new OpenAIProvider();
      default:
        log.warn(`Unknown provider: ${ENV.LLM_PROVIDER}, falling back to Gemini`);
        return new GeminiProvider();
    }
  }
  
  getProvider(): ILLMProvider {
    return this.provider;
  }
  
  getProviderName(): string {
    return this.provider.getProviderName();
  }

  getRecipeLLM() {
    return this.provider.getRecipeLLM();
  }

  getChatLLM() {
    return this.provider.getChatLLM();
  }

  getStructuredLLM() {
    return this.provider.getStructuredLLM();
  }

  async generateRecipe(prompt: string, timeout: number = ENV.REQUEST_TIMEOUT, retries: number = 2) {
    const startTime = Date.now();
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          // Wait before retry (exponential backoff)
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
          console.log(`Retry attempt ${attempt}/${retries} after ${delay}ms delay...`);
        }
        
        const result = await Promise.race([
          this.getStructuredLLM().invoke(prompt),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Request timeout")), timeout)
          ),
        ]);
        
        const duration = Date.now() - startTime;
        
        // Validate result
        if (!result || typeof result !== 'object') {
          throw new Error("Invalid response from LLM: result is not an object");
        }
        
        return { result, duration };
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on timeout or validation errors
        if (error.message?.includes('timeout') || error.message?.includes('Invalid response')) {
          break;
        }
        
        // Log retry attempt
        if (attempt < retries) {
          console.warn(`Attempt ${attempt + 1} failed: ${error.message}. Retrying...`);
        }
      }
    }
    
    // Better error messages based on provider
    const providerName = this.getProviderName();
    
    if (lastError?.message?.includes('parts')) {
      throw new Error(
        `${providerName === 'gemini' ? 'Gemini' : 'LLM'} API error: Response format invalid. This usually means rate limit or API error. Please try again in a few moments.`
      );
    }
    
    if (lastError?.message?.includes('timeout')) {
      throw new Error(`Request timeout after ${timeout}ms. Try a simpler recipe or increase timeout.`);
    }
    
    if (lastError?.message?.includes('rate_limit') || lastError?.message?.includes('429')) {
      throw new Error(`${providerName.toUpperCase()} rate limit exceeded. Please try again in a few moments.`);
    }
    
    // Re-throw with more context
    throw new Error(`[${providerName.toUpperCase()}] Recipe generation failed after ${retries + 1} attempts: ${lastError?.message || 'Unknown error'}`);
  }
}

// Singleton instance
export const llmService = new LLMService();

