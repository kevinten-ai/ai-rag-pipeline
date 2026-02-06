/**
 * RAG Pipeline Configuration Example
 * Copy this file to config.js and fill in your actual values
 */

module.exports = {
  // 飞书API配置
  feishu: {
    appId: 'your_feishu_app_id',
    appSecret: 'your_feishu_app_secret',
    baseUrl: 'https://open.feishu.cn'
  },

  // OpenAI配置
  openai: {
    apiKey: 'your_openai_api_key',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4',
    embeddingModel: 'text-embedding-ada-002'
  },

  // Elasticsearch配置
  elasticsearch: {
    host: 'https://your-elasticsearch-host:9200',
    username: 'your_username',
    password: 'your_password',
    indexName: 'rag-knowledge-base'
  },

  // MongoDB配置
  mongodb: {
    uri: 'mongodb://localhost:27017',
    dbName: 'rag_pipeline',
    cacheCollection: 'file_cache'
  },

  // 文档配置
  docs: {
    name: 'feishu-docs',
    enableIncremental: true,
    forceFullUpdate: false
  },

  // 日志配置
  logging: {
    level: 'info',
    file: 'logs/pipeline.log'
  },

  // 性能配置
  performance: {
    maxConcurrentAiRequests: 5,
    documentSplitSize: 7000,
    batchSize: 10
  }
};



