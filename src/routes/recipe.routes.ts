// src/routes/recipe.routes.ts
import { Router } from "express";
import { 
  generateRecipeHandler, 
  searchRecipesHandler, 
  vectorStoreStatusHandler 
} from "../handlers/recipe.handler";
import { generateRecipeStreamHandler } from "../handlers/stream.handler";
import { suggestRecipeFromIngredientsHandler } from "../handlers/suggest.handler";

const router = Router();

// Recipe generation endpoints
router.post("/generate-recipe", generateRecipeHandler);
router.post("/generate-recipe-stream", generateRecipeStreamHandler);

// Ingredient-based suggestion
router.post("/suggest-from-ingredients", suggestRecipeFromIngredientsHandler);

// Search endpoints
router.post("/search-recipes", searchRecipesHandler);

// Status endpoints
router.get("/vector-store-status", vectorStoreStatusHandler);

export default router;

