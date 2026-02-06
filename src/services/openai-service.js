/**
 * OpenAI Service
 * OpenAI服务
 */

const OpenAI = require('openai');
const { getLogger } = require('./logger');

class OpenAIService {
  constructor(config) {
    this.config = config.openai;
    this.logger = getLogger(config).child({ service: 'openai-service' });
    this.client = null;
    this.requestQueue = [];
    this.isProcessing = false;
    this.maxConcurrentRequests = config.performance?.maxConcurrentAiRequests || 5;
    this.activeRequests = 0;
  }

  /**
   * 初始化OpenAI客户端
   */
  async initialize() {
    try {
      this.client = new OpenAI({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseUrl
      });

      // 测试连接
      await this.testConnection();
      this.logger.info('✅ OpenAI service initialized successfully');
    } catch (error) {
      this.logger.error('❌ Failed to initialize OpenAI service', { error: error.message });
      throw error;
    }
  }

  /**
   * 测试连接
   */
  async testConnection() {
    try {
      const response = await this.client.models.list();
      this.logger.info('OpenAI API connection test passed');
      return true;
    } catch (error) {
      this.logger.error('OpenAI API connection test failed', { error: error.message });
      throw error;
    }
  }

  /**
   * 生成AI优化标题
   */
  async generateTitle(content, originalTitle = '', maxRetries = 3) {
    const prompt = `请根据以下文档内容，生成一个简洁、有意义的标题。

原始标题：${originalTitle || '无'}

文档内容：
${content.substring(0, 2000)}...

要求：
1. 标题应该简洁明了，不超过20个字符
2. 突出文档的核心主题
3. 使用中文标题
4. 如果原始标题已经合适，可以适当优化

请直接返回标题，不要其他解释。`;

    return await this.makeRequest(
      '标题生成',
      [{ role: 'user', content: prompt }],
      { max_tokens: 100, temperature: 0.3 },
      maxRetries
    );
  }

  /**
   * 生成文档摘要
   */
  async generateSummary(content, maxRetries = 3) {
    const prompt = `请为以下文档内容生成一个简洁的摘要。

文档内容：
${content.substring(0, 3000)}...

要求：
1. 摘要应该控制在100-200字之间
2. 包含文档的核心要点
3. 使用中文
4. 客观准确地反映文档内容

请直接返回摘要，不要其他解释。`;

    return await this.makeRequest(
      '摘要生成',
      [{ role: 'user', content: prompt }],
      { max_tokens: 300, temperature: 0.3 },
      maxRetries
    );
  }

  /**
   * 提取关键词
   */
  async extractKeywords(content, maxKeywords = 5, maxRetries = 3) {
    const prompt = `请从以下文档内容中提取关键词。

文档内容：
${content.substring(0, 2000)}...

要求：
1. 提取${maxKeywords}个关键词
2. 关键词应该最能代表文档的核心主题
3. 使用中文关键词
4. 返回格式：关键词1,关键词2,关键词3,...

请直接返回关键词列表，不要其他解释。`;

    const response = await this.makeRequest(
      '关键词提取',
      [{ role: 'user', content: prompt }],
      { max_tokens: 150, temperature: 0.2 },
      maxRetries
    );

    // 解析关键词列表
    return response.split(',').map(k => k.trim()).filter(k => k.length > 0);
  }

  /**
   * 内容分类
   */
  async classifyContent(content, categories = [], maxRetries = 3) {
    const categoryList = categories.length > 0 ? categories.join('、') : '技术文档、产品文档、用户手册、API文档、其他';

    const prompt = `请分析以下文档内容，并从这些类别中选择最合适的分类：${categoryList}

文档内容：
${content.substring(0, 1500)}...

要求：
1. 从给定的类别中选择最合适的一个
2. 如果都不合适，可以选择"其他"
3. 请直接返回分类名称，不要其他解释

最合适的分类是：`;

    return await this.makeRequest(
      '内容分类',
      [{ role: 'user', content: prompt }],
      { max_tokens: 50, temperature: 0.1 },
      maxRetries
    );
  }

  /**
   * 生成向量嵌入
   */
  async generateEmbedding(text, maxRetries = 3) {
    try {
      // 限制文本长度，避免超出API限制
      const truncatedText = text.substring(0, 8000);

      const response = await this.client.embeddings.create({
        model: this.config.embeddingModel,
        input: truncatedText,
        encoding_format: 'float'
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No embedding data received');
      }

      const embedding = response.data[0].embedding;
      this.logger.debug(`Generated embedding with ${embedding.length} dimensions`);
      return embedding;
    } catch (error) {
      this.logger.error('Failed to generate embedding', { error: error.message });

      if (maxRetries > 0) {
        this.logger.info(`Retrying embedding generation (${maxRetries} attempts left)`);
        await this.sleep(1000);
        return this.generateEmbedding(text, maxRetries - 1);
      }

      throw error;
    }
  }

  /**
   * 批量生成嵌入
   */
  async batchGenerateEmbeddings(texts, concurrency = 3) {
    const results = [];
    const batches = this.chunkArray(texts, concurrency);

    for (const batch of batches) {
      const promises = batch.map(async (text, index) => {
        try {
          const embedding = await this.generateEmbedding(text);
          return { text: text.substring(0, 100) + '...', embedding, success: true, index };
        } catch (error) {
          this.logger.warn(`Failed to generate embedding for text ${index}`, {
            error: error.message
          });
          return { text: text.substring(0, 100) + '...', error: error.message, success: false, index };
        }
      });

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);

      // 避免API限流
      await this.sleep(200);
    }

    const successCount = results.filter(r => r.success).length;
    this.logger.info(`Batch embedding generation completed: ${successCount}/${results.length} successful`);

    return results;
  }

  /**
   * 智能内容拆分
   */
  async splitContent(content, maxTokens = 7000) {
    try {
      // 估算token数量（简单估算：1个中文字符≈1.5个token）
      const estimatedTokens = Math.ceil(content.length * 1.5);

      if (estimatedTokens <= maxTokens) {
        return [content];
      }

      // 需要拆分内容
      const chunks = [];
      const sentences = this.splitIntoSentences(content);
      let currentChunk = '';

      for (const sentence of sentences) {
        const potentialChunk = currentChunk + sentence;
        const potentialTokens = Math.ceil(potentialChunk.length * 1.5);

        if (potentialTokens > maxTokens && currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          currentChunk = sentence;
        } else {
          currentChunk = potentialChunk;
        }
      }

      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
      }

      this.logger.info(`Split content into ${chunks.length} chunks`);
      return chunks;
    } catch (error) {
      this.logger.error('Failed to split content', { error: error.message });
      // 如果拆分失败，返回原内容
      return [content];
    }
  }

  /**
   * 按句子拆分文本
   */
  splitIntoSentences(text) {
    // 简单的句子拆分逻辑
    const sentences = text.split(/[。！？\n]/).filter(s => s.trim().length > 0);
    return sentences.map(s => s.trim() + '。');
  }

  /**
   * 执行AI处理任务（包含标题生成、摘要和关键词提取）
   */
  async processDocumentAI(content, originalTitle = '') {
    try {
      this.logger.debug('Starting AI processing for document');

      const [title, summary, keywords, category] = await Promise.all([
        this.generateTitle(content, originalTitle),
        this.generateSummary(content),
        this.extractKeywords(content),
        this.classifyContent(content)
      ]);

      const result = {
        ai_title: title?.trim() || originalTitle,
        summary: summary?.trim() || '',
        keywords: keywords || [],
        category: category?.trim() || '其他',
        processed_at: new Date().toISOString()
      };

      this.logger.debug('AI processing completed', {
        titleLength: result.ai_title.length,
        summaryLength: result.summary.length,
        keywordsCount: result.keywords.length
      });

      return result;
    } catch (error) {
      this.logger.error('AI processing failed', { error: error.message });
      // 返回降级结果
      return {
        ai_title: originalTitle,
        summary: '',
        keywords: [],
        category: '其他',
        processed_at: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * 通用API请求方法
   */
  async makeRequest(operation, messages, options = {}, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.config.model,
          messages,
          max_tokens: options.max_tokens || 1000,
          temperature: options.temperature || 0.7,
          ...options
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('Empty response from OpenAI API');
        }

        this.logger.debug(`${operation} completed on attempt ${attempt}`);
        return content.trim();
      } catch (error) {
        this.logger.warn(`${operation} failed on attempt ${attempt}`, {
          error: error.message,
          attempt,
          maxRetries
        });

        if (attempt === maxRetries) {
          throw error;
        }

        // 指数退避重试
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await this.sleep(delay);
      }
    }
  }

  /**
   * 获取API使用统计
   */
  getUsageStats() {
    // 这里可以集成OpenAI的使用统计API
    // 目前返回基本信息
    return {
      model: this.config.model,
      embeddingModel: this.config.embeddingModel,
      maxConcurrentRequests: this.maxConcurrentRequests,
      activeRequests: this.activeRequests
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
   * 健康检查
   */
  async healthCheck() {
    try {
      await this.testConnection();
      return {
        status: 'healthy',
        model: this.config.model,
        embeddingModel: this.config.embeddingModel
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        model: this.config.model
      };
    }
  }
}

module.exports = OpenAIService;



