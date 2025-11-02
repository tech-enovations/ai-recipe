# AI Recipe - Documentation

Complete documentation for the AI Recipe Generator project.

## 📚 Table of Contents

### Getting Started

- [README.md](../README.md) - Main project README
- [README_DEPLOYMENT.md](README_DEPLOYMENT.md) - Deployment guide for Vercel

### Development

- [NODEMON_SETUP.md](NODEMON_SETUP.md) - Hot reload configuration with nodemon
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues and solutions
- [ENV_CONFIG.md](ENV_CONFIG.md) - Environment variable configuration

### Features

- [DEMO_LOADING_FEATURES.md](DEMO_LOADING_FEATURES.md) - SSE streaming demo with loading states
- [PROVIDER_STRATEGY.md](PROVIDER_STRATEGY.md) - Dual LLM provider support (Gemini + OpenAI)

### Vector Search & RAG

- [RAG_BOOSTING.md](RAG_BOOSTING.md) - RAG keyword boosting and search optimization
- [EMBEDDING_WEIGHTS.md](EMBEDDING_WEIGHTS.md) - Dish name & category weight optimization
- [EMBEDDING_OPTIMIZATION.md](EMBEDDING_OPTIMIZATION.md) - Embedding size and cost optimization

### Migration & Fixes

- [MIGRATION_COMPLETE.md](MIGRATION_COMPLETE.md) - Serverless architecture migration
- [GEMINI_ERROR_FIX.md](GEMINI_ERROR_FIX.md) - Gemini API error fixes
- [FIXES_SUMMARY.md](FIXES_SUMMARY.md) - Summary of all fixes applied

## 🔍 Quick Links by Topic

### LLM Configuration

- [Provider Strategy](PROVIDER_STRATEGY.md) - Switch between Gemini and OpenAI
- [Environment Config](ENV_CONFIG.md) - All environment variables explained

### Vector Search

- [Embedding Weights](EMBEDDING_WEIGHTS.md) - Optimize search by weighting dish names
- [Embedding Optimization](EMBEDDING_OPTIMIZATION.md) - Reduce costs by 80%
- [RAG Boosting](RAG_BOOSTING.md) - Improve search relevance

### Development Workflow

- [Nodemon Setup](NODEMON_SETUP.md) - Hot reload for faster development
- [Troubleshooting](TROUBLESHOOTING.md) - Fix common dev issues

### Deployment

- [Deployment Guide](README_DEPLOYMENT.md) - Deploy to Vercel
- [Migration Guide](MIGRATION_COMPLETE.md) - Serverless architecture

## 🎯 By Use Case

### "I want to improve search quality"
1. Read [EMBEDDING_WEIGHTS.md](EMBEDDING_WEIGHTS.md)
2. Adjust `DISHNAME_WEIGHT` and `CATEGORY_WEIGHT`
3. Run reindex script (see [scripts/README.md](../scripts/README.md))

### "I'm getting embedding quota errors"
1. Read [EMBEDDING_OPTIMIZATION.md](EMBEDDING_OPTIMIZATION.md)
2. Switch to Gemini (free) or reduce dimensions
3. See [PROVIDER_STRATEGY.md](PROVIDER_STRATEGY.md)

### "Server won't start / No logs showing"
1. Read [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
2. Check for multiple instances
3. Use `./dev.sh` script

### "I want to deploy to production"
1. Read [README_DEPLOYMENT.md](README_DEPLOYMENT.md)
2. Configure environment variables
3. Deploy to Vercel

### "I want to switch from Gemini to OpenAI"
1. Read [PROVIDER_STRATEGY.md](PROVIDER_STRATEGY.md)
2. Update `.env`: `LLM_PROVIDER=openai`
3. Update MongoDB index dimensions
4. Reindex embeddings

## 📊 Architecture Documents

- **Serverless**: [MIGRATION_COMPLETE.md](MIGRATION_COMPLETE.md)
- **Dual Providers**: [PROVIDER_STRATEGY.md](PROVIDER_STRATEGY.md)
- **Vector Search**: [RAG_BOOSTING.md](RAG_BOOSTING.md)

## 🔧 Technical Details

### Embedding Dimensions

| Provider | Default | Optimized | Doc |
|----------|---------|-----------|-----|
| Gemini | 768 | 768 | [Config](ENV_CONFIG.md) |
| OpenAI | 1536 | 512 | [Optimization](EMBEDDING_OPTIMIZATION.md) |

### Weight Settings

| Field | Default | Range | Doc |
|-------|---------|-------|-----|
| DISHNAME_WEIGHT | 3x | 2-5 | [Weights](EMBEDDING_WEIGHTS.md) |
| CATEGORY_WEIGHT | 2x | 1-3 | [Weights](EMBEDDING_WEIGHTS.md) |

## 🆘 Need Help?

1. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md) first
2. Review relevant topic documentation above
3. Check error logs with `grep "ERROR" logs/*.log`
4. See [scripts/README.md](../scripts/README.md) for maintenance tasks

## 📝 Contributing

When adding new documentation:
1. Place `.md` files in `/docs` directory
2. Update this README with links
3. Use clear section headers
4. Include code examples
5. Add troubleshooting sections

---

**Last Updated**: 2025-11-02

