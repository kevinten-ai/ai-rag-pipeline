#!/usr/bin/env node

/**
 * Clone Stage Runner Script
 * 文档采集阶段运行脚本
 */

const RAGPipeline = require('../src/index');

async function main() {
  const ragPipeline = new RAGPipeline();

  try {
    // 获取文件夹tokens
    const folderTokens = process.env.FOLDER_TOKENS?.split(',') ||
                        process.argv.slice(2).filter(arg => !arg.startsWith('--'));

    if (!folderTokens || folderTokens.length === 0) {
      console.error('❌ Error: No folder tokens provided');
      console.log('Usage: node scripts/run-clone.js <folder_token1> [folder_token2] ...');
      console.log('Or set FOLDER_TOKENS environment variable');
      process.exit(1);
    }

    const options = {
      folderTokens,
      forceFullUpdate: process.argv.includes('--force-full'),
      batchSize: parseInt(process.env.BATCH_SIZE) || 10
    };

    console.log('🚀 Starting Clone Stage with options:', options);

    const result = await ragPipeline.runStage('clone', options);

    console.log('✅ Clone Stage completed successfully!');
    console.log('📊 Statistics:', {
      totalDocuments: result.stats?.totalDocuments || 0,
      newDocuments: result.stats?.newDocuments || 0,
      updatedDocuments: result.stats?.updatedDocuments || 0,
      cachedDocuments: result.stats?.cachedDocuments || 0,
      failedDocuments: result.stats?.failedDocuments || 0,
      cacheHitRate: `${(result.stats?.cacheHitRate * 100 || 0).toFixed(1)}%`,
      duration: `${(result.duration / 1000).toFixed(1)}s`
    });

    console.log(`📄 Processed ${result.documents?.length || 0} documents`);

  } catch (error) {
    console.error('💥 Clone Stage execution failed:', error.message);
    process.exit(1);
  } finally {
    await ragPipeline.cleanup();
  }
}

if (require.main === module) {
  main();
}



