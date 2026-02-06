/**
 * RAG Pipeline Main Entry Point
 * RAG流水线主入口
 */

const config = require('./config/config');
const PipelineOrchestrator = require('./pipeline-orchestrator');
const { getLogger } = require('./services/logger');

class RAGPipeline {
  constructor() {
    this.config = config;
    this.logger = getLogger(this.config);
    this.orchestrator = null;
  }

  /**
   * 初始化系统
   */
  async initialize() {
    try {
      this.logger.info('🚀 Initializing RAG Pipeline System');

      // 验证配置
      this.config.validate();

      // 初始化编排器
      this.orchestrator = new PipelineOrchestrator(this.config);
      await this.orchestrator.initialize();

      this.logger.info('✅ RAG Pipeline System initialized successfully');
    } catch (error) {
      this.logger.error('❌ Failed to initialize RAG Pipeline System', { error: error.message });
      throw error;
    }
  }

  /**
   * 执行完整流水线
   */
  async runPipeline(options = {}) {
    try {
      if (!this.orchestrator) {
        await this.initialize();
      }

      this.logger.info('🎯 Starting RAG Pipeline execution', options);

      const result = await this.orchestrator.executePipeline(options);

      this.logger.info('🎉 RAG Pipeline execution completed successfully', {
        duration: result.duration,
        totalDocuments: result.overallStats?.totalDocuments || 0
      });

      return result;
    } catch (error) {
      this.logger.error('💥 RAG Pipeline execution failed', { error: error.message });
      throw error;
    }
  }

  /**
   * 执行单个阶段
   */
  async runStage(stageName, options = {}) {
    try {
      if (!this.orchestrator) {
        await this.initialize();
      }

      this.logger.info(`🎯 Executing single stage: ${stageName}`, options);

      const result = await this.orchestrator.executeStage(stageName, options);

      this.logger.info(`✅ Stage ${stageName} execution completed`, {
        duration: result.duration
      });

      return result;
    } catch (error) {
      this.logger.error(`💥 Stage ${stageName} execution failed`, { error: error.message });
      throw error;
    }
  }

  /**
   * 获取系统状态
   */
  getStatus() {
    if (!this.orchestrator) {
      return { status: 'not_initialized' };
    }

    return {
      status: 'initialized',
      execution: this.orchestrator.getExecutionStatus(),
      health: null, // 可以后续实现健康检查
      config: this.orchestrator.getConfiguration()
    };
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      if (!this.orchestrator) {
        return { status: 'not_initialized' };
      }

      const health = await this.orchestrator.healthCheck();
      return health;
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 清理资源
   */
  async cleanup() {
    try {
      if (this.orchestrator) {
        await this.orchestrator.cleanup();
      }
      this.logger.info('🧹 RAG Pipeline cleanup completed');
    } catch (error) {
      this.logger.error('❌ Error during cleanup', { error: error.message });
    }
  }
}

// CLI 入口点
async function main() {
  const ragPipeline = new RAGPipeline();

  try {
    // 解析命令行参数
    const args = process.argv.slice(2);
    const command = args[0] || 'pipeline';

    switch (command) {
      case 'pipeline':
        // 执行完整流水线
        const pipelineOptions = parsePipelineOptions(args.slice(1));
        await ragPipeline.initialize();
        const result = await ragPipeline.runPipeline(pipelineOptions);
        console.log('Pipeline completed successfully:', result.overallStats);
        break;

      case 'clone':
      case 'clean':
      case 'upload':
        // 执行单个阶段
        const stageOptions = parseStageOptions(command, args.slice(1));
        await ragPipeline.initialize();
        const stageResult = await ragPipeline.runStage(command, stageOptions);
        console.log(`Stage ${command} completed successfully:`, stageResult.stats);
        break;

      case 'status':
        // 获取状态
        const status = ragPipeline.getStatus();
        console.log('System status:', JSON.stringify(status, null, 2));
        break;

      case 'health':
        // 健康检查
        await ragPipeline.initialize();
        const health = await ragPipeline.healthCheck();
        console.log('Health check:', JSON.stringify(health, null, 2));
        break;

      default:
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await ragPipeline.cleanup();
  }
}

/**
 * 解析流水线选项
 */
function parsePipelineOptions(args) {
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--folders':
      case '-f':
        options.folderTokens = args[++i]?.split(',');
        break;
      case '--force-full':
        options.forceFullUpdate = true;
        break;
      case '--force-reprocess':
        options.forceReprocess = true;
        break;
      case '--force-reindex':
        options.forceReindex = true;
        break;
      case '--batch-size':
        options.batchSize = parseInt(args[++i]);
        break;
      case '--max-concurrent':
        options.maxConcurrentAiRequests = parseInt(args[++i]);
        break;
      case '--skip-stages':
        options.skipStages = args[++i]?.split(',');
        break;
    }
  }

  return options;
}

/**
 * 解析阶段选项
 */
function parseStageOptions(stageName, args) {
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--folders':
      case '-f':
        if (stageName === 'clone') {
          options.folderTokens = args[++i]?.split(',');
        }
        break;
      case '--documents':
        if (['clean', 'upload'].includes(stageName)) {
          options.documents = JSON.parse(args[++i]);
        }
        break;
      case '--batch-size':
        options.batchSize = parseInt(args[++i]);
        break;
      case '--force':
        if (stageName === 'clean') {
          options.forceReprocess = true;
        } else if (stageName === 'upload') {
          options.forceReindex = true;
        }
        break;
    }
  }

  return options;
}

/**
 * 打印使用说明
 */
function printUsage() {
  console.log(`
RAG Pipeline - 飞书文档知识库构建系统

Usage:
  npm start [command] [options]

Commands:
  pipeline    执行完整流水线 (默认)
  clone       执行文档采集阶段
  clean       执行内容处理阶段
  upload      执行索引构建阶段
  status      查看系统状态
  health      执行健康检查

Pipeline Options:
  -f, --folders <tokens>       飞书文件夹tokens (用逗号分隔)
  --force-full                 强制全量更新
  --force-reprocess            强制重新处理AI内容
  --force-reindex              强制重新索引
  --batch-size <number>        批处理大小 (默认: 10)
  --max-concurrent <number>    最大并发AI请求数 (默认: 5)
  --skip-stages <stages>       跳过指定阶段 (用逗号分隔)

Stage Options:
  -f, --folders <tokens>       clone阶段: 文件夹tokens
  --documents <json>           clean/upload阶段: 文档数据
  --batch-size <number>        批处理大小
  --force                      强制重新处理/索引

Examples:
  npm start pipeline --folders "folder1,folder2"
  npm start clone --folders "folder1"
  npm start clean --documents '[{"id": "doc1", "content": "..."}]'
  npm start status
  `);
}

// 如果直接运行此文件，启动CLI
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = RAGPipeline;



