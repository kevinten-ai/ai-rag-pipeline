# RAG Pipeline Dockerfile
# 基于Node.js官方镜像

FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apk add --no-cache \
    git \
    curl \
    && rm -rf /var/cache/apk/*

# 复制package.json和package-lock.json（如果存在）
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production && npm cache clean --force

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S ragpipeline -u 1001

# 创建日志目录
RUN mkdir -p logs && chown -R ragpipeline:nodejs logs

# 复制应用代码
COPY --chown=ragpipeline:nodejs . .

# 切换到非root用户
USER ragpipeline

# 创建健康检查脚本
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('./src/index').default().healthCheck().then(h => { \
        if (h.status !== 'healthy') { \
            console.error('Health check failed:', h); \
            process.exit(1); \
        } \
        console.log('Health check passed'); \
    }).catch(err => { \
        console.error('Health check error:', err); \
        process.exit(1); \
    })"

# 暴露端口（如果需要API服务）
EXPOSE 3000

# 设置环境变量
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=4096"

# 启动命令
CMD ["npm", "start"]



