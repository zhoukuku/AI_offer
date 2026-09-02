import config from '../config.js'

// ===== 短信验证码：可插拔服务商 =====
// 设计目标：SMK 代码层只认「发送 / 校验」两个动作，具体走哪家服务商由 config.sms.provider 决定。
// 默认 mock：不真正下发短信，把验证码交回接口层随响应返回（仅本地开发联调用）。
// 真实接入：把 provider 设为 aliyun / tencent，并填好密钥，再在下方 sendAliyun / sendTencent 中实现调用。

// 内存验证码存储（仅 mock 模式使用；真实服务商由服务端/网关校验，无需本地存储）
const codeStore = new Map() // phone -> { code, expiresAt }

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

// ---------- mock 实现 ----------
async function sendMock(phone) {
  const code = genCode()
  codeStore.set(phone, { code, expiresAt: Date.now() + config.sms.codeTtl })
  // mock 模式：不真正发送，直接把验证码交回接口层随响应返回
  return { delivered: false, code }
}

function verifyMock(phone, code) {
  const rec = codeStore.get(phone)
  if (!rec) return false
  if (rec.expiresAt < Date.now()) {
    codeStore.delete(phone)
    return false
  }
  const ok = rec.code === String(code).trim()
  if (ok) codeStore.delete(phone) // 校验成功即销毁，防止重放
  return ok
}

// ---------- 真实服务商接入点（示例：阿里云）----------
async function sendAliyun(phone) {
  // TODO: 引入 @alicloud/dysmsapi20170525 等 SDK 调用 SendSms
  // const client = createDysmsClient(config.sms.accessKeyId, config.sms.accessKeySecret)
  // await client.sendSms({ phoneNumbers: phone, signName: config.sms.signName, templateCode: config.sms.templateCode, templateParam: JSON.stringify({ code }) })
  throw new Error('SMS_PROVIDER=aliyun 尚未实现：请在 integrations/sms.js 接入阿里云短信 SDK')
}

function verifyAliyun() {
  // OTP 通过短信下发，服务端通常只信任「已发送」这一事实，校验由用户回填完成；如需服务端校验请对接网关回执。
  throw new Error('SMS_PROVIDER=aliyun 尚未实现')
}

const impls = {
  mock: { send: sendMock, verify: verifyMock },
  aliyun: { send: sendAliyun, verify: verifyAliyun },
  tencent: { send: sendAliyun, verify: verifyAliyun }, // 占位：替换为腾讯云 SMS 实现
}

export function getSms() {
  return impls[config.sms.provider] || impls.mock
}

export function isMockSms() {
  return (config.sms.provider || 'mock') === 'mock'
}
