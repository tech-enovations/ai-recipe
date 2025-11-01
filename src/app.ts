// src/app.ts - Main Express Application
import express from "express";
import cors from "cors";
import path from "path";
import { ENV, validateEnv } from "./config/env";
import { log } from "./utils/logger";
import recipeRoutes from "./routes/recipe.routes";
import chatRoutes from "./routes/chat.routes";
import { vectorStoreService } from "./services/vector-store.service";
import { chatService } from "./services/chat.service";

// Validate environment variables
validateEnv();

// Initialize Express app
const app = express();

// Middleware
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(express.static("public"));

// View engine setup for EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));

// Routes
app.use("/api", recipeRoutes);
app.use("/api", chatRoutes);

// Home page with EJS
app.get("/", (req, res) => {
  res.render("index", {
    title: "AI Recipe Generator",
    apiUrl: `http://localhost:${ENV.PORT}`,
  });
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    vectorStore: vectorStoreService.isAvailable(),
    activeSessions: chatService.getTotalSessions(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
    path: req.path,
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  log.error("Unhandled error", err);
  res.status(500).json({
    error: "Internal server error",
    message: ENV.NODE_ENV === "development" ? err.message : undefined,
  });
});

export default app;

