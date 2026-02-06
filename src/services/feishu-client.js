/**
 * Feishu API Client
 * 飞书API客户端
 */

const axios = require('axios');
const { getLogger } = require('./logger');

class FeishuClient {
  constructor(config) {
    this.config = config.feishu;
    this.logger = getLogger(config).child({ service: 'feishu-client' });
    this.accessToken = null;
    this.tokenExpires = null;
    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 30000, // 30秒超时
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // 请求拦截器：自动添加认证
    this.client.interceptors.request.use(
      async (config) => {
        if (!this.accessToken || this.isTokenExpired()) {
          await this.authenticate();
        }
        config.headers.Authorization = `Bearer ${this.accessToken}`;
        return config;
      },
      (error) => {
        this.logger.error('Request interceptor error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // 响应拦截器：处理错误和重试
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const { response, config } = error;

        // 如果是认证错误，尝试刷新token
        if (response?.status === 401 && !config._retry) {
          config._retry = true;
          this.accessToken = null;
          return this.client(config);
        }

        // 记录错误详情
        this.logger.error('API request failed', {
          status: response?.status,
          url: config?.url,
          method: config?.method,
          error: response?.data || error.message
        });

        return Promise.reject(error);
      }
    );
  }

  /**
   * 检查token是否过期
   */
  isTokenExpired() {
    if (!this.tokenExpires) return true;
    // 提前5分钟刷新token
    return Date.now() >= (this.tokenExpires - 5 * 60 * 1000);
  }

  /**
   * 获取访问令牌
   */
  async authenticate() {
    try {
      this.logger.info('Authenticating with Feishu API');

      const response = await axios.post(`${this.config.baseUrl}/open-apis/auth/v3/tenant_access_token/internal`, {
        app_id: this.config.appId,
        app_secret: this.config.appSecret
      });

      if (response.data.code !== 0) {
        throw new Error(`Authentication failed: ${response.data.msg}`);
      }

      this.accessToken = response.data.tenant_access_token;
      // token有效期通常是2小时
      this.tokenExpires = Date.now() + (2 * 60 * 60 * 1000);

      this.logger.info('Successfully authenticated with Feishu API');
    } catch (error) {
      this.logger.error('Authentication failed', { error: error.message });
      throw new Error(`Feishu authentication failed: ${error.message}`);
    }
  }

  /**
   * 获取文档列表
   */
  async getDocuments(folderToken, pageSize = 50) {
    try {
      const documents = [];
      let hasMore = true;
      let pageToken = null;

      while (hasMore) {
        const params = {
          folder_token: folderToken,
          page_size: pageSize
        };

        if (pageToken) {
          params.page_token = pageToken;
        }

        const response = await this.client.get('/open-apis/drive/v1/files', { params });

        if (response.data.code !== 0) {
          throw new Error(`Get documents failed: ${response.data.msg}`);
        }

        const { files, has_more, next_page_token } = response.data.data;

        // 只获取文档类型文件
        const docs = files.filter(file =>
          file.type === 'doc' || file.type === 'docx' || file.type === 'sheet'
        );

        documents.push(...docs);
        hasMore = has_more;
        pageToken = next_page_token;

        this.logger.debug(`Fetched ${docs.length} documents, hasMore: ${hasMore}`);
      }

      this.logger.info(`Successfully fetched ${documents.length} documents from folder`);
      return documents;
    } catch (error) {
      this.logger.error('Failed to get documents', { error: error.message, folderToken });
      throw error;
    }
  }

  /**
   * 获取文档内容
   */
  async getDocumentContent(documentId, documentType = 'doc') {
    try {
      let endpoint;
      let params = {};

      switch (documentType) {
        case 'doc':
          endpoint = `/open-apis/doc/v2/${documentId}/content`;
          break;
        case 'sheet':
          endpoint = `/open-apis/sheets/v2/spreadsheets/${documentId}/metainfo`;
          break;
        default:
          throw new Error(`Unsupported document type: ${documentType}`);
      }

      const response = await this.client.get(endpoint, { params });

      if (response.data.code !== 0) {
        throw new Error(`Get document content failed: ${response.data.msg}`);
      }

      this.logger.debug(`Successfully fetched content for document ${documentId}`);
      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to get document content', {
        error: error.message,
        documentId,
        documentType
      });
      throw error;
    }
  }

  /**
   * 获取文档元数据
   */
  async getDocumentMeta(documentId, documentType = 'doc') {
    try {
      const response = await this.client.get(`/open-apis/drive/v1/files/${documentId}`);

      if (response.data.code !== 0) {
        throw new Error(`Get document meta failed: ${response.data.msg}`);
      }

      const meta = response.data.data;
      this.logger.debug(`Successfully fetched metadata for document ${documentId}`);
      return meta;
    } catch (error) {
      this.logger.error('Failed to get document metadata', {
        error: error.message,
        documentId,
        documentType
      });
      throw error;
    }
  }

  /**
   * 获取文档块内容（用于复杂文档）
   */
  async getDocumentBlocks(documentId, documentType = 'doc') {
    try {
      const endpoint = `/open-apis/doc/v2/${documentId}/raw_content`;
      const response = await this.client.get(endpoint);

      if (response.data.code !== 0) {
        throw new Error(`Get document blocks failed: ${response.data.msg}`);
      }

      this.logger.debug(`Successfully fetched blocks for document ${documentId}`);
      return response.data.data;
    } catch (error) {
      this.logger.error('Failed to get document blocks', {
        error: error.message,
        documentId,
        documentType
      });
      throw error;
    }
  }

  /**
   * 递归获取文件夹下的所有文档
   */
  async getAllDocumentsRecursively(folderToken) {
    try {
      const allDocuments = [];

      // 获取当前文件夹的文档
      const documents = await this.getDocuments(folderToken);
      allDocuments.push(...documents);

      // 获取子文件夹
      const subfolders = await this.getSubfolders(folderToken);

      // 递归处理子文件夹
      for (const subfolder of subfolders) {
        const subDocuments = await this.getAllDocumentsRecursively(subfolder.token);
        allDocuments.push(...subDocuments);
      }

      this.logger.info(`Found ${allDocuments.length} documents in folder tree`);
      return allDocuments;
    } catch (error) {
      this.logger.error('Failed to get all documents recursively', {
        error: error.message,
        folderToken
      });
      throw error;
    }
  }

  /**
   * 获取子文件夹
   */
  async getSubfolders(folderToken) {
    try {
      const params = {
        folder_token: folderToken,
        page_size: 50
      };

      const response = await this.client.get('/open-apis/drive/v1/files', { params });

      if (response.data.code !== 0) {
        throw new Error(`Get subfolders failed: ${response.data.msg}`);
      }

      const { files } = response.data.data;
      const subfolders = files.filter(file => file.type === 'folder');

      this.logger.debug(`Found ${subfolders.length} subfolders in folder ${folderToken}`);
      return subfolders;
    } catch (error) {
      this.logger.error('Failed to get subfolders', {
        error: error.message,
        folderToken
      });
      throw error;
    }
  }

  /**
   * 批量获取文档内容
   */
  async batchGetDocumentContent(documentIds, concurrency = 3) {
    const results = [];
    const batches = this.chunkArray(documentIds, concurrency);

    for (const batch of batches) {
      const promises = batch.map(async (docId) => {
        try {
          const content = await this.getDocumentContent(docId);
          return { documentId: docId, content, success: true };
        } catch (error) {
          this.logger.warn(`Failed to get content for document ${docId}`, {
            error: error.message
          });
          return { documentId: docId, error: error.message, success: false };
        }
      });

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);

      // 避免API限流
      await this.sleep(100);
    }

    const successCount = results.filter(r => r.success).length;
    this.logger.info(`Batch content fetch completed: ${successCount}/${results.length} successful`);

    return results;
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
   * 测试连接
   */
  async testConnection() {
    try {
      await this.authenticate();
      this.logger.info('✅ Feishu API connection test passed');
      return true;
    } catch (error) {
      this.logger.error('❌ Feishu API connection test failed', { error: error.message });
      return false;
    }
  }
}

module.exports = FeishuClient;



