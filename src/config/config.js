/**
 * RAG Pipeline Configuration
 * This file should be modified with actual configuration values
 */

const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

module.exports = {
  // 飞书API配置
  feishu: {
    appId: process.env.FEISHU_APP_ID,
    appSecret: process.env.FEISHU_APP_SECRET,
    baseUrl: process.env.FEISHU_BASE_URL || 'https://open.feishu.cn'
  },

  // OpenAI配置
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.OPENAI_MODEL || 'gpt-4',
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-ada-002'
  },

  // Elasticsearch配置
  elasticsearch: {
    host: process.env.ES_HOST,
    username: process.env.ES_USERNAME,
    password: process.env.ES_PASSWORD,
    indexName: process.env.ES_INDEX_NAME || 'rag-knowledge-base'
  },

  // MongoDB配置
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    dbName: process.env.MONGODB_DB_NAME || 'rag_pipeline',
    cacheCollection: process.env.MONGODB_CACHE_COLLECTION || 'file_cache'
  },

  // 文档配置
  docs: {
    name: process.env.DOCS_NAME || 'feishu-docs',
    enableIncremental: process.env.ENABLE_INCREMENTAL !== 'false',
    forceFullUpdate: process.env.FORCE_FULL_UPDATE === 'true'
  },

  // 日志配置
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/pipeline.log'
  },

  // 性能配置
  performance: {
    maxConcurrentAiRequests: parseInt(process.env.MAX_CONCURRENT_AI_REQUESTS) || 5,
    documentSplitSize: parseInt(process.env.DOCUMENT_SPLIT_SIZE) || 7000,
    batchSize: parseInt(process.env.BATCH_SIZE) || 10
  },

  // 验证配置完整性
  validate() {
    const ConfigValidator = require('./validator');
    const validator = new ConfigValidator(this);
    return validator.validate();
  }
};
