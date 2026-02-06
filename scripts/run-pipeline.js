#!/usr/bin/env node

/**
 * Pipeline Runner Script
 * 流水线运行脚本
 */

const RAGPipeline = require('../src/index');

async function main() {
  const ragPipeline = new RAGPipeline();

  try {
    // 从环境变量或命令行参数获取配置
    const folderTokens = process.env.FOLDER_TOKENS?.split(',') ||
                        process.argv.slice(2).filter(arg => !arg.startsWith('--'));

    if (!folderTokens || folderTokens.length === 0) {
      console.error('❌ Error: No folder tokens provided');
      console.log('Usage: node scripts/run-pipeline.js <folder_token1> [folder_token2] ...');
      console.log('Or set FOLDER_TOKENS environment variable');
      process.exit(1);
    }

    // 解析命令行选项
    const options = {
      folderTokens,
      forceFullUpdate: process.argv.includes('--force-full'),
      forceReprocess: process.argv.includes('--force-reprocess'),
      forceReindex: process.argv.includes('--force-reindex'),
      batchSize: parseInt(process.env.BATCH_SIZE) || 10,
      maxConcurrentAiRequests: parseInt(process.env.MAX_CONCURRENT_AI_REQUESTS) || 5
    };

    console.log('🚀 Starting RAG Pipeline with options:', options);

    // 执行流水线
    const result = await ragPipeline.runPipeline(options);

    console.log('✅ Pipeline completed successfully!');
    console.log('📊 Overall Statistics:', {
      totalDocuments: result.overallStats?.totalDocuments || 0,
      processedDocuments: result.overallStats?.processedDocuments || 0,
      failedDocuments: result.overallStats?.failedDocuments || 0,
      cacheHitRate: `${(result.overallStats?.cacheHitRate * 100 || 0).toFixed(1)}%`,
      aiProcessingRate: `${(result.overallStats?.aiProcessingRate * 100 || 0).toFixed(1)}%`,
      indexingSuccessRate: `${(result.overallStats?.indexingSuccessRate * 100 || 0).toFixed(1)}%`,
      totalDuration: `${(result.duration / 1000).toFixed(1)}s`
    });

    // 打印各阶段统计
    console.log('\n📈 Stage Statistics:');
    for (const [stageName, stageResult] of Object.entries(result.stages)) {
      if (stageResult.success) {
        console.log(`  ${stageName}: ${stageResult.documents?.length || 0} docs, ${(stageResult.duration / 1000).toFixed(1)}s`);
      } else {
        console.log(`  ${stageName}: ❌ Failed - ${stageResult.error}`);
      }
    }

  } catch (error) {
    console.error('💥 Pipeline execution failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await ragPipeline.cleanup();
  }
}

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error.message);
  console.error(error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

if (require.main === module) {
  main();
}



