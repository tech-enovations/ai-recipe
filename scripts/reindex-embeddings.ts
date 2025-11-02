#!/usr/bin/env ts-node
/**
 * Reindex all recipe embeddings with current weights
 * 
 * Usage:
 *   ts-node scripts/reindex-embeddings.ts
 * 
 * This will:
 * 1. Connect to MongoDB
 * 2. Re-generate embeddings for all recipes using current DISHNAME_WEIGHT & CATEGORY_WEIGHT
 * 3. Update documents in-place
 * 4. Show progress and results
 */

import * as dotenv from "dotenv";
import { vectorStoreService } from "../src/services/vector-store.service";
import { ENV } from "../src/config/env";

// Load environment variables
dotenv.config();

async function main() {
  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║           Recipe Embeddings Reindexing Tool              ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");
  console.log("");

  console.log("📊 Current Settings:");
  console.log(`   LLM Provider: ${ENV.LLM_PROVIDER}`);
  console.log(`   Dish Name Weight: ${ENV.DISHNAME_WEIGHT}x`);
  console.log(`   Category Weight: ${ENV.CATEGORY_WEIGHT}x`);
  console.log(`   Max Text Length: ${ENV.MAX_RECIPE_TEXT_LENGTH} chars`);
  console.log("");

  console.log("⚠️  WARNING: This will re-generate embeddings for ALL recipes!");
  console.log("   This operation:");
  console.log("   - May take several minutes");
  console.log("   - Uses embedding API quota");
  console.log("   - Cannot be undone");
  console.log("");

  // Ask for confirmation (in production, use a proper prompt library)
  const args = process.argv.slice(2);
  const skipConfirm = args.includes("--yes") || args.includes("-y");

  if (!skipConfirm) {
    console.log("   Run with --yes or -y to skip this confirmation");
    console.log("");
    console.log("❌ Aborted. Use --yes to confirm and proceed.");
    process.exit(0);
  }

  console.log("🚀 Starting reindex...");
  console.log("");

  try {
    // Initialize vector store
    await vectorStoreService.initialize();
    console.log("✅ Connected to MongoDB");
    console.log("");

    // Run reindex
    const result = await vectorStoreService.reindexAll();

    console.log("");
    console.log("╔═══════════════════════════════════════════════════════════╗");
    console.log("║                   REINDEX COMPLETE!                       ║");
    console.log("╚═══════════════════════════════════════════════════════════╝");
    console.log("");
    console.log(`📊 Results:`);
    console.log(`   Total recipes: ${result.total}`);
    console.log(`   ✅ Success: ${result.success}`);
    console.log(`   ❌ Failed: ${result.failed}`);
    console.log("");

    if (result.failed > 0) {
      console.log("⚠️  Some recipes failed to reindex. Check logs for details.");
      process.exit(1);
    } else {
      console.log("🎉 All recipes reindexed successfully!");
      process.exit(0);
    }
  } catch (error: any) {
    console.error("");
    console.error("❌ Reindex failed:");
    console.error(`   ${error.message}`);
    console.error("");
    console.error("Stack trace:", error.stack);
    process.exit(1);
  } finally {
    // Close connection
    await vectorStoreService.close();
  }
}

// Run main function
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

