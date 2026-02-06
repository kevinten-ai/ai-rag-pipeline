/**
 * Logging Service
 * 日志服务
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs-extra');

class Logger {
  constructor(config) {
    this.config = config;
    this.logger = null;
    this.init();
  }

  /**
   * 初始化日志系统
   */
  async init() {
    // 确保日志目录存在
    const logDir = path.dirname(this.config.logging.file);
    await fs.ensureDir(logDir);

    // 创建日志格式
    const logFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
        if (Object.keys(meta).length > 0) {
          log += ` ${JSON.stringify(meta)}`;
        }
        return log;
      })
    );

    // 创建传输器
    const transports = [
      new winston.transports.Console({
        level: this.config.logging.level,
        format: winston.format.combine(
          winston.format.colorize(),
          logFormat
        )
      }),
      new winston.transports.File({
        filename: this.config.logging.file,
        level: this.config.logging.level,
        format: logFormat,
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5
      })
    ];

    // 创建logger实例
    this.logger = winston.createLogger({
      level: this.config.logging.level,
      transports
    });

    // 处理未捕获的异常
    this.logger.exceptions.handle(
      new winston.transports.File({
        filename: path.join(logDir, 'exceptions.log')
      })
    );

    // 处理未处理的Promise拒绝
    this.logger.rejections.handle(
      new winston.transports.File({
        filename: path.join(logDir, 'rejections.log')
      })
    );
  }

  /**
   * 记录信息日志
   */
  info(message, meta = {}) {
    if (this.logger) {
      this.logger.info(message, meta);
    }
  }

  /**
   * 记录警告日志
   */
  warn(message, meta = {}) {
    if (this.logger) {
      this.logger.warn(message, meta);
    }
  }

  /**
   * 记录错误日志
   */
  error(message, meta = {}) {
    if (this.logger) {
      this.logger.error(message, meta);
    }
  }

  /**
   * 记录调试日志
   */
  debug(message, meta = {}) {
    if (this.logger) {
      this.logger.debug(message, meta);
    }
  }

  /**
   * 记录流水线开始
   */
  logPipelineStart(pipelineName, config = {}) {
    this.info(`🚀 Pipeline ${pipelineName} started`, {
      pipeline: pipelineName,
      config,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 记录流水线完成
   */
  logPipelineComplete(pipelineName, stats = {}) {
    this.info(`✅ Pipeline ${pipelineName} completed`, {
      pipeline: pipelineName,
      stats,
      duration: stats.duration || 0,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 记录流水线错误
   */
  logPipelineError(pipelineName, error, context = {}) {
    this.error(`❌ Pipeline ${pipelineName} failed`, {
      pipeline: pipelineName,
      error: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 记录文档处理统计
   */
  logDocumentStats(stats = {}) {
    this.info('📊 Document processing statistics', {
      total: stats.total || 0,
      processed: stats.processed || 0,
      failed: stats.failed || 0,
      skipped: stats.skipped || 0,
      cacheHitRate: stats.cacheHitRate || 0,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 记录性能指标
   */
  logPerformanceMetrics(metrics = {}) {
    this.info('📈 Performance metrics', {
      stage: metrics.stage,
      duration: metrics.duration,
      throughput: metrics.throughput,
      memoryUsage: metrics.memoryUsage,
      cpuUsage: metrics.cpuUsage,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 创建子日志器（用于特定模块）
   */
  child(meta = {}) {
    if (this.logger) {
      return this.logger.child(meta);
    }
    return null;
  }
}

// 创建单例实例
let loggerInstance = null;

function getLogger(config) {
  if (!loggerInstance) {
    loggerInstance = new Logger(config);
  }
  return loggerInstance;
}

module.exports = { Logger, getLogger };



