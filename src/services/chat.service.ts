// src/services/chat.service.ts
import { BufferMemory } from "langchain/memory";
import { MongoDBChatMessageHistory } from "@langchain/mongodb";
import { ConversationChain } from "langchain/chains";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
import { ENV } from "../config/env";
import { llmService } from "./llm.service";
import { vectorStoreService } from "./vector-store.service";

interface UserSession {
  userId: string;
  memory: BufferMemory;
  chain: ConversationChain;
  createdAt: Date;
  lastActivity: Date;
}

export class ChatService {
  private userSessions = new Map<string, UserSession>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup inactive sessions periodically
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSessions();
    }, ENV.SESSION_INACTIVITY_TIMEOUT);
  }

  private cleanupInactiveSessions(): void {
    const now = new Date();

    for (const [userId, session] of this.userSessions.entries()) {
      const inactiveTime = now.getTime() - session.lastActivity.getTime();
      if (inactiveTime > ENV.SESSION_INACTIVITY_TIMEOUT) {
        this.userSessions.delete(userId);
        console.log(`🗑️  Cleaned up inactive session: ${userId}`);
      }
    }
  }

  async getUserSession(userId: string): Promise<UserSession> {
    let session = this.userSessions.get(userId);

    if (!session) {
      const mongoClient = vectorStoreService.getClient();
      
      if (!mongoClient) {
        throw new Error("MongoDB not connected - cannot create chat sessions");
      }

      // MongoDB-backed chat history
      const chatHistoryCollection = mongoClient
        .db(ENV.MONGODB_ATLAS_DB_NAME)
        .collection(ENV.CHAT_HISTORY_COLLECTION);

      const chatHistory = new MongoDBChatMessageHistory({
        collection: chatHistoryCollection,
        sessionId: userId,
      });

      // Memory with persistence
      const memory = new BufferMemory({
        returnMessages: true,
        memoryKey: "chat_history",
        chatHistory: chatHistory,
      });

      // Conversational prompt
      const chatPrompt = ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(
          `Bạn là Chef AI - trợ lý ảo chuyên về nấu ăn.

NHIỆM VỤ:
- Tư vấn món ăn, nguyên liệu, kỹ thuật nấu
- Gợi ý công thức phù hợp với sở thích user
- Trả lời câu hỏi về dinh dưỡng, thời gian nấu
- Nhớ preferences và ngữ cảnh cuộc trò chuyện
- Gợi ý món ăn dựa trên nguyên liệu có sẵn

HƯỚNG DẪN API:
- Muốn công thức chi tiết → Gợi ý dùng /generate-recipe
- Muốn tìm món tương tự → Gợi ý dùng /search-recipes

PHONG CÁCH: Thân thiện, nhiệt tình, chuyên nghiệp.
NGÔN NGỮ: Tự động detect và trả lời bằng ngôn ngữ user dùng.`
        ),
        new MessagesPlaceholder("chat_history"),
        HumanMessagePromptTemplate.fromTemplate("{input}"),
      ]);

      const chain = new ConversationChain({
        llm: llmService.getChatLLM(),
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

      this.userSessions.set(userId, session);
      console.log(`✨ Created persistent session: ${userId}`);
    } else {
      session.lastActivity = new Date();
    }

    return session;
  }

  async chat(userId: string, message: string): Promise<any> {
    const session = await this.getUserSession(userId);

    // Enhance with RAG if asking about recipes
    let context = "";
    if (
      vectorStoreService.isAvailable() &&
      (message.toLowerCase().includes("công thức") ||
        message.toLowerCase().includes("món") ||
        message.toLowerCase().includes("recipe"))
    ) {
      try {
        const searchResults = await vectorStoreService.searchRecipes(message, 3);
        if (searchResults.length > 0) {
          context =
            `\n\nThông tin từ cơ sở dữ liệu:\n` +
            searchResults
              .map(
                (doc, idx) =>
                  `${idx + 1}. ${doc.metadata?.dishName}: ${
                    doc.metadata?.description ||
                    doc.pageContent.substring(0, 100)
                  }`
              )
              .join("\n");
          console.log(`   🔍 Enhanced with ${searchResults.length} recipes`);
        }
      } catch (err) {
        console.warn("   ⚠️  RAG enhancement failed");
      }
    }

    const enhancedMessage = context ? `${message}${context}` : message;
    const response = await session.chain.call({ input: enhancedMessage });

    return {
      message: response.response,
      sessionInfo: {
        createdAt: session.createdAt,
        messageCount: (await session.memory.chatHistory.getMessages()).length,
      },
    };
  }

  async getChatHistory(userId: string): Promise<any> {
    const session = this.userSessions.get(userId);

    if (!session) {
      return {
        exists: false,
        history: [],
      };
    }

    const messages = await session.memory.chatHistory.getMessages();

    return {
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
    };
  }

  clearSession(userId: string): boolean {
    return this.userSessions.delete(userId);
  }

  getAllSessions(): any[] {
    return Array.from(this.userSessions.entries()).map(([userId, session]) => ({
      userId,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
    }));
  }

  getTotalSessions(): number {
    return this.userSessions.size;
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}

// Singleton instance
export const chatService = new ChatService();

