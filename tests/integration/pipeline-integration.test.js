/**
 * Pipeline Integration Tests
 * 流水线集成测试
 */

const PipelineOrchestrator = require('../../src/pipeline-orchestrator');

describe('Pipeline Integration', () => {
  let orchestrator;
  let mockConfig;

  beforeEach(() => {
    mockConfig = global.testConfig;

    // Mock all external services
    mockConfig.feishu = { ...mockConfig.feishu, appId: 'test', appSecret: 'test' };
    mockConfig.openai = { ...mockConfig.openai, apiKey: 'test' };
    mockConfig.elasticsearch = { ...mockConfig.elasticsearch };
    mockConfig.mongodb = { ...mockConfig.mongodb };

    orchestrator = new PipelineOrchestrator(mockConfig);
  });

  describe('initialize()', () => {
    test('should initialize all stages', async () => {
      // Mock stage initialization
      orchestrator.stages.clone = { initialize: jest.fn().mockResolvedValue() };
      orchestrator.stages.clean = { initialize: jest.fn().mockResolvedValue() };
      orchestrator.stages.upload = { initialize: jest.fn().mockResolvedValue() };

      await orchestrator.initialize();

      expect(orchestrator.stages.clone.initialize).toHaveBeenCalled();
      expect(orchestrator.stages.clean.initialize).toHaveBeenCalled();
      expect(orchestrator.stages.upload.initialize).toHaveBeenCalled();
    });

    test('should handle initialization errors', async () => {
      orchestrator.stages.clone = {
        initialize: jest.fn().mockRejectedValue(new Error('Clone init failed'))
      };

      await expect(orchestrator.initialize()).rejects.toThrow('Clone init failed');
    });
  });

  describe('executePipeline()', () => {
    beforeEach(async () => {
      // Mock stage implementations
      orchestrator.stages.clone = {
        initialize: jest.fn().mockResolvedValue(),
        execute: jest.fn().mockResolvedValue({
          stage: 'clone',
          success: true,
          duration: 1000,
          stats: {
            totalDocuments: 5,
            newDocuments: 3,
            cachedDocuments: 2,
            cacheHitRate: 0.4
          },
          documents: global.createTestDocuments(3)
        })
      };

      orchestrator.stages.clean = {
        initialize: jest.fn().mockResolvedValue(),
        execute: jest.fn().mockResolvedValue({
          stage: 'clean',
          success: true,
          duration: 2000,
          stats: {
            totalDocuments: 3,
            aiProcessedDocuments: 2,
            cachedDocuments: 1,
            aiProcessingRate: 0.67,
            cacheHitRate: 0.33
          },
          documents: global.createTestDocuments(3).map(doc => ({
            ...doc,
            ai_title: `AI ${doc.title}`,
            summary: `Summary of ${doc.title}`
          }))
        })
      };

      orchestrator.stages.upload = {
        initialize: jest.fn().mockResolvedValue(),
        execute: jest.fn().mockResolvedValue({
          stage: 'upload',
          success: true,
          duration: 1500,
          stats: {
            totalDocuments: 3,
            embeddedDocuments: 2,
            indexedDocuments: 3,
            cachedEmbeddings: 1,
            embeddingGenerationRate: 0.67,
            indexingSuccessRate: 1.0,
            cacheHitRate: 0.33
          }
        })
      };

      await orchestrator.initialize();
    });

    test('should execute complete pipeline successfully', async () => {
      const options = {
        folderTokens: ['folder1'],
        batchSize: 10
      };

      const result = await orchestrator.executePipeline(options);

      expect(result.success).toBe(true);
      expect(result.stages).toHaveProperty('clone');
      expect(result.stages).toHaveProperty('clean');
      expect(result.stages).toHaveProperty('upload');
      expect(result.overallStats).toBeDefined();
      expect(result.overallStats.totalDocuments).toBe(5);
      expect(result.overallStats.processedDocuments).toBe(9); // 3 docs * 3 stages
    });

    test('should pass documents between stages', async () => {
      const options = { folderTokens: ['folder1'] };

      await orchestrator.executePipeline(options);

      // Verify documents are passed from clone to clean
      expect(orchestrator.stages.clean.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          documents: expect.any(Array),
          batchSize: expect.any(Number)
        })
      );

      // Verify documents are passed from clean to upload
      expect(orchestrator.stages.upload.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          documents: expect.any(Array),
          batchSize: expect.any(Number)
        })
      );
    });

    test('should handle stage failures gracefully when failFast is false', async () => {
      orchestrator.stages.clean.execute.mockRejectedValue(new Error('Clean stage failed'));

      const options = {
        folderTokens: ['folder1'],
        failFast: false
      };

      const result = await orchestrator.executePipeline(options);

      expect(result.success).toBe(true); // Overall success despite clean stage failure
      expect(result.stages.clean.success).toBe(false);
      expect(result.stages.clean.error).toBe('Clean stage failed: Clean stage failed');
    });

    test('should fail fast when failFast is true', async () => {
      orchestrator.stages.clone.execute.mockRejectedValue(new Error('Clone stage failed'));

      const options = {
        folderTokens: ['folder1'],
        failFast: true
      };

      await expect(orchestrator.executePipeline(options)).rejects.toThrow('Clone stage failed');
    });

    test('should skip specified stages', async () => {
      const options = {
        folderTokens: ['folder1'],
        skipStages: ['clean']
      };

      await orchestrator.executePipeline(options);

      expect(orchestrator.stages.clone.execute).toHaveBeenCalled();
      expect(orchestrator.stages.clean.execute).not.toHaveBeenCalled();
      expect(orchestrator.stages.upload.execute).toHaveBeenCalled();
    });
  });

  describe('calculateOverallStats()', () => {
    test('should calculate correct overall statistics', async () => {
      orchestrator.executionState.stageResults = {
        clone: {
          success: true,
          stats: { totalDocuments: 10, cacheHitRate: 0.5 }
        },
        clean: {
          success: true,
          stats: { totalDocuments: 8, aiProcessingRate: 0.75 }
        },
        upload: {
          success: true,
          stats: { totalDocuments: 8, indexingSuccessRate: 0.9 }
        }
      };

      orchestrator.calculateOverallStats();

      expect(orchestrator.executionState.overallStats.totalDocuments).toBe(10);
      expect(orchestrator.executionState.overallStats.cacheHitRate).toBe(0.5);
      expect(orchestrator.executionState.overallStats.aiProcessingRate).toBe(0.75);
      expect(orchestrator.executionState.overallStats.indexingSuccessRate).toBe(0.9);
    });
  });

  describe('healthCheck()', () => {
    test('should return healthy status when all stages are healthy', async () => {
      // Mock stage health checks
      orchestrator.stages.clone = { execute: jest.fn() };
      orchestrator.stages.clean = { execute: jest.fn() };
      orchestrator.stages.upload = { execute: jest.fn() };

      const health = await orchestrator.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.pipeline.stages).toHaveProperty('clone');
      expect(health.pipeline.stages).toHaveProperty('clean');
      expect(health.pipeline.stages).toHaveProperty('upload');
    });
  });
});



