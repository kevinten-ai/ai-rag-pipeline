# API文档

## 概述

RAG Pipeline 提供了完整的编程接口，支持通过代码方式集成和控制流水线执行。

## 核心类

### RAGPipeline

主入口类，负责初始化和执行流水线。

```javascript
const RAGPipeline = require('./src/index');

// 初始化
const pipeline = new RAGPipeline();
await pipeline.initialize();

// 执行流水线
const result = await pipeline.runPipeline({
  folderTokens: ['folder1', 'folder2'],
  forceFullUpdate: false
});

// 获取状态
const status = pipeline.getStatus();

// 健康检查
const health = await pipeline.healthCheck();

// 清理资源
await pipeline.cleanup();
```

### PipelineOrchestrator

流水线编排器，负责协调各个阶段的执行。

```javascript
const PipelineOrchestrator = require('./src/pipeline-orchestrator');

const orchestrator = new PipelineOrchestrator(config);
await orchestrator.initialize();

// 执行完整流水线
const result = await orchestrator.executePipeline(options);

// 执行单个阶段
const stageResult = await orchestrator.executeStage('clone', stageOptions);

// 获取状态
const status = orchestrator.getExecutionStatus();

// 健康检查
const health = await orchestrator.healthCheck();
```

## 阶段接口

### CloneStage

文档采集阶段。

```javascript
const CloneStage = require('./src/stages/clone-stage');

const stage = new CloneStage(config);
await stage.initialize();

const result = await stage.execute({
  folderTokens: ['folder1'],
  forceFullUpdate: false,
  batchSize: 10
});
```

**输入参数：**
- `folderTokens`: 飞书文件夹token数组
- `forceFullUpdate`: 是否强制全量更新
- `batchSize`: 批处理大小

**输出结果：**
```javascript
{
  stage: 'clone',
  success: true,
  duration: 1500,
  stats: {
    totalDocuments: 100,
    newDocuments: 80,
    cachedDocuments: 20,
    failedDocuments: 0,
    cacheHitRate: 0.2
  },
  documents: [...], // 处理后的文档数组
  errors: [...] // 错误信息数组
}
```

### CleanStage

内容处理阶段。

```javascript
const CleanStage = require('./src/stages/clean-stage');

const stage = new CleanStage(config);
await stage.initialize();

const result = await stage.execute({
  documents: [...], // 从clone阶段获取的文档
  forceReprocess: false,
  batchSize: 10,
  maxConcurrentAiRequests: 5
});
```

**输入参数：**
- `documents`: 文档数组
- `forceReprocess`: 是否强制重新处理
- `batchSize`: 批处理大小
- `maxConcurrentAiRequests`: 最大并发AI请求数

**输出结果：**
```javascript
{
  stage: 'clean',
  success: true,
  duration: 3000,
  stats: {
    totalDocuments: 100,
    aiProcessedDocuments: 80,
    cachedDocuments: 20,
    splitDocuments: 5,
    aiProcessingRate: 0.8,
    cacheHitRate: 0.2
  },
  documents: [...], // AI增强后的文档
  errors: [...]
}
```

### UploadStage

索引构建阶段。

```javascript
const UploadStage = require('./src/stages/upload-stage');

const stage = new UploadStage(config);
await stage.initialize();

const result = await stage.execute({
  documents: [...], // 从clean阶段获取的文档
  forceReindex: false,
  batchSize: 10
});
```

**输入参数：**
- `documents`: 文档数组
- `forceReindex`: 是否强制重新索引
- `batchSize`: 批处理大小

**输出结果：**
```javascript
{
  stage: 'upload',
  success: true,
  duration: 2000,
  stats: {
    totalDocuments: 100,
    embeddedDocuments: 80,
    indexedDocuments: 100,
    cachedEmbeddings: 20,
    embeddingGenerationRate: 0.8,
    indexingSuccessRate: 1.0,
    cacheHitRate: 0.2
  },
  errors: [...]
}
```

## 服务接口

### FeishuClient

飞书API客户端。

```javascript
const FeishuClient = require('./src/services/feishu-client');

const client = new FeishuClient(config);

// 获取文档列表
const documents = await client.getDocuments('folder_token');

// 获取文档内容
const content = await client.getDocumentContent('doc_token');

// 批量获取内容
const results = await client.batchGetDocumentContent(['doc1', 'doc2']);

// 测试连接
const isConnected = await client.testConnection();
```

### OpenAIService

OpenAI服务。

```javascript
const OpenAIService = require('./src/services/openai-service');

const ai = new OpenAIService(config);
await ai.initialize();

// 生成标题
const title = await ai.generateTitle(content, originalTitle);

// 生成摘要
const summary = await ai.generateSummary(content);

// 提取关键词
const keywords = await ai.extractKeywords(content);

// 生成嵌入
const embedding = await ai.generateEmbedding(text);

// 批量生成嵌入
const embeddings = await ai.batchGenerateEmbeddings(texts);
```

### ElasticsearchClient

Elasticsearch客户端。

```javascript
const ElasticsearchClient = require('./src/services/elasticsearch-client');

const es = new ElasticsearchClient(config);
await es.initialize();

// 索引文档
await es.indexDocument(document);

// 批量索引
await es.bulkIndexDocuments(documents);

// 向量搜索
const results = await es.searchByVector(embedding, {
  size: 10,
  minScore: 0.7
});

// 文本搜索
const results = await es.searchByText('query', {
  size: 10,
  filters: { category: 'tech' }
});

// 混合搜索
const results = await es.hybridSearch('query', embedding);

// 获取统计
const stats = await es.getIndexStats();

// 清空索引
await es.clearIndex();
```

### MongoDBCache

MongoDB缓存服务。

```javascript
const MongoDBCache = require('./src/services/mongodb-cache');

const cache = new MongoDBCache(config);
await cache.connect();

// 缓存文档
await cache.cacheDocument(document, processedContent, aiResults);

// 获取缓存
const cached = await cache.getCachedDocument('doc_id');

// 更新AI结果
await cache.updateAIResults('doc_id', aiResults);

// 批量缓存
await cache.batchCacheDocuments(batch);

// 获取统计
const stats = await cache.getCacheStats();

// 清理缓存
await cache.cleanupExpiredCache(30 * 24 * 60 * 60 * 1000); // 30天
```

## 配置接口

### 配置验证

```javascript
const config = require('./src/config/config');

// 验证配置
try {
  config.validate();
  console.log('Configuration is valid');
} catch (error) {
  console.error('Configuration error:', error.message);
}
```

### 配置结构

```javascript
{
  feishu: {
    appId: 'string',
    appSecret: 'string',
    baseUrl: 'string'
  },
  openai: {
    apiKey: 'string',
    baseUrl: 'string',
    model: 'string',
    embeddingModel: 'string'
  },
  elasticsearch: {
    host: 'string',
    username: 'string',
    password: 'string',
    indexName: 'string'
  },
  mongodb: {
    uri: 'string',
    dbName: 'string',
    cacheCollection: 'string'
  },
  docs: {
    name: 'string',
    enableIncremental: boolean,
    forceFullUpdate: boolean
  },
  logging: {
    level: 'string',
    file: 'string'
  },
  performance: {
    maxConcurrentAiRequests: number,
    documentSplitSize: number,
    batchSize: number
  }
}
```

## 错误处理

所有API调用都会返回包含错误信息的结构：

```javascript
{
  success: false,
  error: 'Error message',
  code: 'ERROR_CODE', // 可选
  details: { ... } // 可选的详细信息
}
```

### 常见错误码

- `CONFIG_INVALID`: 配置无效
- `AUTH_FAILED`: 认证失败
- `NETWORK_ERROR`: 网络错误
- `API_LIMIT_EXCEEDED`: API限流
- `DOCUMENT_NOT_FOUND`: 文档不存在
- `INDEX_ERROR`: 索引错误

## 示例代码

### 完整流水线执行

```javascript
const RAGPipeline = require('./src/index');

async function runCompletePipeline() {
  const pipeline = new RAGPipeline();

  try {
    await pipeline.initialize();

    const result = await pipeline.runPipeline({
      folderTokens: ['folder1', 'folder2'],
      forceFullUpdate: false,
      batchSize: 20
    });

    console.log('Pipeline completed:', result.overallStats);

  } catch (error) {
    console.error('Pipeline failed:', error);
  } finally {
    await pipeline.cleanup();
  }
}

runCompletePipeline();
```

### 自定义处理流程

```javascript
const { CloneStage, CleanStage, UploadStage } = require('./src/stages');

async function customPipeline() {
  const config = require('./src/config/config');

  // 初始化阶段
  const cloneStage = new CloneStage(config);
  const cleanStage = new CleanStage(config);
  const uploadStage = new UploadStage(config);

  await Promise.all([
    cloneStage.initialize(),
    cleanStage.initialize(),
    uploadStage.initialize()
  ]);

  try {
    // 执行采集
    const cloneResult = await cloneStage.execute({
      folderTokens: ['folder1']
    });

    // 自定义过滤
    const filteredDocs = cloneResult.documents.filter(doc =>
      doc.metadata.category === 'important'
    );

    // 执行处理
    const cleanResult = await cleanStage.execute({
      documents: filteredDocs,
      forceReprocess: true
    });

    // 执行索引
    const uploadResult = await uploadStage.execute({
      documents: cleanResult.documents
    });

    console.log('Custom pipeline completed');

  } finally {
    // 清理资源
    await Promise.all([
      cloneStage.cleanup(),
      cleanStage.cleanup(),
      uploadStage.cleanup()
    ]);
  }
}
```



