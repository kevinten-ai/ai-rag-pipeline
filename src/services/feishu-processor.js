/**
 * Feishu Document Processor
 * 飞书文档处理器
 */

const { getLogger } = require('./logger');

class FeishuDocumentProcessor {
  constructor(config) {
    this.config = config;
    this.logger = getLogger(config).child({ service: 'feishu-processor' });
  }

  /**
   * 处理文档内容，将飞书文档转换为标准格式
   */
  async processDocument(document, content) {
    try {
      const documentType = document.type || 'doc';

      switch (documentType) {
        case 'doc':
          return await this.processDocDocument(document, content);
        case 'sheet':
          return await this.processSheetDocument(document, content);
        default:
          throw new Error(`Unsupported document type: ${documentType}`);
      }
    } catch (error) {
      this.logger.error('Failed to process document', {
        error: error.message,
        documentId: document.id,
        documentType: document.type
      });
      throw error;
    }
  }

  /**
   * 处理普通文档
   */
  async processDocDocument(document, content) {
    try {
      // 飞书文档内容结构处理
      const processedContent = this.extractDocContent(content);
      const metadata = this.extractDocMetadata(document, content);

      return {
        id: document.id,
        title: document.name || metadata.title || 'Untitled Document',
        content: processedContent,
        metadata: {
          ...metadata,
          type: 'doc',
          source: 'feishu',
          url: document.url,
          created_time: document.created_time,
          modified_time: document.modified_time,
          owner_id: document.owner_id,
          parent_token: document.parent_token
        },
        raw: content
      };
    } catch (error) {
      this.logger.error('Failed to process doc document', {
        error: error.message,
        documentId: document.id
      });
      throw error;
    }
  }

  /**
   * 处理表格文档
   */
  async processSheetDocument(document, content) {
    try {
      const processedContent = this.extractSheetContent(content);
      const metadata = this.extractSheetMetadata(document, content);

      return {
        id: document.id,
        title: document.name || metadata.title || 'Untitled Sheet',
        content: processedContent,
        metadata: {
          ...metadata,
          type: 'sheet',
          source: 'feishu',
          url: document.url,
          created_time: document.created_time,
          modified_time: document.modified_time,
          owner_id: document.owner_id,
          parent_token: document.parent_token
        },
        raw: content
      };
    } catch (error) {
      this.logger.error('Failed to process sheet document', {
        error: error.message,
        documentId: document.id
      });
      throw error;
    }
  }

  /**
   * 提取文档内容
   */
  extractDocContent(content) {
    try {
      if (!content || !content.body) {
        return '';
      }

      const { body } = content;
      let textContent = '';

      // 处理飞书文档的blocks结构
      if (body.blocks) {
        textContent = this.processBlocks(body.blocks);
      }

      // 如果没有blocks，尝试直接提取内容
      if (!textContent && body.content) {
        textContent = body.content;
      }

      return textContent.trim();
    } catch (error) {
      this.logger.warn('Failed to extract doc content, using fallback', {
        error: error.message
      });
      return content?.body?.content || '';
    }
  }

  /**
   * 处理文档块
   */
  processBlocks(blocks) {
    let content = '';

    for (const block of blocks) {
      if (block.type === 'text') {
        content += block.text + '\n';
      } else if (block.type === 'heading') {
        const level = block.level || 1;
        content += '#'.repeat(level) + ' ' + (block.text || '') + '\n';
      } else if (block.type === 'list') {
        content += '- ' + (block.text || '') + '\n';
      } else if (block.type === 'code') {
        content += '```\n' + (block.code || block.text || '') + '\n```\n';
      } else if (block.type === 'quote') {
        content += '> ' + (block.text || '') + '\n';
      } else {
        // 其他块类型，直接提取文本
        content += (block.text || '') + '\n';
      }
    }

    return content;
  }

  /**
   * 提取文档元数据
   */
  extractDocMetadata(document, content) {
    const metadata = {
      title: document.name,
      author: document.owner_id,
      createdAt: document.created_time,
      updatedAt: document.modified_time,
      wordCount: 0,
      pageCount: 1
    };

    try {
      // 计算字数
      if (content?.body?.blocks) {
        const text = this.processBlocks(content.body.blocks);
        metadata.wordCount = text.length;
      }

      // 提取更多元数据
      if (content?.document?.title) {
        metadata.title = content.document.title;
      }

      // 提取标签或分类信息（如果有）
      if (content?.document?.tags) {
        metadata.tags = content.document.tags;
      }

    } catch (error) {
      this.logger.warn('Failed to extract doc metadata', {
        error: error.message,
        documentId: document.id
      });
    }

    return metadata;
  }

  /**
   * 提取表格内容
   */
  extractSheetContent(content) {
    try {
      if (!content || !content.sheets) {
        return '';
      }

      let textContent = '';

      // 处理每个sheet
      for (const sheet of content.sheets) {
        textContent += `## ${sheet.title}\n\n`;

        // 如果有数据，转换为文本格式
        if (sheet.grid_properties) {
          // 这里可以根据需要添加更复杂的表格处理逻辑
          textContent += `[表格数据：${sheet.title}]\n\n`;
        }
      }

      return textContent.trim();
    } catch (error) {
      this.logger.warn('Failed to extract sheet content', {
        error: error.message
      });
      return '';
    }
  }

  /**
   * 提取表格元数据
   */
  extractSheetMetadata(document, content) {
    const metadata = {
      title: document.name,
      author: document.owner_id,
      createdAt: document.created_time,
      updatedAt: document.modified_time,
      sheetCount: 0,
      rowCount: 0,
      columnCount: 0
    };

    try {
      if (content?.sheets) {
        metadata.sheetCount = content.sheets.length;

        // 计算总行数和列数
        let totalRows = 0;
        let totalCols = 0;

        for (const sheet of content.sheets) {
          if (sheet.grid_properties) {
            totalRows += sheet.grid_properties.row_count || 0;
            totalCols = Math.max(totalCols, sheet.grid_properties.column_count || 0);
          }
        }

        metadata.rowCount = totalRows;
        metadata.columnCount = totalCols;
      }
    } catch (error) {
      this.logger.warn('Failed to extract sheet metadata', {
        error: error.message,
        documentId: document.id
      });
    }

    return metadata;
  }

  /**
   * 批量处理文档
   */
  async batchProcessDocuments(documents, contents, concurrency = 3) {
    const results = [];
    const batches = this.chunkArray(documents, concurrency);

    for (const batch of batches) {
      const promises = batch.map(async (document, index) => {
        const content = contents[index];
        try {
          const processed = await this.processDocument(document, content);
          return { document, processed, success: true };
        } catch (error) {
          this.logger.warn(`Failed to process document ${document.id}`, {
            error: error.message
          });
          return { document, error: error.message, success: false };
        }
      });

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }

    const successCount = results.filter(r => r.success).length;
    this.logger.info(`Batch document processing completed: ${successCount}/${results.length} successful`);

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
}

module.exports = FeishuDocumentProcessor;



