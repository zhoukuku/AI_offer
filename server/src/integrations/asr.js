import config from '../config.js'

// ===== 语音转写 ASR：可插拔服务商 =====
// 默认 mock：返回一份示例逐字稿，保证「上传面试录音 → 生成复盘」链路在无 ASR 服务时也能演示。
// 真实接入：把 ASR_PROVIDER 设为 whisper / funasr，在 transcribeWhisper 中实现调用（见下方 TODO）。

// ---------- mock 示例逐字稿 ----------
function mockTranscribe(filename = '') {
  return (
    `（演示转写文本${filename ? ' · ' + filename : ''}）\n` +
    `面试官：请先做个简单的自我介绍。\n` +
    `候选人：您好，我从事前端开发三年，主导过两个百万级用户产品的前端架构。\n` +
    `面试官：说说你对性能优化的理解。\n` +
    `候选人：我会从加载、渲染、运行时三阶段入手，比如路由级懒加载、虚拟列表、Web Worker 拆解计算……\n` +
    `（这是 mock ASR 返回的示例逐字稿。接入真实 ASR 后，此处会返回真实转写内容。）`
  )
}

// ---------- 真实服务商接入点（示例：Whisper / FunASR）----------
async function transcribeWhisper(buffer) {
  // TODO: 调用本地 Whisper / FunASR 服务，或 whisper.cpp / openai audio.transcriptions
  // const form = new FormData(); form.append('file', buffer); form.append('model', 'whisper-1')
  // const res = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', body: form, headers: {...} })
  // return (await res.json()).text
  throw new Error('ASR_PROVIDER=whisper 尚未实现：请在 integrations/asr.js 接入 Whisper / FunASR')
}

// 统一入口：buffer 为上传音频的二进制内容
export async function transcribeAudio(buffer, filename = '') {
  const provider = config.asr.provider || 'mock'
  if (provider === 'mock') return mockTranscribe(filename)
  if (provider === 'whisper' || provider === 'funasr') return transcribeWhisper(buffer)
  throw new Error(`未知 ASR 服务商: ${provider}`)
}

export function isMockAsr() {
  return (config.asr.provider || 'mock') === 'mock'
}
