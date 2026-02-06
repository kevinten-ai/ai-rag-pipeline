# 部署指南

本文档提供了RAG Pipeline的完整部署指南，包括本地开发环境、生产环境部署和监控配置。

## 📋 前置要求

### 系统要求

- **操作系统**: Linux/Windows/macOS
- **内存**: 至少4GB RAM（推荐8GB+）
- **磁盘**: 至少10GB可用空间
- **网络**: 稳定的互联网连接

### 依赖服务

- **Node.js**: 18.0.0 或更高版本
- **MongoDB**: 4.0 或更高版本
- **Elasticsearch**: 8.0 或更高版本
- **Docker**: 20.10+ （可选，用于容器化部署）

### 外部服务

- **飞书应用**: 有效的App ID和App Secret
- **OpenAI API**: 有效的API Key和充足的额度

## 🚀 快速开始

### 方式1：使用Docker Compose（推荐）

1. **克隆项目**
```bash
git clone <repository-url>
cd ai-rag-pipeline
```

2. **配置环境变量**
```bash
cp .env.example .env
# 编辑 .env 文件，填入实际的配置信息
```

3. **启动服务**
```bash
docker-compose up -d
```

4. **验证部署**
```bash
# 检查服务状态
docker-compose ps

# 查看日志
docker-compose logs -f rag-pipeline

# 测试健康检查
curl http://localhost:3000/health
```

### 方式2：手动部署

1. **安装依赖**
```bash
npm install
```

2. **配置环境**
```bash
cp src/config/config.example.js src/config/config.js
# 编辑配置文件
```

3. **启动依赖服务**
```bash
# MongoDB
mongod --dbpath /path/to/mongodb/data

# Elasticsearch
./bin/elasticsearch
```

4. **运行应用**
```bash
npm start
```

## ⚙️ 配置详解

### 环境变量配置

创建 `.env` 文件：

```bash
# 飞书配置
FEISHU_APP_ID=your_feishu_app_id
FEISHU_APP_SECRET=your_feishu_app_secret
FEISHU_BASE_URL=https://open.feishu.cn

# OpenAI配置
OPENAI_API_KEY=your_openai_api_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4
OPENAI_EMBEDDING_MODEL=text-embedding-ada-002

# Elasticsearch配置
ES_HOST=http://localhost:9200
ES_USERNAME=elastic
ES_PASSWORD=your_elastic_password
ES_INDEX_NAME=rag-knowledge-base

# MongoDB配置
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=rag_pipeline
MONGODB_CACHE_COLLECTION=file_cache

# 应用配置
DOCS_NAME=feishu-docs
ENABLE_INCREMENTAL=true
FORCE_FULL_UPDATE=false

# 性能配置
MAX_CONCURRENT_AI_REQUESTS=5
DOCUMENT_SPLIT_SIZE=7000
BATCH_SIZE=10

# 日志配置
LOG_LEVEL=info
LOG_FILE=logs/pipeline.log
```

### 飞书应用配置

1. **访问飞书开发者平台**
   - 前往 https://open.feishu.cn/
   - 创建企业自建应用

2. **配置应用权限**
   - 添加以下权限：
     - `drive.file.read` - 读取文档内容
     - `drive.file.meta` - 读取文档元数据
     - `drive.dir.read` - 读取文件夹内容

3. **获取应用凭据**
   - App ID
   - App Secret

4. **配置文档访问**
   - 将应用添加到需要访问的文档空间
   - 获取文件夹的token

### Elasticsearch配置

1. **安装Elasticsearch**
```bash
# 使用Docker
docker run -d --name elasticsearch \
  -p 9200:9200 -p 9300:9300 \
  -e "discovery.type=single-node" \
  -e "xpack.security.enabled=false" \
  elasticsearch:8.11.0
```

2. **配置安全设置**（生产环境）
```yaml
# elasticsearch.yml
xpack.security.enabled: true
xpack.security.http.ssl.enabled: true
```

3. **创建用户**
```bash
# 设置内置用户密码
./bin/elasticsearch-setup-passwords interactive
```

### MongoDB配置

1. **安装MongoDB**
```bash
# 使用Docker
docker run -d --name mongodb \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password \
  mongo:6.0
```

2. **创建数据库用户**
```javascript
// 连接到MongoDB
mongosh

// 创建用户
use rag_pipeline
db.createUser({
  user: 'rag_user',
  pwd: 'rag_password',
  roles: ['readWrite']
})
```

## 🏭 生产环境部署

### 使用Docker Compose

1. **生产环境配置**
```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  rag-pipeline:
    image: rag-pipeline:latest
    environment:
      - NODE_ENV=production
    env_file:
      - .env.prod
    secrets:
      - openai_api_key
      - feishu_secret
```

2. **使用secrets管理敏感信息**
```yaml
# 创建secrets
echo "your_openai_key" | docker secret create openai_api_key -
echo "your_feishu_secret" | docker secret create feishu_secret -
```

3. **部署命令**
```bash
# 构建生产镜像
docker-compose -f docker-compose.prod.yml build

# 部署
docker-compose -f docker-compose.prod.yml up -d

# 零停机更新
docker-compose -f docker-compose.prod.yml up -d --no-deps rag-pipeline
```

### 使用Kubernetes

1. **创建ConfigMap**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: rag-pipeline-config
data:
  ES_HOST: "http://elasticsearch:9200"
  MONGODB_URI: "mongodb://mongodb:27017"
  # ... 其他非敏感配置
```

2. **创建Secret**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: rag-pipeline-secrets
type: Opaque
data:
  OPENAI_API_KEY: <base64-encoded-key>
  FEISHU_APP_SECRET: <base64-encoded-secret>
```

3. **部署Deployment**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rag-pipeline
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: rag-pipeline
        image: rag-pipeline:latest
        envFrom:
        - configMapRef:
            name: rag-pipeline-config
        - secretRef:
            name: rag-pipeline-secrets
```

## 📊 监控和日志

### 应用监控

1. **健康检查端点**
```bash
# 健康检查
GET /health

# 详细状态
GET /status

# 指标收集（可选）
GET /metrics
```

2. **日志配置**
```javascript
// 日志轮转
const winston = require('winston');
require('winston-daily-rotate-file');

const transport = new winston.transports.DailyRotateFile({
  filename: 'logs/application-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d'
});
```

### 基础设施监控

1. **Prometheus配置**
```yaml
scrape_configs:
  - job_name: 'rag-pipeline'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

2. **Grafana仪表板**
   - 导入提供的仪表板JSON
   - 配置数据源连接Prometheus
   - 设置告警规则

### 日志聚合

1. **ELK Stack集成**
```javascript
// 发送日志到Logstash
const winston = require('winston');
require('winston-logstash');

const logstashTransport = new winston.transports.Logstash({
  host: 'logstash-host',
  port: 5044
});
```

2. **结构化日志**
```javascript
logger.info('Pipeline completed', {
  pipelineId: 'xxx',
  duration: 1500,
  documentsProcessed: 100,
  errors: 0
});
```

## 🔧 维护和升级

### 备份策略

1. **数据库备份**
```bash
# MongoDB备份
mongodump --db rag_pipeline --out /backup/mongodb

# Elasticsearch快照
curl -X PUT "localhost:9200/_snapshot/my_backup/snapshot_1?wait_for_completion=true"
```

2. **配置备份**
```bash
# 备份配置文件
cp .env .env.backup
cp src/config/config.js config.backup.js
```

### 升级流程

1. **备份当前版本**
```bash
docker tag rag-pipeline:latest rag-pipeline:backup-$(date +%Y%m%d)
```

2. **更新代码**
```bash
git pull origin main
npm install
npm run build
```

3. **构建新镜像**
```bash
docker-compose build --no-cache rag-pipeline
```

4. **滚动更新**
```bash
docker-compose up -d rag-pipeline
```

5. **验证更新**
```bash
docker-compose logs rag-pipeline
curl http://localhost:3000/health
```

### 性能优化

1. **JVM调优**（Elasticsearch）
```yaml
# elasticsearch.yml
bootstrap.memory_lock: true
ES_JAVA_OPTS: "-Xms4g -Xmx4g"
```

2. **Node.js优化**
```javascript
// 增加内存限制
node --max-old-space-size=4096 app.js

// 启用集群模式
const cluster = require('cluster');
if (cluster.isMaster) {
  // 创建工作进程
}
```

3. **缓存优化**
```javascript
// 连接池配置
const mongoose = require('mongoose');
mongoose.connect(uri, {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
});
```

## 🚨 故障排除

### 常见问题

1. **内存不足**
```
Error: JavaScript heap out of memory
```
解决：增加Node.js内存限制
```bash
node --max-old-space-size=8192 app.js
```

2. **Elasticsearch连接失败**
```
Error: connect ECONNREFUSED 127.0.0.1:9200
```
解决：检查Elasticsearch服务状态和网络配置

3. **MongoDB认证失败**
```
Authentication failed
```
解决：验证用户名、密码和数据库权限

4. **飞书API限流**
```
Error: API rate limit exceeded
```
解决：减少并发请求数或实现重试机制

### 调试模式

1. **启用详细日志**
```bash
LOG_LEVEL=debug npm start
```

2. **调试特定组件**
```javascript
// 启用调试日志
process.env.DEBUG = 'rag-pipeline:*';
```

3. **性能分析**
```bash
# 使用clinic.js
npm install -g clinic
clinic doctor -- npm start
```

## 🔒 安全配置

### API密钥管理

1. **使用环境变量**
```bash
# 不要硬编码密钥
// ❌ 错误
const apiKey = 'sk-...';

// ✅ 正确
const apiKey = process.env.OPENAI_API_KEY;
```

2. **密钥轮换**
```bash
# 更新密钥后重启服务
docker-compose restart rag-pipeline
```

### 网络安全

1. **防火墙配置**
```bash
# 只开放必要端口
ufw allow 9200/tcp  # Elasticsearch
ufw allow 27017/tcp # MongoDB
ufw allow 3000/tcp  # 应用端口
```

2. **HTTPS配置**
```javascript
// 使用HTTPS
const https = require('https');
const server = https.createServer(credentials, app);
```

### 数据加密

1. **传输加密**
```javascript
// 启用TLS
const mongoose = require('mongoose');
mongoose.connect(uri, {
  tls: true,
  tlsCAFile: '/path/to/ca.pem'
});
```

2. **静态加密**
```javascript
// 敏感数据加密存储
const crypto = require('crypto');
const encrypted = crypto.createCipher('aes-256-cbc', key);
```

## 📞 支持和维护

### 监控告警

1. **设置告警规则**
   - 内存使用率 > 80%
   - 磁盘使用率 > 85%
   - API响应时间 > 5秒
   - 错误率 > 5%

2. **日志监控**
   - 搜索ERROR级别日志
   - 监控关键业务指标
   - 设置日志轮转和归档

### 定期维护

1. **每日检查**
   - 服务健康状态
   - 磁盘使用情况
   - 备份文件完整性

2. **每周维护**
   - 日志轮转
   - 缓存清理
   - 性能优化

3. **每月维护**
   - 安全更新
   - 依赖升级
   - 配置审核

---

**最后更新**: 2025年11月27日



