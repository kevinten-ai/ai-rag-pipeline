import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

export const DEFAULT_ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/plan/v3'
export const DEFAULT_ARK_CHAT_MODEL = 'doubao-seed-2-0-code-preview-260215'

export const ark = createOpenAICompatible({
  name: 'ark',
  baseURL: process.env.ARK_BASE_URL || DEFAULT_ARK_BASE_URL,
  apiKey: process.env.ARK_API_KEY,
})

/** Fast model for pipeline steps (routing, reranking, generation, etc.) */
export const arkModel = ark.chatModel(getArkChatModelName())

/** Teacher model for educational analysis and explanations */
export const arkTeacherModel = ark.chatModel(getArkTeacherModelName())

export function getArkChatModelName(): string {
  return process.env.ARK_CHAT_MODEL || DEFAULT_ARK_CHAT_MODEL
}

export function getArkTeacherModelName(): string {
  return process.env.ARK_TEACHER_MODEL || process.env.ARK_CHAT_MODEL || DEFAULT_ARK_CHAT_MODEL
}
