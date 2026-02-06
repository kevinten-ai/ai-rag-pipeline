/**
 * MongoDB Cache Service Tests
 * MongoDB缓存服务测试
 */

const MongoDBCache = require('../../src/services/mongodb-cache');

describe('MongoDBCache', () => {
  let cache;
  let mockConfig;

  beforeEach(() => {
    mockConfig = global.testConfig;
    cache = new MongoDBCache(mockConfig);

    // Mock MongoDB client
    cache.client = {
      connect: jest.fn().mockResolvedValue(),
      close: jest.fn().mockResolvedValue(),
      db: jest.fn(() => ({
        collection: jest.fn(() => ({
          createIndex: jest.fn().mockResolvedValue(),
          findOne: jest.fn(),
          replaceOne: jest.fn().mockResolvedValue({}),
          updateOne: jest.fn().mockResolvedValue({}),
          deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
          deleteMany: jest.fn().mockResolvedValue({ deletedCount: 5 }),
          find: jest.fn(() => ({
            sort: jest.fn(() => ({
              toArray: jest.fn().mockResolvedValue([])
            }))
          })),
          bulkWrite: jest.fn().mockResolvedValue({
            insertedCount: 2,
            modifiedCount: 1,
            upsertedCount: 0
          })
        })),
        admin: jest.fn(() => ({
          ping: jest.fn().mockResolvedValue()
        }))
      }))
    };

    cache.db = cache.client.db();
  });

  afterEach(async () => {
    await cache.disconnect();
  });

  describe('connect()', () => {
    test('should connect successfully', async () => {
      cache.isConnected = false;
      await cache.connect();

      expect(cache.client.connect).toHaveBeenCalled();
      expect(cache.isConnected).toBe(true);
    });

    test('should not reconnect if already connected', async () => {
      cache.isConnected = true;
      await cache.connect();

      expect(cache.client.connect).not.toHaveBeenCalled();
    });
  });

  describe('calculateHash()', () => {
    test('should calculate consistent hash for same content', () => {
      const content = { test: 'data', number: 123 };
      const hash1 = cache.calculateHash(content);
      const hash2 = cache.calculateHash(content);

      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
      expect(hash1.length).toBe(32); // MD5 hash length
    });

    test('should calculate different hashes for different content', () => {
      const content1 = { test: 'data1' };
      const content2 = { test: 'data2' };

      const hash1 = cache.calculateHash(content1);
      const hash2 = cache.calculateHash(content2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('cacheDocument()', () => {
    test('should cache document successfully', async () => {
      const document = global.createTestDocument();
      const processedContent = { title: 'Processed Title', content: 'Processed content' };
      const aiResults = { ai_title: 'AI Title', summary: 'AI summary' };

      await cache.cacheDocument(document, processedContent, aiResults);

      expect(cache.db.collection().replaceOne).toHaveBeenCalled();
    });

    test('should handle caching errors', async () => {
      cache.db.collection().replaceOne.mockRejectedValue(new Error('Cache error'));

      const document = global.createTestDocument();

      await expect(cache.cacheDocument(document, {}, {})).rejects.toThrow('Cache error');
    });
  });

  describe('getCachedDocument()', () => {
    test('should return cached document', async () => {
      const mockDocument = { id: 'test_doc', hash: 'test_hash' };
      cache.db.collection().findOne.mockResolvedValue(mockDocument);

      const result = await cache.getCachedDocument('test_doc');

      expect(result).toEqual(mockDocument);
      expect(cache.db.collection().findOne).toHaveBeenCalledWith({ documentId: 'test_doc' });
    });

    test('should return null if document not found', async () => {
      cache.db.collection().findOne.mockResolvedValue(null);

      const result = await cache.getCachedDocument('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateAIResults()', () => {
    test('should update AI results successfully', async () => {
      const aiResults = { ai_title: 'Updated Title', summary: 'Updated summary' };

      await cache.updateAIResults('test_doc', aiResults);

      expect(cache.db.collection().updateOne).toHaveBeenCalledWith(
        { documentId: 'test_doc' },
        {
          $set: {
            aiResults,
            updatedAt: expect.any(Date)
          }
        }
      );
    });
  });

  describe('removeDocumentCache()', () => {
    test('should remove document cache successfully', async () => {
      const result = await cache.removeDocumentCache('test_doc');

      expect(result).toBe(true);
      expect(cache.db.collection().deleteOne).toHaveBeenCalledWith({ documentId: 'test_doc' });
    });

    test('should return false if document not found', async () => {
      cache.db.collection().deleteOne.mockResolvedValue({ deletedCount: 0 });

      const result = await cache.removeDocumentCache('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('batchCacheDocuments()', () => {
    test('should batch cache documents successfully', async () => {
      const documents = [
        {
          document: global.createTestDocument({ id: 'doc1' }),
          processedContent: { title: 'Title 1' },
          aiResults: { ai_title: 'AI Title 1' }
        },
        {
          document: global.createTestDocument({ id: 'doc2' }),
          processedContent: { title: 'Title 2' },
          aiResults: { ai_title: 'AI Title 2' }
        }
      ];

      const result = await cache.batchCacheDocuments(documents);

      expect(result.insertedCount).toBe(2);
      expect(result.modifiedCount).toBe(1);
      expect(cache.db.collection().bulkWrite).toHaveBeenCalled();
    });
  });

  describe('healthCheck()', () => {
    test('should return healthy status', async () => {
      const health = await cache.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health).toHaveProperty('latency');
    });

    test('should return unhealthy status on error', async () => {
      cache.client.db().admin().ping.mockRejectedValue(new Error('Connection failed'));

      const health = await cache.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.error).toBe('Connection failed');
    });
  });
});



