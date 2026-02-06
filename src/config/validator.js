/**
 * Configuration Validator
 * 配置文件验证器
 */

class ConfigValidator {
  constructor(config) {
    this.config = config;
    this.errors = [];
  }

  /**
   * 验证配置完整性
   */
  validate() {
    this.errors = [];

    this.validateFeishuConfig();
    this.validateOpenAIConfig();
    this.validateElasticsearchConfig();
    this.validateMongoDBConfig();
    this.validatePerformanceConfig();

    if (this.errors.length > 0) {
      const errorMessage = 'Configuration validation failed:\n' +
        this.errors.map(error => `  - ${error}`).join('\n');
      throw new Error(errorMessage);
    }

    console.log('✅ Configuration validation passed');
    return true;
  }

  /**
   * 验证飞书配置
   */
  validateFeishuConfig() {
    const { feishu } = this.config;

    if (!feishu) {
      this.errors.push('Feishu configuration is missing');
      return;
    }

    if (!feishu.appId) {
      this.errors.push('FEISHU_APP_ID is required');
    }

    if (!feishu.appSecret) {
      this.errors.push('FEISHU_APP_SECRET is required');
    }

    if (!feishu.baseUrl) {
      this.errors.push('FEISHU_BASE_URL is required');
    } else if (!feishu.baseUrl.startsWith('http')) {
      this.errors.push('FEISHU_BASE_URL must be a valid URL');
    }
  }

  /**
   * 验证OpenAI配置
   */
  validateOpenAIConfig() {
    const { openai } = this.config;

    if (!openai) {
      this.errors.push('OpenAI configuration is missing');
      return;
    }

    if (!openai.apiKey) {
      this.errors.push('OPENAI_API_KEY is required');
    }

    if (!openai.baseUrl) {
      this.errors.push('OPENAI_BASE_URL is required');
    } else if (!openai.baseUrl.startsWith('http')) {
      this.errors.push('OPENAI_BASE_URL must be a valid URL');
    }

    if (!openai.model) {
      this.errors.push('OPENAI_MODEL is required');
    }

    if (!openai.embeddingModel) {
      this.errors.push('OPENAI_EMBEDDING_MODEL is required');
    }
  }

  /**
   * 验证Elasticsearch配置
   */
  validateElasticsearchConfig() {
    const { elasticsearch } = this.config;

    if (!elasticsearch) {
      this.errors.push('Elasticsearch configuration is missing');
      return;
    }

    if (!elasticsearch.host) {
      this.errors.push('ES_HOST is required');
    } else if (!elasticsearch.host.startsWith('http')) {
      this.errors.push('ES_HOST must be a valid URL');
    }

    if (!elasticsearch.username) {
      this.errors.push('ES_USERNAME is required');
    }

    if (!elasticsearch.password) {
      this.errors.push('ES_PASSWORD is required');
    }

    if (!elasticsearch.indexName) {
      this.errors.push('ES_INDEX_NAME is required');
    }
  }

  /**
   * 验证MongoDB配置
   */
  validateMongoDBConfig() {
    const { mongodb } = this.config;

    if (!mongodb) {
      this.errors.push('MongoDB configuration is missing');
      return;
    }

    if (!mongodb.uri) {
      this.errors.push('MONGODB_URI is required');
    } else if (!mongodb.uri.startsWith('mongodb')) {
      this.errors.push('MONGODB_URI must be a valid MongoDB URI');
    }

    if (!mongodb.dbName) {
      this.errors.push('MONGODB_DB_NAME is required');
    }

    if (!mongodb.cacheCollection) {
      this.errors.push('MONGODB_CACHE_COLLECTION is required');
    }
  }

  /**
   * 验证性能配置
   */
  validatePerformanceConfig() {
    const { performance } = this.config;

    if (!performance) {
      this.errors.push('Performance configuration is missing');
      return;
    }

    if (typeof performance.maxConcurrentAiRequests !== 'number' ||
        performance.maxConcurrentAiRequests < 1) {
      this.errors.push('MAX_CONCURRENT_AI_REQUESTS must be a positive number');
    }

    if (typeof performance.documentSplitSize !== 'number' ||
        performance.documentSplitSize < 1000) {
      this.errors.push('DOCUMENT_SPLIT_SIZE must be at least 1000');
    }

    if (typeof performance.batchSize !== 'number' ||
        performance.batchSize < 1) {
      this.errors.push('BATCH_SIZE must be a positive number');
    }
  }

  /**
   * 获取验证错误
   */
  getErrors() {
    return this.errors;
  }
}

module.exports = ConfigValidator;



