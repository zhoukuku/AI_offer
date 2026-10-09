import config from '../../config.js'

// 使用 Node 18+ 内置 fetch 调用 OpenAI 兼容接口（DeepSeek / 豆包 / GLM / OpenAI / Ollama 通用）
// 支持：超时控制（AbortController）、maxTokens 成本护栏、usage 用量回传（meta.usage）
export async function openaiChat({ system, prompt, json = false, model, maxTokens, timeoutMs = 45000, meta, conversation = false } = {}) {
  const messages = []
  if (system) messages.push({ role: 'system', content: system })
  let history
  try { history = JSON.parse(prompt)?.messages } catch {}
  if (conversation && Array.isArray(history)) messages.push(...history.filter(m => ['user','assistant'].includes(m.role) && typeof m.content === 'string').slice(-20))
  else messages.push({ role: 'user', content: prompt })

  const body = {
    model,
    messages,
    temperature: 0.7,
  }
  if (/^deepseek-(flash|v4)/.test(model || '')) body.thinking = { type: 'disabled' }
  if (maxTokens) body.max_tokens = maxTokens
  if (json) {
    body.response_format = { type: 'json_object' }
  }

  // 超时控制：防止模型端卡顿把请求挂死
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let res
  try {
    res = await fetch(`${config.ai.baseURL.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.ai.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timer)
    if (err?.name === 'AbortError') throw new Error(`AI 接口调用超时 (${timeoutMs}ms)`)
    throw err
  }

  try {
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`AI 接口调用失败 (${res.status}): ${err.slice(0, 300)}`)
  }

  const data = await res.json()
  // 用量回传：供成本统计（prompt/completion/total tokens）
  if (meta && data?.usage) meta.usage = data.usage

  const content = data?.choices?.[0]?.message?.content || ''
  if (!content.trim() || data?.choices?.[0]?.finish_reason === 'length') throw Object.assign(new Error('模型返回为空或输出被截断'), {status:502})
  if (json) {
    try {
      return JSON.parse(extractJson(content))
    } catch {
      throw Object.assign(new Error('模型未返回合法 JSON'), { status: 502 })
    }
  }
  return content.trim()
  } finally { clearTimeout(timer) }
}

function extractJson(text) {
  const m = text.match(/\{[\s\S]*\}/)
  return m ? m[0] : text
}
