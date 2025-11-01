// src/server.ts - Server Entry Point
import app from "./app";
import { ENV } from "./config/env";
import { log } from "./utils/logger";
import { vectorStoreService } from "./services/vector-store.service";
import { chatService } from "./services/chat.service";

async function startServer() {
  try {
    log.server.starting(ENV.PORT);

    // Initialize services
    await vectorStoreService.initialize();

    // Start server
    const server = app.listen(ENV.PORT, () => {
      log.server.started(ENV.PORT);
      log.info(`📝 API Documentation: http://localhost:${ENV.PORT}/`);
      log.info(`🎨 Stream Demo: http://localhost:${ENV.PORT}/stream-demo.html`);
      log.info("\n📡 Available endpoints:");
      log.info("  POST /api/generate-recipe");
      log.info("  POST /api/search-recipes");
      log.info("  GET  /api/vector-store-status");
      log.info("  POST /api/chat");
      log.info("  GET  /api/chat/history/:userId");
      log.info("  GET  /api/chat/sessions");
    });

    // Graceful shutdown
    const shutdown = async () => {
      log.server.shutdown();
      
      server.close(() => {
        log.info("✅ Server closed");
      });
      
      await vectorStoreService.close();
      chatService.destroy();
      
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    log.error("Failed to start server", error);
    process.exit(1);
  }
}

// Start server
startServer();

