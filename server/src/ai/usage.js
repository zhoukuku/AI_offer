import { AsyncLocalStorage } from 'node:async_hooks'
import store from '../store/db.js'
export const aiContext = new AsyncLocalStorage()
export function recordUsage(usage, model) {
  if (!usage) return
  const context = aiContext.getStore() || {}
  const input = Number(usage.prompt_tokens || 0)
  const output = Number(usage.completion_tokens || 0)
  const cached = Math.min(input, Number(usage.prompt_cache_hit_tokens || 0))
  store.recordModelUsage({userId:context.userId || '',task:context.task || 'unknown',model,input,output,cached})
}
