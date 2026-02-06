/**
 * Upload Stage - 索引构建阶段
 * 负责向量嵌入生成和Elasticsearch索引构建
 */

const OpenAIService = require('../services/openai-service');
const ElasticsearchClient = require('../services/elasticsearch-client');
const MongoDBCache = require('../services/mongodb-cache');
const { getLogger } = require('../services/logger');

class UploadStage {
  constructor(config) {
    this.config = config;
    this.logger = getLogger(config).child({ stage: 'upload' });
    this.openaiService = null;
    this.elasticsearchClient = null;
    this.cache = null;
    this.stats = {
      totalDocuments: 0,
      embeddedDocuments: 0,
      indexedDocuments: 0,
      cachedEmbeddings: 0,
      failedDocuments: 0,
      processedDocuments: []
    };
  }

  /**
   * 初始化阶段
   */
  async initialize() {
    try {
      // 初始化服务
      this.openaiService = new OpenAIService(this.config);
      await this.openaiService.initialize();

      this.elasticsearchClient = new ElasticsearchClient(this.config);
      await this.elasticsearchClient.initialize();

      this.cache = new MongoDBCache(this.config);
      await this.cache.connect();

      this.logger.info('Upload stage initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize upload stage', { error: error.message });
      throw error;
    }
  }

  /**
   * 执行索引构建
   */
  async execute(options = {}) {
    const startTime = Date.now();

    try {
      this.logger.logPipelineStart('Upload Stage', options);

      const {
        documents = [],
        forceReindex = false,
        batchSize = this.config.performance?.batchSize || 10,
        maxConcurrentEmbeddings = this.config.performance?.maxConcurrentAiRequests || 5
      } = options;

      if (!documents || documents.length === 0) {
        this.logger.warn('No documents provided for indexing');
        return this.getResults(startTime);
      }

      // 重置统计信息
      this.resetStats();
      this.stats.totalDocuments = documents.length;

      this.logger.info(`Starting to index ${documents.length} documents`);

      // 生成向量嵌入
      const documentsWithEmbeddings = await this.generateEmbeddings(
        documents,
        forceReindex,
        batchSize,
        maxConcurrentEmbeddings
      );

      // 构建Elasticsearch索引
      await this.buildElasticsearchIndex(documentsWithEmbeddings, batchSize);

      // 更新缓存
      await this.updateCache(documentsWithEmbeddings, batchSize);

      const duration = Date.now() - startTime;
      this.logger.logPipelineComplete('Upload Stage', {
        duration,
        ...this.stats
      });

      return this.getResults(startTime);
    } catch (error) {
      this.logger.logPipelineError('Upload Stage', error);
      throw error;
    }
  }

  /**
   * 生成向量嵌入
   */
  async generateEmbeddings(documents, forceReindex, batchSize, maxConcurrent) {
    const documentsWithEmbeddings = [];
    const textsToEmbed = [];

    // 首先检查哪些文档已有缓存的嵌入
    for (const document of documents) {
      if (!forceReindex) {
        const cached = await this.cache.getCachedDocument(document.id);
        if (cached && cached.embedding && cached.embedding.length > 0) {
          this.stats.cachedEmbeddings++;
          documentsWithEmbeddings.push({
            ...document,
            embedding: cached.embedding,
            cached: true
          });
          continue;
        }
      }

      textsToEmbed.push(document);
    }

    this.logger.info(`Need to generate embeddings for ${textsToEmbed.length} documents, ${this.stats.cachedEmbeddings} cached`);

    if (textsToEmbed.length === 0) {
      return documentsWithEmbeddings;
    }

    // 批量生成嵌入
    const texts = textsToEmbed.map(doc => doc.content);
    const embeddingResults = await this.openaiService.batchGenerateEmbeddings(
      texts,
      maxConcurrent
    );

    // 合并结果
    embeddingResults.forEach((result, index) => {
      const document = textsToEmbed[index];

      if (result.success && result.embedding) {
        documentsWithEmbeddings.push({
          ...document,
          embedding: result.embedding,
          cached: false
        });
        this.stats.embeddedDocuments++;
      } else {
        this.logger.warn(`Failed to generate embedding for document ${document.id}`, {
          error: result.error
        });

        // 使用零向量作为降级方案
        documentsWithEmbeddings.push({
          ...document,
          embedding: new Array(1536).fill(0), // text-embedding-ada-002 的维度
          cached: false,
          embeddingError: result.error
        });

        this.stats.failedDocuments++;
      }
    });

    this.logger.info(`Embedding generation completed: ${this.stats.embeddedDocuments} generated, ${this.stats.failedDocuments} failed`);
    return documentsWithEmbeddings;
  }

  /**
   * 构建Elasticsearch索引
   */
  async buildElasticsearchIndex(documents, batchSize) {
    if (documents.length === 0) {
      return;
    }

    this.logger.info(`Starting Elasticsearch indexing for ${documents.length} documents`);

    // 批量索引
    const batches = this.chunkArray(documents, batchSize);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      this.logger.debug(`Indexing batch ${i + 1}/${batches.length} (${batch.length} documents)`);

      try {
        const indexResults = await this.elasticsearchClient.bulkIndexDocuments(batch);

        this.stats.indexedDocuments += indexResults.success;

        if (indexResults.failed > 0) {
          this.logger.warn(`Batch indexing completed with ${indexResults.failed} failures`, {
            batchIndex: i,
            success: indexResults.success,
            failed: indexResults.failed
          });

          // 记录失败的文档
          indexResults.errors.forEach(error => {
            this.logger.error('Document indexing failed', {
              documentId: error.index._id,
              error: error.index.error
            });
          });
        } else {
          this.logger.debug(`Batch ${i + 1} indexed successfully: ${indexResults.success} documents`);
        }
      } catch (error) {
        this.logger.error(`Batch indexing failed`, {
          error: error.message,
          batchIndex: i,
          batchSize: batch.length
        });

        // 继续处理下一批，不中断整个流程
        this.stats.failedDocuments += batch.length;
      }

      // 批次间短暂延迟
      await this.sleep(100);
    }

    this.logger.info(`Elasticsearch indexing completed: ${this.stats.indexedDocuments}/${documents.length} documents indexed`);
  }

  /**
   * 更新缓存
   */
  async updateCache(documents, batchSize) {
    const documentsToCache = documents.filter(doc => !doc.cached && !doc.embeddingError);

    if (documentsToCache.length === 0) {
      return;
    }

    this.logger.info(`Updating cache for ${documentsToCache.length} documents`);

    // 批量缓存
    const batches = this.chunkArray(documentsToCache, batchSize);

    for (const batch of batches) {
      try {
        const cacheOperations = batch.map(document => ({
          document,
          processedContent: {
            title: document.ai_title || document.title,
            content: document.content,
            summary: document.summary,
            keywords: document.keywords,
            category: document.category
          },
          aiResults: {
            ai_title: document.ai_title,
            summary: document.summary,
            keywords: document.keywords,
            category: document.category,
            processed_at: new Date().toISOString()
          }
        }));

        await this.cache.batchCacheDocuments(cacheOperations);
        this.logger.debug(`Cached ${batch.length} documents`);
      } catch (error) {
        this.logger.error('Failed to batch cache documents', {
          error: error.message,
          batchSize: batch.length
        });
      }

      // 批次间延迟
      await this.sleep(50);
    }

    this.logger.info(`Cache update completed for ${documentsToCache.length} documents`);
  }

  /**
   * 验证索引完整性
   */
  async validateIndexIntegrity(documents) {
    try {
      this.logger.info('Starting index integrity validation');

      const indexStats = await this.elasticsearchClient.getIndexStats();
      const expectedCount = documents.length;
      const actualCount = indexStats.documentCount;

      if (Math.abs(actualCount - expectedCount) > expectedCount * 0.1) {
        this.logger.warn('Index integrity check failed', {
          expected: expectedCount,
          actual: actualCount,
          difference: Math.abs(actualCount - expectedCount)
        });
        return false;
      }

      this.logger.info('Index integrity validation passed', {
        documentCount: actualCount,
        size: indexStats.sizeHuman
      });
      return true;
    } catch (error) {
      this.logger.error('Index integrity validation failed', { error: error.message });
      return false;
    }
  }

  /**
   * 获取执行结果
   */
  getResults(startTime) {
    const duration = Date.now() - startTime;

    return {
      stage: 'upload',
      success: true,
      duration,
      stats: {
        ...this.stats,
        embeddingGenerationRate: this.stats.totalDocuments > 0 ?
          (this.stats.embeddedDocuments / this.stats.totalDocuments) : 0,
        indexingSuccessRate: this.stats.totalDocuments > 0 ?
          (this.stats.indexedDocuments / this.stats.totalDocuments) : 0,
        cacheHitRate: this.stats.totalDocuments > 0 ?
          (this.stats.cachedEmbeddings / this.stats.totalDocuments) : 0
      },
      indexStats: null, // 可以后续添加索引统计信息
      errors: this.stats.processedDocuments
        .filter(p => p.error)
        .map(p => ({
          documentId: p.documentId,
          error: p.error
        }))
    };
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      totalDocuments: 0,
      embeddedDocuments: 0,
      indexedDocuments: 0,
      cachedEmbeddings: 0,
      failedDocuments: 0,
      processedDocuments: []
    };
  }

  /**
   * 工具方法：数组分块
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * 工具方法：延迟执行
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 清理资源
   */
  async cleanup() {
    try {
      if (this.cache) {
        await this.cache.disconnect();
      }
      this.logger.info('Upload stage cleanup completed');
    } catch (error) {
      this.logger.error('Error during upload stage cleanup', { error: error.message });
    }
  }
}

module.exports = UploadStage;



