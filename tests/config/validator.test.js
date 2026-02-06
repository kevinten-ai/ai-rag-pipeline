/**
 * Config Validator Tests
 * 配置验证器测试
 */

const ConfigValidator = require('../../src/config/validator');

describe('ConfigValidator', () => {
  let validator;
  let validConfig;

  beforeEach(() => {
    validConfig = {
      feishu: {
        appId: 'test_app_id',
        appSecret: 'test_app_secret',
        baseUrl: 'https://open.feishu.cn'
      },
      openai: {
        apiKey: 'test_openai_key',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4',
        embeddingModel: 'text-embedding-ada-002'
      },
      elasticsearch: {
        host: 'https://test-es-host:9200',
        username: 'test_user',
        password: 'test_password',
        indexName: 'test-index'
      },
      mongodb: {
        uri: 'mongodb://localhost:27017',
        dbName: 'test_db',
        cacheCollection: 'test_cache'
      },
      performance: {
        maxConcurrentAiRequests: 5,
        documentSplitSize: 7000,
        batchSize: 10
      }
    };

    validator = new ConfigValidator(validConfig);
  });

  describe('validate()', () => {
    test('should pass validation with valid config', () => {
      expect(() => validator.validate()).not.toThrow();
    });

    test('should throw error with missing feishu config', () => {
      delete validConfig.feishu;
      validator = new ConfigValidator(validConfig);

      expect(() => validator.validate()).toThrow('Configuration validation failed');
      expect(validator.getErrors()).toContain('Feishu configuration is missing');
    });

    test('should throw error with missing feishu appId', () => {
      delete validConfig.feishu.appId;
      validator = new ConfigValidator(validConfig);

      expect(() => validator.validate()).toThrow('Configuration validation failed');
      expect(validator.getErrors()).toContain('FEISHU_APP_ID is required');
    });

    test('should throw error with invalid feishu baseUrl', () => {
      validConfig.feishu.baseUrl = 'invalid-url';
      validator = new ConfigValidator(validConfig);

      expect(() => validator.validate()).toThrow('Configuration validation failed');
      expect(validator.getErrors()).toContain('FEISHU_BASE_URL must be a valid URL');
    });

    test('should throw error with missing openai apiKey', () => {
      delete validConfig.openai.apiKey;
      validator = new ConfigValidator(validConfig);

      expect(() => validator.validate()).toThrow('Configuration validation failed');
      expect(validator.getErrors()).toContain('OPENAI_API_KEY is required');
    });

    test('should throw error with invalid performance config', () => {
      validConfig.performance.maxConcurrentAiRequests = 0;
      validator = new ConfigValidator(validConfig);

      expect(() => validator.validate()).toThrow('Configuration validation failed');
      expect(validator.getErrors()).toContain('MAX_CONCURRENT_AI_REQUESTS must be a positive number');
    });

    test('should throw error with invalid document split size', () => {
      validConfig.performance.documentSplitSize = 500;
      validator = new ConfigValidator(validConfig);

      expect(() => validator.validate()).toThrow('Configuration validation failed');
      expect(validator.getErrors()).toContain('DOCUMENT_SPLIT_SIZE must be at least 1000');
    });
  });

  describe('getErrors()', () => {
    test('should return empty array for valid config', () => {
      validator.validate();
      expect(validator.getErrors()).toHaveLength(0);
    });

    test('should return errors for invalid config', () => {
      delete validConfig.feishu.appId;
      delete validConfig.openai.apiKey;
      validator = new ConfigValidator(validConfig);

      try {
        validator.validate();
      } catch (error) {
        // 忽略异常，只检查错误列表
      }

      const errors = validator.getErrors();
      expect(errors).toContain('FEISHU_APP_ID is required');
      expect(errors).toContain('OPENAI_API_KEY is required');
    });
  });
});



