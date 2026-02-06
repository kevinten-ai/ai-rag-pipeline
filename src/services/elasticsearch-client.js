/**
 * Elasticsearch Client
 * Elasticsearch客户端
 */

const { Client } = require('@elastic/elasticsearch');
const { getLogger } = require('./logger');

class ElasticsearchClient {
  constructor(config) {
    this.config = config.elasticsearch;
    this.logger = getLogger(config).child({ service: 'elasticsearch-client' });
    this.client = null;
    this.indexName = this.config.indexName;
    this.isConnected = false;
  }

  /**
   * 初始化Elasticsearch客户端
   */
  async initialize() {
    try {
      this.client = new Client({
        node: this.config.host,
        auth: {
          username: this.config.username,
          password: this.config.password
        },
        requestTimeout: 60000,
        pingTimeout: 3000,
        maxRetries: 5,
        sniffOnStart: true,
        sniffOnConnectionFault: true
      });

      // 测试连接
      await this.testConnection();

      // 确保索引存在
      await this.ensureIndex();

      this.logger.info('✅ Elasticsearch client initialized successfully');
    } catch (error) {
      this.logger.error('❌ Failed to initialize Elasticsearch client', { error: error.message });
      throw error;
    }
  }

  /**
   * 测试连接
   */
  async testConnection() {
    try {
      const response = await this.client.info();
      this.isConnected = true;
      this.logger.info('Elasticsearch connection test passed', {
        cluster_name: response.body.cluster_name,
        version: response.body.version.number
      });
      return true;
    } catch (error) {
      this.isConnected = false;
      this.logger.error('Elasticsearch connection test failed', { error: error.message });
      throw error;
    }
  }

  /**
   * 确保索引存在
   */
  async ensureIndex() {
    try {
      const exists = await this.client.indices.exists({ index: this.indexName });

      if (!exists.body) {
        await this.createIndex();
      } else {
        this.logger.info(`Index ${this.indexName} already exists`);
      }
    } catch (error) {
      this.logger.error('Failed to ensure index exists', { error: error.message });
      throw error;
    }
  }

  /**
   * 创建索引
   */
  async createIndex() {
    try {
      const indexMapping = {
        mappings: {
          properties: {
            documentId: { type: 'keyword' },
            title: { type: 'text', analyzer: 'ik_smart' },
            ai_title: { type: 'text', analyzer: 'ik_smart' },
            content: { type: 'text', analyzer: 'ik_smart' },
            summary: { type: 'text', analyzer: 'ik_smart' },
            keywords: { type: 'keyword' },
            category: { type: 'keyword' },
            source: { type: 'keyword' },
            type: { type: 'keyword' },
            embedding: {
              type: 'dense_vector',
              dims: 1536, // text-embedding-ada-002 的维度
              index: true,
              similarity: 'cosine'
            },
            metadata: {
              type: 'object',
              properties: {
                author: { type: 'keyword' },
                createdAt: { type: 'date' },
                updatedAt: { type: 'date' },
                wordCount: { type: 'integer' },
                tags: { type: 'keyword' }
              }
            },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' },
            processedAt: { type: 'date' }
          }
        },
        settings: {
          number_of_shards: 1,
          number_of_replicas: 0,
          analysis: {
            analyzer: {
              ik_smart: {
                type: 'ik_smart'
              }
            }
          }
        }
      };

      await this.client.indices.create({
        index: this.indexName,
        body: indexMapping
      });

      this.logger.info(`Created index ${this.indexName} with vector support`);
    } catch (error) {
      this.logger.error('Failed to create index', { error: error.message });
      throw error;
    }
  }

  /**
   * 索引文档
   */
  async indexDocument(document) {
    try {
      const doc = {
        documentId: document.id,
        title: document.title || '',
        ai_title: document.ai_title || '',
        content: document.content || '',
        summary: document.summary || '',
        keywords: document.keywords || [],
        category: document.category || '',
        source: document.source || 'feishu',
        type: document.type || 'doc',
        embedding: document.embedding || [],
        metadata: document.metadata || {},
        createdAt: document.created_time || new Date(),
        updatedAt: document.modified_time || new Date(),
        processedAt: new Date()
      };

      const response = await this.client.index({
        index: this.indexName,
        id: document.id,
        body: doc,
        refresh: true
      });

      this.logger.debug(`Indexed document ${document.id}`, {
        result: response.body.result,
        _id: response.body._id
      });

      return response.body;
    } catch (error) {
      this.logger.error('Failed to index document', {
        error: error.message,
        documentId: document.id
      });
      throw error;
    }
  }

  /**
   * 批量索引文档
   */
  async bulkIndexDocuments(documents) {
    try {
      const body = [];
      const documentIds = [];

      for (const document of documents) {
        documentIds.push(document.id);

        body.push({
          index: {
            _index: this.indexName,
            _id: document.id
          }
        });

        const doc = {
          documentId: document.id,
          title: document.title || '',
          ai_title: document.ai_title || '',
          content: document.content || '',
          summary: document.summary || '',
          keywords: document.keywords || [],
          category: document.category || '',
          source: document.source || 'feishu',
          type: document.type || 'doc',
          embedding: document.embedding || [],
          metadata: document.metadata || {},
          createdAt: document.created_time || new Date(),
          updatedAt: document.modified_time || new Date(),
          processedAt: new Date()
        };

        body.push(doc);
      }

      const response = await this.client.bulk({
        body,
        refresh: true
      });

      const { errors, items } = response.body;
      const successCount = items.filter(item => !item.index.error).length;
      const failedItems = items.filter(item => item.index.error);

      if (errors) {
        this.logger.warn(`Bulk indexing completed with errors: ${successCount}/${documents.length} successful`);
        failedItems.forEach(item => {
          this.logger.error('Failed to index document', {
            documentId: item.index._id,
            error: item.index.error
          });
        });
      } else {
        this.logger.info(`Bulk indexed ${successCount} documents successfully`);
      }

      return {
        success: successCount,
        failed: documents.length - successCount,
        errors: failedItems
      };
    } catch (error) {
      this.logger.error('Failed to bulk index documents', {
        error: error.message,
        documentCount: documents.length
      });
      throw error;
    }
  }

  /**
   * 向量相似度搜索
   */
  async searchByVector(queryVector, options = {}) {
    try {
      const {
        size = 10,
        minScore = 0.7,
        filters = {}
      } = options;

      const query = {
        bool: {
          must: [
            {
              knn: {
                field: 'embedding',
                query_vector: queryVector,
                k: size,
                num_candidates: size * 2,
                boost: 1.0
              }
            }
          ],
          filter: []
        }
      };

      // 添加过滤条件
      if (filters.category) {
        query.bool.filter.push({
          term: { category: filters.category }
        });
      }

      if (filters.source) {
        query.bool.filter.push({
          term: { source: filters.source }
        });
      }

      if (filters.type) {
        query.bool.filter.push({
          term: { type: filters.type }
        });
      }

      const response = await this.client.search({
        index: this.indexName,
        body: {
          query,
          size,
          min_score: minScore,
          _source: ['documentId', 'title', 'ai_title', 'summary', 'keywords', 'category', 'metadata', 'score']
        }
      });

      const results = response.body.hits.hits.map(hit => ({
        documentId: hit._source.documentId,
        title: hit._source.ai_title || hit._source.title,
        summary: hit._source.summary,
        keywords: hit._source.keywords,
        category: hit._source.category,
        metadata: hit._source.metadata,
        score: hit._score
      }));

      this.logger.debug(`Vector search completed: ${results.length} results found`);
      return results;
    } catch (error) {
      this.logger.error('Failed to search by vector', { error: error.message });
      throw error;
    }
  }

  /**
   * 文本搜索（关键词搜索）
   */
  async searchByText(query, options = {}) {
    try {
      const {
        size = 10,
        filters = {}
      } = options;

      const queryObj = {
        bool: {
          should: [
            {
              match: {
                title: {
                  query,
                  boost: 3.0
                }
              }
            },
            {
              match: {
                ai_title: {
                  query,
                  boost: 2.5
                }
              }
            },
            {
              match: {
                content: {
                  query,
                  boost: 1.0
                }
              }
            },
            {
              match: {
                summary: {
                  query,
                  boost: 1.5
                }
              }
            }
          ],
          minimum_should_match: 1,
          filter: []
        }
      };

      // 添加过滤条件
      if (filters.category) {
        queryObj.bool.filter.push({
          term: { category: filters.category }
        });
      }

      if (filters.source) {
        queryObj.bool.filter.push({
          term: { source: filters.source }
        });
      }

      const response = await this.client.search({
        index: this.indexName,
        body: {
          query: queryObj,
          size,
          highlight: {
            fields: {
              title: {},
              ai_title: {},
              content: {},
              summary: {}
            }
          }
        }
      });

      const results = response.body.hits.hits.map(hit => ({
        documentId: hit._source.documentId,
        title: hit._source.ai_title || hit._source.title,
        summary: hit._source.summary,
        keywords: hit._source.keywords,
        category: hit._source.category,
        metadata: hit._source.metadata,
        score: hit._score,
        highlight: hit.highlight
      }));

      this.logger.debug(`Text search completed: ${results.length} results found`);
      return results;
    } catch (error) {
      this.logger.error('Failed to search by text', { error: error.message });
      throw error;
    }
  }

  /**
   * 混合搜索（向量 + 文本）
   */
  async hybridSearch(query, queryVector, options = {}) {
    try {
      const {
        size = 10,
        vectorWeight = 0.7,
        textWeight = 0.3,
        filters = {}
      } = options;

      const queryObj = {
        bool: {
          should: [
            {
              knn: {
                field: 'embedding',
                query_vector: queryVector,
                k: size,
                num_candidates: size * 2,
                boost: vectorWeight
              }
            },
            {
              bool: {
                should: [
                  { match: { title: { query, boost: textWeight * 3.0 } } },
                  { match: { ai_title: { query, boost: textWeight * 2.5 } } },
                  { match: { content: { query, boost: textWeight * 1.0 } } },
                  { match: { summary: { query, boost: textWeight * 1.5 } } }
                ],
                boost: textWeight
              }
            }
          ],
          filter: []
        }
      };

      // 添加过滤条件
      if (filters.category) {
        queryObj.bool.filter.push({
          term: { category: filters.category }
        });
      }

      const response = await this.client.search({
        index: this.indexName,
        body: {
          query: queryObj,
          size
        }
      });

      const results = response.body.hits.hits.map(hit => ({
        documentId: hit._source.documentId,
        title: hit._source.ai_title || hit._source.title,
        summary: hit._source.summary,
        keywords: hit._source.keywords,
        category: hit._source.category,
        metadata: hit._source.metadata,
        score: hit._score
      }));

      this.logger.debug(`Hybrid search completed: ${results.length} results found`);
      return results;
    } catch (error) {
      this.logger.error('Failed to perform hybrid search', { error: error.message });
      throw error;
    }
  }

  /**
   * 删除文档
   */
  async deleteDocument(documentId) {
    try {
      const response = await this.client.delete({
        index: this.indexName,
        id: documentId,
        refresh: true
      });

      this.logger.info(`Deleted document ${documentId}`);
      return response.body;
    } catch (error) {
      if (error.statusCode === 404) {
        this.logger.warn(`Document ${documentId} not found for deletion`);
        return null;
      }
      this.logger.error('Failed to delete document', {
        error: error.message,
        documentId
      });
      throw error;
    }
  }

  /**
   * 获取索引统计信息
   */
  async getIndexStats() {
    try {
      const response = await this.client.indices.stats({
        index: this.indexName
      });

      const stats = response.body.indices[this.indexName];
      if (!stats) {
        return { documentCount: 0, size: 0 };
      }

      return {
        documentCount: stats.total.docs.count,
        deletedCount: stats.total.docs.deleted,
        size: stats.total.store.size_in_bytes,
        sizeHuman: stats.total.store.size_in_bytes_human
      };
    } catch (error) {
      this.logger.error('Failed to get index stats', { error: error.message });
      throw error;
    }
  }

  /**
   * 清空索引
   */
  async clearIndex() {
    try {
      const response = await this.client.deleteByQuery({
        index: this.indexName,
        body: {
          query: {
            match_all: {}
          }
        },
        refresh: true
      });

      this.logger.info(`Cleared index ${this.indexName}: ${response.body.deleted} documents deleted`);
      return response.body.deleted;
    } catch (error) {
      this.logger.error('Failed to clear index', { error: error.message });
      throw error;
    }
  }

  /**
   * 删除索引
   */
  async deleteIndex() {
    try {
      const response = await this.client.indices.delete({
        index: this.indexName
      });

      this.logger.info(`Deleted index ${this.indexName}`);
      return response.body;
    } catch (error) {
      if (error.statusCode === 404) {
        this.logger.warn(`Index ${this.indexName} not found for deletion`);
        return null;
      }
      this.logger.error('Failed to delete index', { error: error.message });
      throw error;
    }
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      await this.testConnection();
      const stats = await this.getIndexStats();
      return {
        status: 'healthy',
        index: this.indexName,
        documentCount: stats.documentCount,
        size: stats.sizeHuman
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        index: this.indexName
      };
    }
  }
}

module.exports = ElasticsearchClient;



