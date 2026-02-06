#!/usr/bin/env node

/**
 * Upload Stage Runner Script
 * 索引构建阶段运行脚本
 */

const RAGPipeline = require('../src/index');
const fs = require('fs');

async function main() {
  const ragPipeline = new RAGPipeline();

  try {
    let documents = [];

    // 从文件或参数读取文档数据
    const inputFile = process.argv.find(arg => arg.startsWith('--input='))?.split('=')[1] ||
                     process.env.INPUT_FILE;

    if (inputFile) {
      // 从文件读取
      const data = fs.readFileSync(inputFile, 'utf8');
      documents = JSON.parse(data);
    } else {
      // 检查是否有文档数据作为参数
      const docArg = process.argv.find(arg => arg.startsWith('--docs='));
      if (docArg) {
        documents = JSON.parse(docArg.split('=')[1]);
      } else {
        console.error('❌ Error: No documents provided');
        console.log('Usage: node scripts/run-upload.js --docs=<json> or --input=<file>');
        console.log('Or set INPUT_FILE environment variable');
        process.exit(1);
      }
    }

    const options = {
      documents,
      forceReindex: process.argv.includes('--force'),
      batchSize: parseInt(process.env.BATCH_SIZE) || 10,
      maxConcurrentEmbeddings: parseInt(process.env.MAX_CONCURRENT_AI_REQUESTS) || 5
    };

    console.log(`🚀 Starting Upload Stage with ${documents.length} documents`);

    const result = await ragPipeline.runStage('upload', options);

    console.log('✅ Upload Stage completed successfully!');
    console.log('📊 Statistics:', {
      totalDocuments: result.stats?.totalDocuments || 0,
      embeddedDocuments: result.stats?.embeddedDocuments || 0,
      indexedDocuments: result.stats?.indexedDocuments || 0,
      cachedEmbeddings: result.stats?.cachedEmbeddings || 0,
      failedDocuments: result.stats?.failedDocuments || 0,
      embeddingGenerationRate: `${(result.stats?.embeddingGenerationRate * 100 || 0).toFixed(1)}%`,
      indexingSuccessRate: `${(result.stats?.indexingSuccessRate * 100 || 0).toFixed(1)}%`,
      cacheHitRate: `${(result.stats?.cacheHitRate * 100 || 0).toFixed(1)}%`,
      duration: `${(result.duration / 1000).toFixed(1)}s`
    });

  } catch (error) {
    console.error('💥 Upload Stage execution failed:', error.message);
    process.exit(1);
  } finally {
    await ragPipeline.cleanup();
  }
}

if (require.main === module) {
  main();
}



