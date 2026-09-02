import config from '../config.js'

// ===== OCR（简历 / JD 解析）：可插拔服务商 =====
// 默认 mock：返回一份内置示例 JD 文本，保证「上传截图 → 岗位适配」链路在无 OCR 服务时也能完整演示。
// 真实接入：把 OCR_PROVIDER 设为 tencent / baidu，在 ocrTencent 中实现调用（见下方 TODO）。

// ---------- mock 示例文本 ----------
function mockOcrText(filename = '') {
  const base = String(filename).replace(/\.(png|jpe?g|webp|pdf)$/i, '')
  return (
    `【职位】前端开发工程师（${base || '示例'}）\n` +
    `【职责】\n` +
    `1. 负责核心业务前端架构设计与开发，保障高性能与高可用；\n` +
    `2. 参与组件库、工程化与性能优化体系建设；\n` +
    `3. 与产品、设计、后端协作，推进项目按期高质量交付。\n` +
    `【要求】\n` +
    `1. 3 年以上前端开发经验，精通 JavaScript / TypeScript；\n` +
    `2. 熟悉 React 或 Vue 及主流工程化工具链；\n` +
    `3. 具备性能优化、组件化、微前端经验者优先；\n` +
    `4. 有 Node.js 服务端经验优先，良好的沟通与协作能力。`
  )
}

// ---------- 真实服务商接入点（示例：腾讯云 OCR）----------
async function ocrTencent(buffer) {
  // TODO: 调用腾讯云 OCR 通用印刷体识别（得先 npm i tencentcloud-sdk-nodejs 并配置 secretId/secretKey）
  // const client = new OcrClient({ credential: { secretId, secretKey }, region: 'ap-guangzhou' })
  // const res = await client.GeneralBasicOCR({ ImageBase64: buffer.toString('base64') })
  // return res.TextDetections.map(t => t.DetectedText).join('\n')
  throw new Error('OCR_PROVIDER=tencent 尚未实现：请在 integrations/ocr.js 接入腾讯云 OCR')
}

// 统一入口：buffer 为上传文件的二进制内容
export async function ocrFile(buffer, filename = '') {
  const provider = config.ocr.provider || 'mock'
  if (provider === 'mock') return mockOcrText(filename)
  if (provider === 'tencent') return ocrTencent(buffer)
  throw new Error(`未知 OCR 服务商: ${provider}`)
}

export function isMockOcr() {
  return (config.ocr.provider || 'mock') === 'mock'
}
