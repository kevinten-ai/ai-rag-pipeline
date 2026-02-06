#!/usr/bin/env node

/**
 * Clean Stage Runner Script
 * 内容处理阶段运行脚本
 */

const RAGPipeline = require('../src/index');
const fs = require('fs');

async function main() {
  const ragPipeline = new RAGPipeline();

  try {
    let documents = [];

    // 从文件或stdin读取文档数据
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
        console.log('Usage: node scripts/run-clean.js --docs=<json> or --input=<file>');
        console.log('Or set INPUT_FILE environment variable');
        process.exit(1);
      }
    }

    const options = {
      documents,
      forceReprocess: process.argv.includes('--force'),
      batchSize: parseInt(process.env.BATCH_SIZE) || 10,
      maxConcurrentAiRequests: parseInt(process.env.MAX_CONCURRENT_AI_REQUESTS) || 5
    };

    console.log(`🚀 Starting Clean Stage with ${documents.length} documents`);

    const result = await ragPipeline.runStage('clean', options);

    console.log('✅ Clean Stage completed successfully!');
    console.log('📊 Statistics:', {
      totalDocuments: result.stats?.totalDocuments || 0,
      aiProcessedDocuments: result.stats?.aiProcessedDocuments || 0,
      cachedDocuments: result.stats?.cachedDocuments || 0,
      splitDocuments: result.stats?.splitDocuments || 0,
      failedDocuments: result.stats?.failedDocuments || 0,
      aiProcessingRate: `${(result.stats?.aiProcessingRate * 100 || 0).toFixed(1)}%`,
      cacheHitRate: `${(result.stats?.cacheHitRate * 100 || 0).toFixed(1)}%`,
      duration: `${(result.duration / 1000).toFixed(1)}s`
    });

    console.log(`📄 Final document count: ${result.documents?.length || 0}`);

    // 如果指定了输出文件，保存结果
    const outputFile = process.argv.find(arg => arg.startsWith('--output='))?.split('=')[1];
    if (outputFile) {
      fs.writeFileSync(outputFile, JSON.stringify(result.documents, null, 2));
      console.log(`💾 Results saved to ${outputFile}`);
    }

  } catch (error) {
    console.error('💥 Clean Stage execution failed:', error.message);
    process.exit(1);
  } finally {
    await ragPipeline.cleanup();
  }
}

if (require.main === module) {
  main();
}



