import config from '../config.js'
import { openaiChat } from './providers/openai.js'
import { mockChat } from './providers/mock.js'

// 是否运行在 mock 演示模式（未配置 API Key）
export const isMock = !config.ai.apiKey

// ===== 运行统计（成本护栏 + 可观测性，经 /api/health 暴露）=====
const stats = {
  llmCalls: 0, // 真实模型成功调用次数
  llmFailures: 0, // 真实模型最终失败次数（重试后仍失败）
  fallbacks: 0, // 降级回 mock 的次数（失败降级 + 熔断降级）
  tokensUsed: 0, // 累计 token 消耗（来自 API usage 字段）
  todayCalls: 0, // 当日真实模型调用数（熔断计数）
  day: new Date().toDateString(),
  lastError: '', // 最近一次失败原因（排查用）
  lastErrorAt: 0,
}

function rollDay() {
  const d = new Date().toDateString()
  if (d !== stats.day) {
    stats.day = d
    stats.todayCalls = 0
  }
}

export function aiStats() {
  rollDay()
  return {
    mode: isMock ? 'mock' : 'live',
    model: isMock ? null : config.ai.model,
    dailyLimit: config.ai.dailyLimit,
    ...stats,
  }
}

// 各任务类型的 max_tokens 上限（成本护栏：防止异常长输出烧钱）
const MAX_TOKENS = {
  'parse-resume': 4096,
  match: 4096,
  generate: 3072,
  translate: 4096,
  experience: 2048,
  coverletter: 2048,
  analyze: 2048,
  general: 2048,
  optimize: 1536,
  score: 1536,
  rewrite: 1536,
  greet: 1200,
  chat: 1536,
  questions: 1536,
  interview: 2048,
  review: 1536,
  duplicate: 1024,
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 可重试的错误：网络异常 / 超时 / 5xx / 429 限流；4xx 鉴权类错误不重试
function retryable(err) {
  const msg = String(err?.message || '')
  return /\(5\d\d\)|\(429\)|超时|fetch failed|ECONNRESET|ETIMEDOUT|ECONNREFUSED|socket|network/i.test(msg)
}

async function callReal({ system, prompt, kind, json }) {
  const maxTokens = MAX_TOKENS[kind] || MAX_TOKENS.general
  let lastErr
  for (let attempt = 0; attempt <= config.ai.retries; attempt++) {
    try {
      const meta = {}
      const result = await openaiChat({
        system,
        prompt,
        json,
        model: config.ai.model,
        maxTokens,
        timeoutMs: config.ai.timeoutMs,
        meta,
      })
      stats.llmCalls++
      stats.todayCalls++
      if (meta.usage?.total_tokens) stats.tokensUsed += meta.usage.total_tokens
      return result
    } catch (err) {
      lastErr = err
      if (attempt < config.ai.retries && retryable(err)) {
        await sleep(800 * (attempt + 1))
        continue
      }
      break
    }
  }
  throw lastErr
}

/**
 * 统一的大模型调用入口（带韧性）：
 * - 未配置 key → mock 演示模式
 * - 已配置 key → 真实模型；超时/限流/5xx 自动重试，最终失败或触发日熔断 → 降级 mock 保证可用
 * @param {object} opts
 * @param {string} opts.system   系统提示词
 * @param {string} opts.prompt   用户输入
 * @param {string} opts.kind     任务类型标记（供 mock 生成对应内容 + max_tokens 分档）
 * @param {boolean} opts.json    是否要求返回 JSON
 * @returns {Promise<string|object>}
 */
export async function chat({ system, prompt, kind = 'general', json = false } = {}) {
  if (isMock) {
    return mockChat({ system, prompt, kind, json })
  }

  rollDay()
  // 熔断：当日真实调用超上限 → 直接降级 mock，防止失控烧钱
  if (config.ai.dailyLimit > 0 && stats.todayCalls >= config.ai.dailyLimit) {
    stats.fallbacks++
    console.warn(`[ai] 达到当日真实模型调用上限 ${config.ai.dailyLimit}，本请求降级为 mock (kind=${kind})`)
    return mockChat({ system, prompt, kind, json })
  }

  try {
    return await callReal({ system, prompt, kind, json })
  } catch (err) {
    stats.llmFailures++
    stats.fallbacks++
    stats.lastError = String(err?.message || err).slice(0, 300)
    stats.lastErrorAt = Date.now()
    console.error(`[ai] 真实模型调用失败 (kind=${kind})，已降级为 mock：${stats.lastError}`)
    return mockChat({ system, prompt, kind, json })
  }
}
