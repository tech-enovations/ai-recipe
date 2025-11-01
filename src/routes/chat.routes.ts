// src/routes/chat.routes.ts
import { Router } from "express";
import {
  chatHandler,
  getChatHistoryHandler,
  clearChatHistoryHandler,
  getActiveSessionsHandler,
} from "../handlers/chat.handler";

const router = Router();

router.post("/chat", chatHandler);
router.get("/chat/history/:userId", getChatHistoryHandler);
router.delete("/chat/history/:userId", clearChatHistoryHandler);
router.get("/chat/sessions", getActiveSessionsHandler);

export default router;

