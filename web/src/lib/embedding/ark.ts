export const DEFAULT_ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/plan/v3'
export const DEFAULT_ARK_EMBEDDING_MODEL = 'doubao-embedding-vision-251215'
export const DEFAULT_ARK_EMBEDDING_DIMENSIONS = 1024

interface EmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>
  usage: { prompt_tokens: number; total_tokens: number }
}

export async function generateEmbedding(
  text: string,
  dimensions: number = Number(process.env.ARK_EMBEDDING_DIMENSIONS || DEFAULT_ARK_EMBEDDING_DIMENSIONS)
): Promise<{ embedding: number[]; tokensUsed: number }> {
  const apiKey = process.env.ARK_API_KEY
  if (!apiKey) {
    throw new Error('ARK_API_KEY is not configured')
  }

  const response = await fetch(`${getArkBaseUrl()}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: getArkEmbeddingModelName(),
      input: text,
      dimensions,
      encoding_format: 'float',
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Ark embedding API error (${response.status}): ${error}`)
  }

  const data: EmbeddingResponse = await response.json()

  if (!data.data || data.data.length === 0 || !data.data[0]) {
    throw new Error(
      'Ark embedding API returned an empty or invalid data array - no embedding was produced for the given input'
    )
  }

  return {
    embedding: data.data[0].embedding,
    tokensUsed: data.usage.total_tokens,
  }
}

export function getArkEmbeddingModelName(): string {
  return process.env.ARK_EMBEDDING_MODEL || DEFAULT_ARK_EMBEDDING_MODEL
}

function getArkBaseUrl(): string {
  return (process.env.ARK_BASE_URL || DEFAULT_ARK_BASE_URL).replace(/\/$/, '')
}

export async function batchGenerateEmbeddings(
  texts: string[],
  dimensions: number = 1024,
  batchSize: number = 16
): Promise<Array<{ embedding: number[]; tokensUsed: number }>> {
  const results: Array<{ embedding: number[]; tokensUsed: number }> = []

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map((text) => generateEmbedding(text, dimensions))
    )
    results.push(...batchResults)
  }

  return results
}

interface BatchEmbeddingResult {
  embeddings: Array<{ embedding: number[]; tokensUsed: number; durationMs: number }>;
  totalTokensUsed: number;
  totalDurationMs: number;
}

export async function batchGenerateEmbeddingsWithStats(
  texts: string[],
  dimensions: number = 1024,
  batchSize: number = 16
): Promise<BatchEmbeddingResult> {
  const overallStart = Date.now()
  const embeddings: Array<{ embedding: number[]; tokensUsed: number; durationMs: number }> = []

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize)
    const batchResults = await Promise.all(
      batch.map(async (text) => {
        const itemStart = Date.now()
        const result = await generateEmbedding(text, dimensions)
        const durationMs = Date.now() - itemStart
        return {
          embedding: result.embedding,
          tokensUsed: result.tokensUsed,
          durationMs,
        }
      })
    )
    embeddings.push(...batchResults)
  }

  const totalDurationMs = Date.now() - overallStart
  const totalTokensUsed = embeddings.reduce((sum, e) => sum + e.tokensUsed, 0)

  return {
    embeddings,
    totalTokensUsed,
    totalDurationMs,
  }
}
