/**
 * Jest Setup File
 * 测试设置文件
 */

// 设置测试环境变量
process.env.NODE_ENV = 'test';

// 模拟环境变量（测试用）
process.env.FEISHU_APP_ID = 'test_app_id';
process.env.FEISHU_APP_SECRET = 'test_app_secret';
process.env.OPENAI_API_KEY = 'test_openai_key';
process.env.ES_HOST = 'http://localhost:9200';
process.env.ES_USERNAME = 'test_user';
process.env.ES_PASSWORD = 'test_password';
process.env.MONGODB_URI = 'mongodb://localhost:27017';
process.env.MONGODB_DB_NAME = 'test_rag_pipeline';

// 全局测试工具
global.testConfig = {
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
    host: 'http://localhost:9200',
    username: 'test_user',
    password: 'test_password',
    indexName: 'test-rag-knowledge-base'
  },
  mongodb: {
    uri: 'mongodb://localhost:27017',
    dbName: 'test_rag_pipeline',
    cacheCollection: 'test_file_cache'
  },
  docs: {
    name: 'test-docs',
    enableIncremental: true,
    forceFullUpdate: false
  },
  logging: {
    level: 'error', // 测试时只显示错误日志
    file: 'logs/test.log'
  },
  performance: {
    maxConcurrentAiRequests: 2, // 测试时降低并发
    documentSplitSize: 1000, // 测试时使用更小的拆分大小
    batchSize: 2 // 测试时使用更小的批大小
  }
};

// 测试辅助函数
global.createTestDocument = (overrides = {}) => ({
  id: `test_doc_${Date.now()}`,
  name: 'Test Document.md',
  type: 'doc',
  content: 'This is a test document content for testing purposes.',
  title: 'Test Document',
  created_time: new Date().toISOString(),
  modified_time: new Date().toISOString(),
  owner_id: 'test_owner',
  source: 'feishu',
  ...overrides
});

global.createTestDocuments = (count = 3) => {
  return Array.from({ length: count }, (_, i) =>
    createTestDocument({
      id: `test_doc_${i + 1}`,
      name: `Test Document ${i + 1}.md`,
      content: `This is test document content ${i + 1} for testing purposes.`
    })
  );
};

// Mock 外部依赖
jest.mock('../src/services/logger', () => ({
  getLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    }))
  })
}));

// 清理函数
global.cleanupTestResources = async () => {
  // 这里可以添加清理测试资源的逻辑
  // 比如清理测试数据库、索引等
};

// 在所有测试结束后清理
afterAll(async () => {
  await cleanupTestResources();
});



