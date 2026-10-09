import config from '../config.js'

export async function transcribeAudio(buffer, filename = '', mime = 'audio/webm') {
  if (!['whisper','funasr'].includes(config.asr.provider) || !config.asr.endpoint) {
    throw Object.assign(new Error('语音转写尚未配置，请粘贴真实面试逐字稿；不会返回示例录音内容'),{status:503})
  }
  const form = new FormData()
  form.append('file',new Blob([buffer],{type:mime}),filename || 'audio.webm')
  form.append('model',config.asr.model)
  const response = await fetch(config.asr.endpoint,{method:'POST',body:form,signal:AbortSignal.timeout(120000),headers:config.asr.apiKey ? {Authorization:`Bearer ${config.asr.apiKey}`} : {}})
  if (!response.ok) throw Object.assign(new Error(`转写服务请求失败 (${response.status})`),{status:502})
  const data = await response.json()
  if (typeof data.text !== 'string' || !data.text.trim()) throw Object.assign(new Error('转写服务未返回文字'),{status:422})
  return data.text.trim()
}
export const isMockAsr = () => false
