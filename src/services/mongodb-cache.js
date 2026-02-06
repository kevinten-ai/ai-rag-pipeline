/**
 * MongoDB Cache Service
 * MongoDB缓存服务
 */

const { MongoClient } = require('mongodb');
const crypto = require('crypto');
const { getLogger } = require('./logger');

class MongoDBCache {
  constructor(config) {
    this.config = config.mongodb;
    this.logger = getLogger(config).child({ service: 'mongodb-cache' });
    this.client = null;
    this.db = null;
    this.isConnected = false;
  }

  /**
   * 连接到MongoDB
   */
  async connect() {
    try {
      if (this.isConnected) {
        return;
      }

      this.logger.info('Connecting to MongoDB', { uri: this.maskUri(this.config.uri) });

      this.client = new MongoClient(this.config.uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      await this.client.connect();
      this.db = this.client.db(this.config.dbName);
      this.isConnected = true;

      // 创建索引
      await this.createIndexes();

      this.logger.info('✅ Successfully connected to MongoDB');
    } catch (error) {
      this.logger.error('❌ Failed to connect to MongoDB', { error: error.message });
      throw error;
    }
  }

  /**
   * 断开连接
   */
  async disconnect() {
    try {
      if (this.client) {
        await this.client.close();
        this.isConnected = false;
        this.logger.info('Disconnected from MongoDB');
      }
    } catch (error) {
      this.logger.error('Error disconnecting from MongoDB', { error: error.message });
    }
  }

  /**
   * 创建必要的索引
   */
  async createIndexes() {
    try {
      const collection = this.db.collection(this.config.cacheCollection);

      // 为常用查询字段创建索引
      await collection.createIndex({ documentId: 1 }, { unique: true });
      await collection.createIndex({ hash: 1 });
      await collection.createIndex({ lastModified: 1 });
      await collection.createIndex({ type: 1 });
      await collection.createIndex({ createdAt: 1 });
      await collection.createIndex({ updatedAt: 1 });

      this.logger.info('Created database indexes');
    } catch (error) {
      this.logger.error('Failed to create indexes', { error: error.message });
    }
  }

  /**
   * 计算文件内容的哈希值
   */
  calculateHash(content) {
    return crypto.createHash('md5').update(JSON.stringify(content)).digest('hex');
  }

  /**
   * 检查文档是否已缓存
   */
  async isDocumentCached(documentId, content) {
    try {
      await this.ensureConnection();

      const hash = this.calculateHash(content);
      const cached = await this.db.collection(this.config.cacheCollection)
        .findOne({ documentId, hash });

      return !!cached;
    } catch (error) {
      this.logger.error('Failed to check document cache', {
        error: error.message,
        documentId
      });
      return false;
    }
  }

  /**
   * 获取缓存的文档
   */
  async getCachedDocument(documentId) {
    try {
      await this.ensureConnection();

      const cached = await this.db.collection(this.config.cacheCollection)
        .findOne({ documentId });

      return cached;
    } catch (error) {
      this.logger.error('Failed to get cached document', {
        error: error.message,
        documentId
      });
      return null;
    }
  }

  /**
   * 缓存文档
   */
  async cacheDocument(document, processedContent, aiResults = {}) {
    try {
      await this.ensureConnection();

      const hash = this.calculateHash(document);
      const now = new Date();

      const cacheEntry = {
        documentId: document.id,
        hash,
        type: document.type || 'doc',
        originalDocument: document,
        processedContent,
        aiResults,
        metadata: {
          title: document.name || document.title,
          source: document.source || 'feishu',
          created_time: document.created_time,
          modified_time: document.modified_time,
          owner_id: document.owner_id
        },
        createdAt: now,
        updatedAt: now,
        lastModified: document.modified_time || now
      };

      await this.db.collection(this.config.cacheCollection)
        .replaceOne(
          { documentId: document.id },
          cacheEntry,
          { upsert: true }
        );

      this.logger.debug(`Cached document ${document.id}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to cache document', {
        error: error.message,
        documentId: document.id
      });
      throw error;
    }
  }

  /**
   * 更新文档的AI处理结果
   */
  async updateAIResults(documentId, aiResults) {
    try {
      await this.ensureConnection();

      await this.db.collection(this.config.cacheCollection)
        .updateOne(
          { documentId },
          {
            $set: {
              aiResults,
              updatedAt: new Date()
            }
          }
        );

      this.logger.debug(`Updated AI results for document ${documentId}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to update AI results', {
        error: error.message,
        documentId
      });
      throw error;
    }
  }

  /**
   * 获取所有缓存的文档
   */
  async getAllCachedDocuments() {
    try {
      await this.ensureConnection();

      const documents = await this.db.collection(this.config.cacheCollection)
        .find({})
        .sort({ updatedAt: -1 })
        .toArray();

      this.logger.info(`Retrieved ${documents.length} cached documents`);
      return documents;
    } catch (error) {
      this.logger.error('Failed to get all cached documents', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 获取缓存统计信息
   */
  async getCacheStats() {
    try {
      await this.ensureConnection();

      const collection = this.db.collection(this.config.cacheCollection);

      const stats = await collection.aggregate([
        {
          $group: {
            _id: null,
            totalDocuments: { $sum: 1 },
            byType: {
              $push: {
                type: '$type',
                documentId: '$documentId',
                updatedAt: '$updatedAt'
              }
            },
            lastUpdated: { $max: '$updatedAt' }
          }
        }
      ]).toArray();

      if (stats.length === 0) {
        return {
          totalDocuments: 0,
          byType: {},
          lastUpdated: null
        };
      }

      const result = stats[0];

      // 按类型统计
      const byType = {};
      result.byType.forEach(item => {
        if (!byType[item.type]) {
          byType[item.type] = 0;
        }
        byType[item.type]++;
      });

      return {
        totalDocuments: result.totalDocuments,
        byType,
        lastUpdated: result.lastUpdated
      };
    } catch (error) {
      this.logger.error('Failed to get cache stats', { error: error.message });
      throw error;
    }
  }

  /**
   * 清理过期缓存
   */
  async cleanupExpiredCache(maxAge = 30 * 24 * 60 * 60 * 1000) { // 默认30天
    try {
      await this.ensureConnection();

      const cutoffDate = new Date(Date.now() - maxAge);
      const result = await this.db.collection(this.config.cacheCollection)
        .deleteMany({
          updatedAt: { $lt: cutoffDate }
        });

      this.logger.info(`Cleaned up ${result.deletedCount} expired cache entries`);
      return result.deletedCount;
    } catch (error) {
      this.logger.error('Failed to cleanup expired cache', { error: error.message });
      throw error;
    }
  }

  /**
   * 删除文档缓存
   */
  async removeDocumentCache(documentId) {
    try {
      await this.ensureConnection();

      const result = await this.db.collection(this.config.cacheCollection)
        .deleteOne({ documentId });

      if (result.deletedCount > 0) {
        this.logger.info(`Removed cache for document ${documentId}`);
      }

      return result.deletedCount > 0;
    } catch (error) {
      this.logger.error('Failed to remove document cache', {
        error: error.message,
        documentId
      });
      throw error;
    }
  }

  /**
   * 清空所有缓存
   */
  async clearAllCache() {
    try {
      await this.ensureConnection();

      const result = await this.db.collection(this.config.cacheCollection)
        .deleteMany({});

      this.logger.info(`Cleared all cache: ${result.deletedCount} entries removed`);
      return result.deletedCount;
    } catch (error) {
      this.logger.error('Failed to clear all cache', { error: error.message });
      throw error;
    }
  }

  /**
   * 批量缓存文档
   */
  async batchCacheDocuments(documentBatch) {
    try {
      await this.ensureConnection();

      const operations = documentBatch.map(({ document, processedContent, aiResults }) => {
        const hash = this.calculateHash(document);
        const now = new Date();

        return {
          replaceOne: {
            filter: { documentId: document.id },
            replacement: {
              documentId: document.id,
              hash,
              type: document.type || 'doc',
              originalDocument: document,
              processedContent,
              aiResults,
              metadata: {
                title: document.name || document.title,
                source: document.source || 'feishu',
                created_time: document.created_time,
                modified_time: document.modified_time,
                owner_id: document.owner_id
              },
              createdAt: now,
              updatedAt: now,
              lastModified: document.modified_time || now
            },
            upsert: true
          }
        };
      });

      const result = await this.db.collection(this.config.cacheCollection)
        .bulkWrite(operations);

      this.logger.info(`Batch cached ${documentBatch.length} documents`, {
        inserted: result.insertedCount,
        modified: result.modifiedCount,
        upserted: result.upsertedCount
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to batch cache documents', {
        error: error.message,
        batchSize: documentBatch.length
      });
      throw error;
    }
  }

  /**
   * 确保连接可用
   */
  async ensureConnection() {
    if (!this.isConnected) {
      await this.connect();
    }
  }

  /**
   * 屏蔽URI中的敏感信息
   */
  maskUri(uri) {
    return uri.replace(/:\/\/([^:]+):([^@]+)@/, '://***:***@');
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      await this.ensureConnection();
      await this.db.admin().ping();
      return { status: 'healthy', latency: 0 };
    } catch (error) {
      this.logger.error('MongoDB health check failed', { error: error.message });
      return { status: 'unhealthy', error: error.message };
    }
  }
}

module.exports = MongoDBCache;



