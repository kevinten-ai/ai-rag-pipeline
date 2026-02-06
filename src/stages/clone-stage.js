/**
 * Clone Stage - 文档采集阶段
 * 负责从飞书获取文档并进行增量检测
 */

const FeishuClient = require('../services/feishu-client');
const FeishuDocumentProcessor = require('../services/feishu-processor');
const MongoDBCache = require('../services/mongodb-cache');
const { getLogger } = require('../services/logger');

class CloneStage {
  constructor(config) {
    this.config = config;
    this.logger = getLogger(config).child({ stage: 'clone' });
    this.feishuClient = null;
    this.documentProcessor = null;
    this.cache = null;
    this.stats = {
      totalDocuments: 0,
      newDocuments: 0,
      updatedDocuments: 0,
      cachedDocuments: 0,
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
      this.feishuClient = new FeishuClient(this.config);
      this.documentProcessor = new FeishuDocumentProcessor(this.config);
      this.cache = new MongoDBCache(this.config);

      await this.cache.connect();

      this.logger.info('Clone stage initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize clone stage', { error: error.message });
      throw error;
    }
  }

  /**
   * 执行文档采集
   */
  async execute(options = {}) {
    const startTime = Date.now();

    try {
      this.logger.logPipelineStart('Clone Stage', options);

      const {
        folderTokens = [],
        forceFullUpdate = false,
        batchSize = this.config.performance?.batchSize || 10
      } = options;

      if (!folderTokens || folderTokens.length === 0) {
        throw new Error('No folder tokens provided for document collection');
      }

      // 重置统计信息
      this.resetStats();

      // 从多个文件夹采集文档
      const allDocuments = [];
      for (const folderToken of folderTokens) {
        try {
          const documents = await this.feishuClient.getAllDocumentsRecursively(folderToken);
          allDocuments.push(...documents);
          this.logger.info(`Collected ${documents.length} documents from folder ${folderToken}`);
        } catch (error) {
          this.logger.error(`Failed to collect documents from folder ${folderToken}`, {
            error: error.message
          });
          // 继续处理其他文件夹
        }
      }

      this.stats.totalDocuments = allDocuments.length;
      this.logger.info(`Total documents collected: ${allDocuments.length}`);

      if (allDocuments.length === 0) {
        this.logger.warn('No documents found to process');
        return this.getResults(startTime);
      }

      // 增量检测和内容获取
      const documentsToProcess = await this.processDocumentsIncremental(
        allDocuments,
        forceFullUpdate,
        batchSize
      );

      // 获取文档内容
      await this.fetchDocumentContents(documentsToProcess, batchSize);

      const duration = Date.now() - startTime;
      this.logger.logPipelineComplete('Clone Stage', {
        duration,
        ...this.stats
      });

      return this.getResults(startTime);
    } catch (error) {
      this.logger.logPipelineError('Clone Stage', error);
      throw error;
    }
  }

  /**
   * 增量处理文档
   */
  async processDocumentsIncremental(documents, forceFullUpdate, batchSize) {
    const documentsToProcess = [];
    const batches = this.chunkArray(documents, batchSize);

    for (const batch of batches) {
      const batchPromises = batch.map(async (document) => {
        try {
          const documentId = document.id;

          // 检查是否已缓存
          const cached = await this.cache.getCachedDocument(documentId);
          const isCached = !!cached;

          if (!forceFullUpdate && isCached) {
            // 检查是否需要更新（基于修改时间）
            const isModified = this.isDocumentModified(document, cached);
            if (!isModified) {
              this.stats.cachedDocuments++;
              this.logger.debug(`Document ${documentId} is up to date, skipping`);
              return null; // 不需要处理
            } else {
              this.stats.updatedDocuments++;
              this.logger.debug(`Document ${documentId} has been modified, will update`);
            }
          } else {
            if (isCached) {
              this.stats.updatedDocuments++;
            } else {
              this.stats.newDocuments++;
            }
          }

          return document;
        } catch (error) {
          this.logger.warn(`Failed to check document ${document.id}`, {
            error: error.message
          });
          this.stats.failedDocuments++;
          return document; // 出错时仍尝试处理
        }
      });

      const batchResults = await Promise.all(batchPromises);
      const validDocuments = batchResults.filter(doc => doc !== null);
      documentsToProcess.push(...validDocuments);

      // 批次间短暂延迟，避免数据库压力过大
      await this.sleep(50);
    }

    this.logger.info(`Incremental check completed: ${documentsToProcess.length} documents to process`);
    return documentsToProcess;
  }

  /**
   * 检查文档是否被修改
   */
  isDocumentModified(document, cached) {
    try {
      const docModified = new Date(document.modified_time || document.updatedAt);
      const cachedModified = new Date(cached.lastModified || cached.updatedAt);

      // 如果文档修改时间晚于缓存时间，则认为已修改
      return docModified > cachedModified;
    } catch (error) {
      this.logger.warn('Failed to compare modification times, assuming modified', {
        error: error.message,
        documentId: document.id
      });
      return true; // 出错时假设已修改
    }
  }

  /**
   * 获取文档内容
   */
  async fetchDocumentContents(documents, batchSize) {
    if (documents.length === 0) {
      return;
    }

    this.logger.info(`Fetching content for ${documents.length} documents`);

    // 批量获取文档内容
    const contentPromises = documents.map(doc =>
      this.feishuClient.getDocumentContent(doc.id, doc.type)
    );

    // 分批处理以控制并发
    const batches = this.chunkArray(contentPromises, batchSize);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      this.logger.debug(`Processing content batch ${i + 1}/${batches.length}`);

      try {
        const contents = await Promise.allSettled(batch);

        // 处理结果
        contents.forEach((result, index) => {
          const document = documents[i * batchSize + index];
          const documentId = document.id;

          if (result.status === 'fulfilled') {
            try {
              // 处理文档内容
              const processed = this.documentProcessor.processDocumentSync(document, result.value);

              this.stats.processedDocuments.push({
                document: processed,
                content: result.value,
                success: true
              });

              this.logger.debug(`Successfully processed document ${documentId}`);
            } catch (processError) {
              this.logger.warn(`Failed to process document ${documentId}`, {
                error: processError.message
              });

              this.stats.processedDocuments.push({
                document,
                content: result.value,
                success: false,
                error: processError.message
              });

              this.stats.failedDocuments++;
            }
          } else {
            this.logger.warn(`Failed to fetch content for document ${documentId}`, {
              error: result.reason?.message || result.reason
            });

            this.stats.processedDocuments.push({
              document,
              success: false,
              error: result.reason?.message || result.reason
            });

            this.stats.failedDocuments++;
          }
        });
      } catch (batchError) {
        this.logger.error(`Batch content fetching failed`, {
          error: batchError.message,
          batchIndex: i
        });
      }

      // 批次间延迟
      await this.sleep(100);
    }

    const successCount = this.stats.processedDocuments.filter(p => p.success).length;
    this.logger.info(`Content fetching completed: ${successCount}/${documents.length} successful`);
  }

  /**
   * 同步文档处理（用于单线程处理）
   */
  processDocumentSync(document, content) {
    return this.documentProcessor.processDocument(document, content);
  }

  /**
   * 获取执行结果
   */
  getResults(startTime) {
    const duration = Date.now() - startTime;
    const successCount = this.stats.processedDocuments.filter(p => p.success).length;

    return {
      stage: 'clone',
      success: true,
      duration,
      stats: {
        ...this.stats,
        successCount,
        cacheHitRate: this.stats.totalDocuments > 0 ?
          (this.stats.cachedDocuments / this.stats.totalDocuments) : 0
      },
      documents: this.stats.processedDocuments
        .filter(p => p.success)
        .map(p => p.document),
      errors: this.stats.processedDocuments
        .filter(p => !p.success)
        .map(p => ({
          documentId: p.document.id,
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
      newDocuments: 0,
      updatedDocuments: 0,
      cachedDocuments: 0,
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
      this.logger.info('Clone stage cleanup completed');
    } catch (error) {
      this.logger.error('Error during clone stage cleanup', { error: error.message });
    }
  }
}

module.exports = CloneStage;



