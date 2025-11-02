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
import { llmService } from "./services/llm.service";

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

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    log.info(`${req.method} ${req.path}`, {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
    });
  });
  next();
});

// View engine setup for EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));

// Routes
app.use("/api", recipeRoutes);
app.use("/api", chatRoutes);

// View routes
const apiUrl = ENV.API_URL;

app.get("/", (req, res) => {
  res.render("index", {
    title: "AI Recipe Generator",
    apiUrl,
    currentPage: "home",
  });
});

app.get("/demo", (req, res) => {
  res.render("demo", {
    title: "Stream Demo",
    apiUrl,
    currentPage: "demo",
    defaultDish: "",
  });
});

app.get("/suggest", (req, res) => {
  res.render("suggest", {
    title: "Suggest Recipes",
    apiUrl,
    currentPage: "suggest",
  });
});

app.get("/chat-ui", (req, res) => {
  res.render("chat", {
    title: "Chat Assistant",
    apiUrl,
    currentPage: "chat",
  });
});

app.get("/search-ui", (req, res) => {
  res.render("search", {
    title: "Search Recipes",
    apiUrl,
    currentPage: "search",
  });
});

app.get("/status", (req, res) => {
  res.render("status", {
    title: "System Status",
    apiUrl,
    currentPage: "status",
  });
});

// Health check (with hot reload support via nodemon)
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    provider: {
      llm: llmService.getProviderName(),
      available: llmService.getProvider().isAvailable(),
    },
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

