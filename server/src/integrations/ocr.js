import config from '../config.js'
import { recordUsage } from '../ai/usage.js'

export async function ocrFile(buffer, filename = '') {
  if (config.ocr.provider !== 'openai' || !config.ocr.apiKey) {
    throw Object.assign(new Error('截图识别尚未配置，请粘贴岗位文字或导入文本型 PDF / DOCX'), {status:503})
  }
  const mime = buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png'
    : buffer[0] === 255 && buffer[1] === 216 ? 'image/jpeg'
    : buffer.subarray(0,4).toString() === 'RIFF' && buffer.subarray(8,12).toString() === 'WEBP' ? 'image/webp' : null
  if (!mime) throw Object.assign(new Error('请上传 PNG、JPEG 或 WebP 图片'), {status:400})
  const response = await fetch(`${config.ocr.baseURL.replace(/\/$/,'')}/chat/completions`, {
    method:'POST', signal:AbortSignal.timeout(60000), headers:{Authorization:`Bearer ${config.ocr.apiKey}`,'Content-Type':'application/json'},
    body:JSON.stringify({model:config.ocr.model,...(/^deepseek-(flash|v4)/.test(config.ocr.model) ? {thinking:{type:'disabled'}} : {}),temperature:0,max_tokens:4096,messages:[{role:'user',content:[{type:'text',text:'提取图片中的全部文字，忠实保留姓名、数字和段落，不改写、不推测、不添加解释。'}, {type:'image_url',image_url:{url:`data:${mime};base64,${buffer.toString('base64')}`}}]}]}),
  })
  if (!response.ok) throw Object.assign(new Error(`识别服务请求失败 (${response.status})`), {status:502})
  const data = await response.json(), text = data.choices?.[0]?.message?.content
  recordUsage(data?.usage, config.ocr.model)
  if (typeof text !== 'string' || !text.trim()) throw Object.assign(new Error('图片中未识别到可用文字'),{status:422})
  return text.trim()
}
export const isMockOcr = () => false
