/**
 * Clean Stage - 内容处理阶段
 * 负责AI增强、智能拆分、内容优化
 */

const OpenAIService = require('../services/openai-service');
const MongoDBCache = require('../services/mongodb-cache');
const { getLogger } = require('../services/logger');

class CleanStage {
  constructor(config) {
    this.config = config;
    this.logger = getLogger(config).child({ stage: 'clean' });
    this.openaiService = null;
    this.cache = null;
    this.stats = {
      totalDocuments: 0,
      aiProcessedDocuments: 0,
      cachedDocuments: 0,
      splitDocuments: 0,
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

      this.cache = new MongoDBCache(this.config);
      await this.cache.connect();

      this.logger.info('Clean stage initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize clean stage', { error: error.message });
      throw error;
    }
  }

  /**
   * 执行内容处理
   */
  async execute(options = {}) {
    const startTime = Date.now();

    try {
      this.logger.logPipelineStart('Clean Stage', options);

      const {
        documents = [],
        forceReprocess = false,
        batchSize = this.config.performance?.batchSize || 10,
        maxConcurrentAiRequests = this.config.performance?.maxConcurrentAiRequests || 5
      } = options;

      if (!documents || documents.length === 0) {
        this.logger.warn('No documents provided for processing');
        return this.getResults(startTime);
      }

      // 重置统计信息
      this.resetStats();
      this.stats.totalDocuments = documents.length;

      this.logger.info(`Starting to process ${documents.length} documents`);

      // AI内容增强处理
      const aiProcessedDocuments = await this.processDocumentsWithAI(
        documents,
        forceReprocess,
        batchSize,
        maxConcurrentAiRequests
      );

      // 智能内容拆分
      const finalDocuments = await this.splitLargeDocuments(aiProcessedDocuments, batchSize);

      const duration = Date.now() - startTime;
      this.logger.logPipelineComplete('Clean Stage', {
        duration,
        ...this.stats
      });

      return this.getResults(startTime, finalDocuments);
    } catch (error) {
      this.logger.logPipelineError('Clean Stage', error);
      throw error;
    }
  }

  /**
   * AI内容增强处理
   */
  async processDocumentsWithAI(documents, forceReprocess, batchSize, maxConcurrent) {
    const processedDocuments = [];

    // 分批处理以控制并发
    const batches = this.chunkArray(documents, batchSize);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      this.logger.debug(`Processing AI batch ${i + 1}/${batches.length} (${batch.length} documents)`);

      // 并发处理批次内的文档，但限制总并发数
      const batchPromises = batch.map(async (document) => {
        try {
          const documentId = document.id;

          // 检查缓存
          if (!forceReprocess) {
            const cached = await this.cache.getCachedDocument(documentId);
            if (cached && cached.aiResults) {
              this.stats.cachedDocuments++;
              this.logger.debug(`Using cached AI results for document ${documentId}`);

              // 合并缓存的AI结果
              return {
                ...document,
                ...cached.aiResults,
                cached: true
              };
            }
          }

          // AI处理
          const aiResults = await this.openaiService.processDocumentAI(
            document.content,
            document.title
          );

          // 缓存AI结果
          await this.cache.updateAIResults(documentId, aiResults);

          this.stats.aiProcessedDocuments++;
          this.logger.debug(`AI processed document ${documentId}`);

          return {
            ...document,
            ...aiResults,
            cached: false
          };
        } catch (error) {
          this.logger.warn(`Failed to process document ${document.id} with AI`, {
            error: error.message
          });

          this.stats.failedDocuments++;

          // 返回基础版本的文档
          return {
            ...document,
            ai_title: document.title,
            summary: '',
            keywords: [],
            category: '其他',
            cached: false,
            error: error.message
          };
        }
      });

      // 控制并发：每次只处理 maxConcurrent 个文档
      const concurrentBatches = this.chunkArray(batchPromises, maxConcurrent);

      for (const concurrentBatch of concurrentBatches) {
        const results = await Promise.allSettled(concurrentBatch);

        results.forEach((result) => {
          if (result.status === 'fulfilled') {
            processedDocuments.push(result.value);
          } else {
            this.logger.error('AI processing promise failed', {
              error: result.reason?.message || result.reason
            });
            this.stats.failedDocuments++;
          }
        });

        // 批次间短暂延迟，避免API限流
        await this.sleep(100);
      }
    }

    this.logger.info(`AI processing completed: ${this.stats.aiProcessedDocuments} processed, ${this.stats.cachedDocuments} cached`);
    return processedDocuments;
  }

  /**
   * 智能内容拆分
   */
  async splitLargeDocuments(documents, batchSize) {
    const splitDocuments = [];
    const maxTokens = this.config.performance?.documentSplitSize || 7000;

    this.logger.info(`Starting content splitting for ${documents.length} documents`);

    // 分批处理
    const batches = this.chunkArray(documents, batchSize);

    for (const batch of batches) {
      const batchPromises = batch.map(async (document) => {
        try {
          const content = document.content || '';
          const chunks = await this.openaiService.splitContent(content, maxTokens);

          if (chunks.length > 1) {
            this.stats.splitDocuments++;
            this.logger.debug(`Split document ${document.id} into ${chunks.length} chunks`);

            // 为每个chunk创建文档副本
            const chunkDocuments = chunks.map((chunk, index) => ({
              ...document,
              id: `${document.id}_part${index + 1}`,
              content: chunk,
              is_split_part: `${index + 1}/${chunks.length}`,
              original_file: document.id,
              title: `${document.ai_title || document.title} (Part ${index + 1})`
            }));

            return chunkDocuments;
          } else {
            // 不需要拆分
            return [document];
          }
        } catch (error) {
          this.logger.warn(`Failed to split document ${document.id}`, {
            error: error.message
          });

          // 返回原文档
          return [document];
        }
      });

      const batchResults = await Promise.all(batchPromises);

      // 展平结果
      batchResults.forEach(docs => {
        splitDocuments.push(...docs);
      });
    }

    this.logger.info(`Content splitting completed: ${this.stats.splitDocuments} documents split, ${splitDocuments.length} total chunks`);
    return splitDocuments;
  }

  /**
   * 内容质量检查和清理
   */
  validateAndCleanDocuments(documents) {
    const cleaned = [];

    for (const document of documents) {
      try {
        const cleanedDoc = { ...document };

        // 清理标题
        if (!cleanedDoc.ai_title || cleanedDoc.ai_title.trim().length === 0) {
          cleanedDoc.ai_title = cleanedDoc.title || 'Untitled Document';
        }

        // 清理内容
        if (!cleanedDoc.content || cleanedDoc.content.trim().length === 0) {
          this.logger.warn(`Document ${document.id} has empty content, skipping`);
          continue;
        }

        // 清理关键词
        if (!Array.isArray(cleanedDoc.keywords)) {
          cleanedDoc.keywords = [];
        }

        // 清理元数据
        cleanedDoc.metadata = {
          ...cleanedDoc.metadata,
          wordCount: cleanedDoc.content.length,
          processedAt: new Date().toISOString()
        };

        cleaned.push(cleanedDoc);
      } catch (error) {
        this.logger.warn(`Failed to clean document ${document.id}`, {
          error: error.message
        });
        this.stats.failedDocuments++;
      }
    }

    this.logger.info(`Document cleaning completed: ${cleaned.length} valid documents`);
    return cleaned;
  }

  /**
   * 获取执行结果
   */
  getResults(startTime, documents) {
    const duration = Date.now() - startTime;
    const cleanedDocuments = this.validateAndCleanDocuments(documents);

    return {
      stage: 'clean',
      success: true,
      duration,
      stats: {
        ...this.stats,
        finalDocumentCount: cleanedDocuments.length,
        aiProcessingRate: this.stats.totalDocuments > 0 ?
          (this.stats.aiProcessedDocuments / this.stats.totalDocuments) : 0,
        cacheHitRate: this.stats.totalDocuments > 0 ?
          (this.stats.cachedDocuments / this.stats.totalDocuments) : 0
      },
      documents: cleanedDocuments,
      errors: documents
        .filter(doc => doc.error)
        .map(doc => ({
          documentId: doc.id,
          error: doc.error
        }))
    };
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      totalDocuments: 0,
      aiProcessedDocuments: 0,
      cachedDocuments: 0,
      splitDocuments: 0,
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
      this.logger.info('Clean stage cleanup completed');
    } catch (error) {
      this.logger.error('Error during clean stage cleanup', { error: error.message });
    }
  }
}

module.exports = CleanStage;



