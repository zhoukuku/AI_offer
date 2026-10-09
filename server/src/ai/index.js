import config from '../config.js'
import { localResult } from './local.js'
import { SCHEMAS, validateResult } from './contracts.js'
import { openaiChat } from './providers/openai.js'
import { mockChat } from './providers/mock.js'

// 是否运行在 mock 演示模式（未配置 API Key）
export const isMock = !config.ai.apiKey

// ===== 运行统计（成本护栏 + 可观测性，经 /api/health 暴露）=====
const stats = {
  llmCalls: 0, // 真实模型成功调用次数
  llmFailures: 0, // 真实模型最终失败次数（重试后仍失败）
  rejectedCalls: 0, // 降级回 mock 的次数（失败降级 + 熔断降级）
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
    mode: isMock ? 'local' : 'live',
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
  return err?.name === 'AbortError' || /\(5\d\d\)|\(429\)|超时|fetch failed|ECONNRESET|ETIMEDOUT|ECONNREFUSED|socket|network/i.test(msg)
}

async function callReal({ system, prompt, kind, json }) {
  const maxTokens = MAX_TOKENS[kind] || MAX_TOKENS.general
  let lastErr
  for (let attempt = 0; attempt <= config.ai.retries; attempt++) {
    try {
      rollDay()
      if (config.ai.dailyLimit > 0 && stats.todayCalls >= config.ai.dailyLimit) throw Object.assign(new Error('今日模型调用额度已用完'), {status:503})
      stats.todayCalls++
      const meta = {}
      const result = await openaiChat({
        system,
        prompt,
        json,
        model: config.ai.model,
        maxTokens,
        timeoutMs: config.ai.timeoutMs,
        meta,
        conversation: kind === 'general',
      })
      stats.llmCalls++
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
 * - 已配置 key → 真实模型；超时/限流/5xx 自动重试；失败返回明确错误，保留原始数据
 * @param {object} opts
 * @param {string} opts.system   系统提示词
 * @param {string} opts.prompt   用户输入
 * @param {string} opts.kind     任务类型标记（供 mock 生成对应内容 + max_tokens 分档）
 * @param {boolean} opts.json    是否要求返回 JSON
 * @returns {Promise<string|object>}
 */
export async function chat({ system, prompt, kind = 'general', json = false } = {}) {
  if (isMock) {
    const local = localResult({ kind, prompt })
    return local === undefined ? mockChat({ system, prompt, kind, json }) : local
  }

  if ((String(system || '').length + String(prompt || '').length) > 64000) throw Object.assign(new Error('内容过长，请精简后重试'), { status: 400 })
  rollDay()
  // 熔断：当日真实调用超上限 → 拒绝请求，防止失控烧钱
  if (config.ai.dailyLimit > 0 && stats.todayCalls >= config.ai.dailyLimit) {
    stats.rejectedCalls++
    console.warn(`[ai] 达到当日真实模型调用上限 ${config.ai.dailyLimit}，本请求被拒绝 (kind=${kind})`)
    throw Object.assign(new Error('今日模型调用额度已用完，请稍后重试'), { status: 503 })
  }

  try {
    const guard = '只使用用户提供的真实信息，不得编造公司、学历、技能、年限或数字；资料不足时保留空白并提示补充。'
    const contract = json ? '\n返回 JSON 字段及类型：' + (SCHEMAS[kind] || '依据任务要求') : ''
    const result = await callReal({ system: system + '\n' + guard + contract, prompt, kind, json })
    return json ? validateResult(kind, result) : result
  } catch (err) {
    stats.llmFailures++
    stats.rejectedCalls++
    stats.lastError = String(err?.message || err).replaceAll(config.ai.apiKey, '[redacted]').replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]').slice(0, 300)
    stats.lastErrorAt = Date.now()
    console.error(`[ai] 真实模型调用失败 (kind=${kind})：${stats.lastError}`)
    throw Object.assign(new Error('大模型服务暂不可用，请稍后重试；原简历保持不变'), { status: err.status || 503 })
  }
}
