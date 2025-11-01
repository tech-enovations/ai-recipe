// src/routes/recipe.routes.ts
import { Router } from "express";
import { 
  generateRecipeHandler, 
  searchRecipesHandler, 
  vectorStoreStatusHandler 
} from "../handlers/recipe.handler";

const router = Router();

router.post("/generate-recipe", generateRecipeHandler);
router.post("/search-recipes", searchRecipesHandler);
router.get("/vector-store-status", vectorStoreStatusHandler);

export default router;

