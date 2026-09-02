import config from '../../config.js'

// 使用 Node 18+ 内置 fetch 调用 OpenAI 兼容接口（DeepSeek / 豆包 / OpenAI / Ollama 通用）
export async function openaiChat({ system, prompt, json = false, model }) {
  const messages = []
  if (system) messages.push({ role: 'system', content: system })
  messages.push({ role: 'user', content: prompt })

  const body = {
    model,
    messages,
    temperature: 0.7,
  }
  if (json) {
    body.response_format = { type: 'json_object' }
  }

  const res = await fetch(`${config.ai.baseURL.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.ai.apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`AI 接口调用失败 (${res.status}): ${err.slice(0, 300)}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content || ''
  if (json) {
    try {
      return JSON.parse(extractJson(content))
    } catch {
      return { raw: content }
    }
  }
  return content.trim()
}

function extractJson(text) {
  const m = text.match(/\{[\s\S]*\}/)
  return m ? m[0] : text
}