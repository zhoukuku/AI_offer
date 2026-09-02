import 'dotenv/config'

// ===== AI 配置 =====
// 通过 OpenAI 兼容接口接入任意大模型（DeepSeek / 豆包 / OpenAI / 本地 Ollama 等）。
// 未配置 API Key 时自动走 mock 演示模式，全套流程仍可跑通。
const config = {
  port: Number(process.env.PORT || 8787),

  ai: {
    // 留空则使用 mock 模式
    apiKey: process.env.AI_API_KEY || '',
    // OpenAI 兼容 baseURL：
    //   DeepSeek:  https://api.deepseek.com/v1
    //   豆包/火山: https://ark.cn-beijing.volces.com/api/v3
    //   OpenAI:    https://api.openai.com/v1
    //   本地 Ollama: http://localhost:11434/v1
    baseURL: process.env.AI_BASE_URL || 'https://api.deepseek.com/v1',
    model: process.env.AI_MODEL || 'deepseek-chat',
  },

  // 面试录音转写：默认使用与主对话相同的模型（需支持音频）。未配置时 mock。
  asr: {
    enabled: process.env.ASR_ENABLED === '1',
    // 需要真实 ASR 时可指向 FunASR / whisper 服务等
    endpoint: process.env.ASR_ENDPOINT || '',
  },

  // ===== 用户认证 =====
  auth: {
    // token 签名密钥。生产环境务必通过 AUTH_SECRET 设置；未设置时每次重启自动更换（旧登录态失效）。
    secret: process.env.AUTH_SECRET || '',
    // 登录态有效期（毫秒），默认 30 天
    tokenTtl: Number(process.env.AUTH_TOKEN_TTL || 30 * 24 * 3600) * 1000,
    // 管理员手机号（逗号分隔）。留空时，第一个注册的用户自动成为管理员。
    adminPhones: (process.env.ADMIN_PHONES || '').split(',').map((s) => s.trim()).filter(Boolean),
    // 演示管理员账号（账号密码登录用）。启动时若不存在则会自动创建，便于本地快速体验。
    demoAccount: {
      account: process.env.DEMO_ACCOUNT || 'admin',
      password: process.env.DEMO_PASSWORD || 'admin123',
      phone: process.env.DEMO_PHONE || '13800000001',
    },
  },

  // ===== 订阅 / 会员 =====
  // 免费档：注册即可使用基础功能，AI 高级能力给予有限的「免费试用次数」。
  // 试用次数用完后需开通会员。付费接入当前为「模拟开通」，本地即可跑通付费墙；接真实支付时替换 pay 相关接口即可。
  subscription: {
    // 免费档限制
    free: {
      maxResumes: Number(process.env.FREE_MAX_RESUMES || 1), // 免费档可同时保留的简历数
      aiQuota: Number(process.env.FREE_AI_QUOTA || 2), // 免费档 AI 免费试用总次数（会员期不受限）
    },
    // 会员套餐（价格单位：分）
    plans: {
      monthly: { name: '月度会员', price: 2900, days: 30 },
    },
  },

  // ===== 短信验证码 =====
  sms: {
    // 是否走演示模式：true 时验证码直接随接口返回（便于无短信服务商时本地联调）。
    mock: process.env.SMS_MOCK !== '0',
    // 验证码有效期（毫秒），默认 5 分钟
    codeTtl: 5 * 60 * 1000,
    // 真实短信服务商配置（阿里云/腾讯云等），接入真实短信时在此扩展
    provider: process.env.SMS_PROVIDER || '',
    accessKeyId: process.env.SMS_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.SMS_ACCESS_KEY_SECRET || '',
    signName: process.env.SMS_SIGN_NAME || '',
    templateCode: process.env.SMS_TEMPLATE_CODE || '',
  },
}

export default config