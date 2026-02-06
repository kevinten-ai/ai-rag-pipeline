/**
 * RAG Pipeline Orchestrator
 * 流水线编排器 - 协调三阶段执行
 */

const CloneStage = require('./stages/clone-stage');
const CleanStage = require('./stages/clean-stage');
const UploadStage = require('./stages/upload-stage');
const { getLogger } = require('./services/logger');

class PipelineOrchestrator {
  constructor(config) {
    this.config = config;
    this.logger = getLogger(config).child({ component: 'orchestrator' });
    this.stages = {};
    this.executionState = {
      isRunning: false,
      currentStage: null,
      startTime: null,
      stageResults: {},
      overallStats: {}
    };
  }

  /**
   * 初始化流水线
   */
  async initialize() {
    try {
      this.logger.info('Initializing RAG Pipeline Orchestrator');

      // 初始化各阶段
      this.stages.clone = new CloneStage(this.config);
      this.stages.clean = new CleanStage(this.config);
      this.stages.upload = new UploadStage(this.config);

      // 并行初始化所有阶段
      const initPromises = Object.values(this.stages).map(stage =>
        stage.initialize().catch(error => {
          this.logger.error(`Failed to initialize stage ${stage.constructor.name}`, {
            error: error.message
          });
          throw error;
        })
      );

      await Promise.all(initPromises);

      this.logger.info('✅ Pipeline Orchestrator initialized successfully');
    } catch (error) {
      this.logger.error('❌ Failed to initialize Pipeline Orchestrator', { error: error.message });
      throw error;
    }
  }

  /**
   * 执行完整流水线
   */
  async executePipeline(options = {}) {
    const pipelineStartTime = Date.now();

    try {
      this.logger.logPipelineStart('RAG Pipeline', options);

      this.executionState.isRunning = true;
      this.executionState.startTime = pipelineStartTime;
      this.executionState.stageResults = {};

      const {
        folderTokens = [],
        forceFullUpdate = false,
        forceReprocess = false,
        forceReindex = false,
        skipStages = [],
        batchSize = this.config.performance?.batchSize || 10,
        maxConcurrentAiRequests = this.config.performance?.maxConcurrentAiRequests || 5
      } = options;

      // 验证输入参数
      if (!folderTokens || folderTokens.length === 0) {
        throw new Error('folderTokens is required and cannot be empty');
      }

      // 执行阶段序列
      const stages = [
        { name: 'clone', stage: this.stages.clone },
        { name: 'clean', stage: this.stages.clean },
        { name: 'upload', stage: this.stages.upload }
      ];

      let currentDocuments = null;

      for (const { name, stage } of stages) {
        // 检查是否跳过此阶段
        if (skipStages.includes(name)) {
          this.logger.info(`Skipping stage: ${name}`);
          continue;
        }

        this.executionState.currentStage = name;
        const stageStartTime = Date.now();

        try {
          this.logger.info(`Starting stage: ${name}`);

          let stageOptions = {
            batchSize,
            maxConcurrentAiRequests
          };

          // 根据阶段设置特定选项
          switch (name) {
            case 'clone':
              stageOptions = {
                ...stageOptions,
                folderTokens,
                forceFullUpdate
              };
              break;

            case 'clean':
              stageOptions = {
                ...stageOptions,
                documents: currentDocuments,
                forceReprocess
              };
              break;

            case 'upload':
              stageOptions = {
                ...stageOptions,
                documents: currentDocuments,
                forceReindex
              };
              break;
          }

          const stageResult = await stage.execute(stageOptions);

          // 记录阶段结果
          this.executionState.stageResults[name] = {
            ...stageResult,
            stageDuration: Date.now() - stageStartTime
          };

          // 传递文档到下一阶段
          if (stageResult.documents) {
            currentDocuments = stageResult.documents;
          }

          this.logger.info(`Stage ${name} completed successfully`, {
            duration: stageResult.duration,
            documentCount: stageResult.documents?.length || 0
          });

        } catch (stageError) {
          this.logger.logPipelineError(`Pipeline Stage ${name}`, stageError);

          // 记录失败的阶段
          this.executionState.stageResults[name] = {
            stage: name,
            success: false,
            error: stageError.message,
            duration: Date.now() - stageStartTime
          };

          // 根据配置决定是否继续执行
          if (options.failFast !== false) {
            throw new Error(`Pipeline failed at stage ${name}: ${stageError.message}`);
          } else {
            this.logger.warn(`Continuing pipeline despite failure in stage ${name}`);
          }
        }
      }

      // 计算总体统计信息
      this.calculateOverallStats();

      const totalDuration = Date.now() - pipelineStartTime;
      this.logger.logPipelineComplete('RAG Pipeline', {
        duration: totalDuration,
        ...this.executionState.overallStats
      });

      this.executionState.isRunning = false;
      return this.getPipelineResult(totalDuration);

    } catch (error) {
      this.executionState.isRunning = false;
      const totalDuration = Date.now() - pipelineStartTime;

      this.logger.logPipelineError('RAG Pipeline', error);
      throw error;
    }
  }

  /**
   * 执行单个阶段
   */
  async executeStage(stageName, options = {}) {
    try {
      if (!this.stages[stageName]) {
        throw new Error(`Unknown stage: ${stageName}`);
      }

      this.logger.info(`Executing single stage: ${stageName}`, options);

      const stage = this.stages[stageName];
      const result = await stage.execute(options);

      this.logger.info(`Stage ${stageName} executed successfully`, {
        duration: result.duration,
        stats: result.stats
      });

      return result;
    } catch (error) {
      this.logger.error(`Failed to execute stage ${stageName}`, { error: error.message });
      throw error;
    }
  }

  /**
   * 获取流水线执行状态
   */
  getExecutionStatus() {
    return {
      ...this.executionState,
      uptime: this.executionState.startTime ?
        Date.now() - this.executionState.startTime : 0
    };
  }

  /**
   * 计算总体统计信息
   */
  calculateOverallStats() {
    const stats = {
      totalDocuments: 0,
      processedDocuments: 0,
      failedDocuments: 0,
      cacheHitRate: 0,
      aiProcessingRate: 0,
      indexingSuccessRate: 0,
      totalDuration: 0,
      stageDurations: {},
      stageStats: {}
    };

    let totalCacheHits = 0;
    let totalAiProcessed = 0;
    let totalIndexed = 0;

    for (const [stageName, result] of Object.entries(this.executionState.stageResults)) {
      if (result.success && result.stats) {
        stats.stageStats[stageName] = result.stats;
        stats.stageDurations[stageName] = result.stageDuration || result.duration;

        // 累加文档数量
        stats.totalDocuments = Math.max(stats.totalDocuments, result.stats.totalDocuments || 0);
        stats.processedDocuments += result.documents?.length || 0;
        stats.failedDocuments += result.stats.failedDocuments || 0;

        // 累加缓存命中
        if (result.stats.cacheHitRate !== undefined) {
          totalCacheHits += result.stats.cacheHitRate * (result.stats.totalDocuments || 0);
        }

        // 累加AI处理
        if (result.stats.aiProcessingRate !== undefined) {
          totalAiProcessed += result.stats.aiProcessingRate * (result.stats.totalDocuments || 0);
        }

        // 累加索引成功率
        if (result.stats.indexingSuccessRate !== undefined) {
          totalIndexed += result.stats.indexingSuccessRate * (result.stats.totalDocuments || 0);
        }
      }
    }

    // 计算平均比率
    if (stats.totalDocuments > 0) {
      stats.cacheHitRate = totalCacheHits / stats.totalDocuments;
      stats.aiProcessingRate = totalAiProcessed / stats.totalDocuments;
      stats.indexingSuccessRate = totalIndexed / stats.totalDocuments;
    }

    // 计算总时长
    stats.totalDuration = Object.values(stats.stageDurations).reduce((sum, duration) => sum + duration, 0);

    this.executionState.overallStats = stats;
  }

  /**
   * 获取流水线执行结果
   */
  getPipelineResult(totalDuration) {
    return {
      success: true,
      duration: totalDuration,
      stages: this.executionState.stageResults,
      overallStats: this.executionState.overallStats,
      executionTime: new Date().toISOString(),
      config: {
        docsName: this.config.docs?.name,
        incrementalEnabled: this.config.docs?.enableIncremental,
        performance: this.config.performance
      }
    };
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      const healthResults = {};

      // 检查各阶段健康状态
      for (const [stageName, stage] of Object.entries(this.stages)) {
        try {
          // 基本健康检查 - 检查阶段是否有必要的属性
          const isHealthy = typeof stage.execute === 'function' &&
                           typeof stage.initialize === 'function';

          healthResults[stageName] = {
            status: isHealthy ? 'healthy' : 'unhealthy',
            stage: stageName
          };
        } catch (error) {
          healthResults[stageName] = {
            status: 'unhealthy',
            error: error.message,
            stage: stageName
          };
        }
      }

      // 检查执行状态
      const allStagesHealthy = Object.values(healthResults).every(h => h.status === 'healthy');

      return {
        status: allStagesHealthy ? 'healthy' : 'degraded',
        pipeline: {
          isRunning: this.executionState.isRunning,
          currentStage: this.executionState.currentStage,
          stages: healthResults
        },
        timestamp: new Date().toISOString()
      };
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
      this.logger.info('Starting pipeline cleanup');

      // 并行清理所有阶段
      const cleanupPromises = Object.values(this.stages).map(stage =>
        stage.cleanup().catch(error => {
          this.logger.error(`Error cleaning up stage ${stage.constructor.name}`, {
            error: error.message
          });
        })
      );

      await Promise.all(cleanupPromises);

      this.executionState = {
        isRunning: false,
        currentStage: null,
        startTime: null,
        stageResults: {},
        overallStats: {}
      };

      this.logger.info('✅ Pipeline cleanup completed');
    } catch (error) {
      this.logger.error('❌ Error during pipeline cleanup', { error: error.message });
    }
  }

  /**
   * 获取流水线配置信息
   */
  getConfiguration() {
    return {
      docs: {
        name: this.config.docs?.name,
        enableIncremental: this.config.docs?.enableIncremental
      },
      performance: this.config.performance,
      services: {
        feishu: {
          configured: !!(this.config.feishu?.appId && this.config.feishu?.appSecret)
        },
        openai: {
          configured: !!this.config.openai?.apiKey,
          model: this.config.openai?.model
        },
        elasticsearch: {
          configured: !!(this.config.elasticsearch?.host && this.config.elasticsearch?.username),
          index: this.config.elasticsearch?.indexName
        },
        mongodb: {
          configured: !!this.config.mongodb?.uri,
          database: this.config.mongodb?.dbName
        }
      }
    };
  }
}

module.exports = PipelineOrchestrator;



