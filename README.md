# AI RAG Pipeline - 飞书文档知识库构建系统

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-ISC-blue)](LICENSE)

## 📖 项目简介

AI RAG Pipeline 是一个企业级的AI驱动文档处理平台，通过三阶段流水线架构和增量更新机制，实现了从飞书文档到RAG知识库的高效转换。该系统巧妙地解决了文档处理自动化与AI增强之间的核心矛盾，是现代企业知识管理系统的核心基础设施。

## 🏗️ 核心架构

### 三阶段流水线架构

```
飞书文档 → Clone阶段 → Clean阶段 → Upload阶段 → RAG知识库
    ↓          ↓           ↓           ↓           ↓
  原始文档   文档采集    AI增强     向量索引    语义搜索
```

#### 第一阶段：Clone阶段 (文档采集)
- 智能飞书文档采集器
- 增量变更检测机制
- 文档预处理和格式标准化

#### 第二阶段：Clean阶段 (内容增强)
- AI驱动的内容分析和元数据生成
- 文档智能拆分，按token限制处理超长文档
- 内容质量优化和格式清理

#### 第三阶段：Upload阶段 (索引构建)
- 向量嵌入生成和存储
- Elasticsearch索引构建和优化
- 搜索服务集成和部署

## 🚀 快速开始

### 环境要求

- Node.js >= 18.0.0
- MongoDB >= 4.0
- Elasticsearch >= 8.0
- OpenAI API Key

### 安装步骤

1. **克隆项目**
```bash
git clone https://github.com/kevinten-business/ai-rag-pipeline.git
cd ai-rag-pipeline
```

2. **安装依赖**
```bash
npm install
```

3. **配置环境变量**

复制配置文件并填写实际值：
```bash
cp src/config/config.example.js src/config/config.js
# 或设置环境变量
cp .env.example .env
```

必需的配置项：
- 飞书应用ID和密钥
- OpenAI API Key
- Elasticsearch连接信息
- MongoDB连接信息

4. **验证配置**
```bash
node -e "require('./src/config/config').validate()"
```

5. **运行流水线**
```bash
# 运行完整流水线
npm run pipeline

# 或分别运行各阶段
npm run clone    # 文档采集
npm run clean    # 内容处理
npm run upload   # 索引构建
```

## ⚙️ 配置说明

### 环境变量配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `FEISHU_APP_ID` | 飞书应用ID | 必填 |
| `FEISHU_APP_SECRET` | 飞书应用密钥 | 必填 |
| `OPENAI_API_KEY` | OpenAI API密钥 | 必填 |
| `ES_HOST` | Elasticsearch主机地址 | 必填 |
| `ES_USERNAME` | Elasticsearch用户名 | 必填 |
| `ES_PASSWORD` | Elasticsearch密码 | 必填 |
| `MONGODB_URI` | MongoDB连接URI | mongodb://localhost:27017 |

### 性能调优参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `MAX_CONCURRENT_AI_REQUESTS` | 最大并发AI请求数 | 5 |
| `DOCUMENT_SPLIT_SIZE` | 文档拆分大小(token) | 7000 |
| `BATCH_SIZE` | 批量处理大小 | 10 |

## 📊 核心特性

### 增量更新机制
- **智能缓存**: 基于文件哈希的变更检测
- **性能优化**: 避免重复处理，提升效率80-95%
- **状态管理**: MongoDB缓存文件处理状态

### AI增强处理
- **标题生成**: GPT模型自动生成高质量标题
- **内容摘要**: 智能提取文档关键信息
- **关键词提取**: 自动标注文档关键词
- **文档拆分**: 智能处理超长文档

### 向量搜索集成
- **Embedding生成**: OpenAI text-embedding-ada-002
- **Elasticsearch集成**: 高性能向量相似度搜索
- **语义检索**: 支持自然语言查询

## 🛠️ 使用命令

### 基本命令

```bash
# 开发模式（带热重载）
npm run dev

# 生产模式启动
npm start

# 运行测试
npm test

# 代码检查和格式化
npm run lint

# 构建检查（lint + test）
npm run build
```

### 流水线命令

```bash
# 完整流水线（推荐）
npm run pipeline -- --folders "folder1,folder2"

# 或使用环境变量
FOLDER_TOKENS="folder1,folder2" npm run pipeline

# 单独运行阶段
npm run clone -- --folders "folder1"          # 文档采集
npm run clean -- --input processed_docs.json  # 内容处理
npm run upload -- --input clean_docs.json     # 索引构建

# 强制更新模式
npm run pipeline -- --force-full              # 强制全量更新
npm run pipeline -- --force-reprocess         # 强制重新处理AI内容
npm run pipeline -- --force-reindex           # 强制重新索引

# 调试模式
DEBUG=true npm run pipeline                   # 启用详细日志
```

### 脚本命令

```bash
# 使用脚本运行（支持更多选项）
node scripts/run-pipeline.js folder1 folder2
node scripts/run-clone.js folder1
node scripts/run-clean.js --input docs.json --output processed.json
node scripts/run-upload.js --input processed.json

# 环境变量配置
export FOLDER_TOKENS="folder1,folder2"
export BATCH_SIZE=20
export MAX_CONCURRENT_AI_REQUESTS=3
node scripts/run-pipeline.js
```

## 📈 性能监控

系统提供完整的性能监控和日志记录：

- **处理统计**: 文档数量、处理时间、成功率
- **缓存命中率**: 增量更新的缓存利用率
- **AI调用统计**: API使用量和成本监控
- **错误日志**: 详细的错误记录和告警

## 🚀 Docker部署

### 使用Docker Compose（推荐）

1. **准备环境文件**
```bash
# 复制环境配置
cp .env.example .env

# 编辑环境变量
nano .env
```

2. **启动服务**
```bash
# 生产环境
docker-compose up -d

# 开发环境
docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d

# 只启动核心服务（不包含监控）
docker-compose up -d rag-pipeline mongodb elasticsearch
```

3. **查看日志**
```bash
# 查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f rag-pipeline
```

4. **停止服务**
```bash
docker-compose down
```

### 手动Docker部署

```bash
# 构建镜像
docker build -t rag-pipeline .

# 运行容器
docker run -d \
  --name rag-pipeline \
  --env-file .env \
  -v $(pwd)/logs:/app/logs \
  rag-pipeline
```

### 扩展开发

#### 添加新的文档源

1. **实现新的处理器类**：
```javascript
const FeishuDocumentProcessor = require('../services/feishu-processor');

class NewSourceProcessor extends FeishuDocumentProcessor {
  async processDocument(document, content) {
    // 实现特定文档源的处理逻辑
    return this.processDocument(document, content);
  }
}
```

2. **注册到CloneManager**：
```javascript
// 在 CloneStage 中添加
if (source.type === 'newsource') {
  const NewSourceProcessor = require('../processors/NewSourceProcessor');
  processor = new NewSourceProcessor(this.config);
}
```

#### 自定义AI处理能力

1. **扩展OpenAI服务**：
```javascript
// 在 OpenAIService 中添加新方法
async customAIProcessing(content, options) {
  // 自定义AI处理逻辑
}
```

2. **支持其他AI提供商**：
```javascript
class CustomAIProvider {
  async generateEmbedding(text) {
    // 调用其他AI服务
    return embeddingVector;
  }
}
```

#### 扩展上传策略

1. **实现新的索引策略**：
```javascript
class CustomUploadStrategy {
  async execute(documents, config) {
    // 自定义索引逻辑
    return { successCount: documents.length };
  }
}
```

2. **注册策略**：
```javascript
// 在 UploadStage 中选择策略
const strategy = new CustomUploadStrategy();
await strategy.execute(documents, this.config);
```

## 🐛 故障排除

### 常见问题

- **飞书API认证失败**: 检查应用ID和密钥配置
- **OpenAI API限流**: 调整并发请求数
- **Elasticsearch连接失败**: 验证网络和认证信息
- **MongoDB连接错误**: 检查连接字符串和权限

### 调试模式

```bash
# 启用详细日志
DEBUG=true npm run pipeline

# 单独运行阶段调试
node scripts/run-clone.js
```

## 📚 API文档

详细的API文档请参考 [docs/api.md](docs/api.md)

## 🤝 贡献指南

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 ISC 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🙏 致谢

- OpenAI - 提供强大的AI能力
- Elasticsearch - 优秀的搜索引擎
- 飞书 - 优质的协作平台

---

**技术栈**: Node.js, OpenAI, Elasticsearch, MongoDB, 飞书API

**应用场景**: 企业知识库构建, AI问答系统, 文档智能检索