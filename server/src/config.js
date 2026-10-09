import 'dotenv/config'

// ===== AI 配置 =====
// 通过 OpenAI 兼容接口接入任意大模型（DeepSeek / 豆包 / OpenAI / 本地 Ollama 等）。
// 未配置 API Key 时自动走 mock 演示模式，全套流程仍可跑通。
const config = {
  port: Number(process.env.PORT || 8787),

  // ===== 数据存储层 =====
  // sqlite（默认）：生产级，支持多用户并发、原子事务，是参赛作品的工程亮点。
  // file：旧版 JSON 文件库回退（单进程演示用），设置 DB_TYPE=file 可退回。
  db: {
    type: process.env.DB_TYPE || 'sqlite',
    // SQLite 文件路径（留空则用 data/app.db）
    file: process.env.DB_FILE || '',
  },

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
    // ===== 韧性参数（真实模型模式生效）=====
    timeoutMs: Number(process.env.AI_TIMEOUT_MS || 45000), // 单次调用超时，超时自动降级
    retries: Number(process.env.AI_RETRIES || 1), // 可重试错误（网络/5xx/429）的重试次数
    dailyLimit: Number(process.env.AI_DAILY_LIMIT || 500), // 当日真实模型调用熔断上限（0=不限），超出降级 mock
  },

  // ===== 短信验证码 =====
  // provider=mock（默认）：验证码直接随接口返回，便于无短信服务商时本地联调；
  //                       接真实短信后改为 aliyun / tencent，验证码不再回显。
  sms: {
    provider: process.env.SMS_PROVIDER || 'mock',
    mock: (process.env.SMS_PROVIDER || 'mock') === 'mock', // 兼容旧字段
    codeTtl: 5 * 60 * 1000, // 验证码有效期（毫秒），默认 5 分钟
    accessKeyId: process.env.SMS_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.SMS_ACCESS_KEY_SECRET || '',
    signName: process.env.SMS_SIGN_NAME || '',
    templateCode: process.env.SMS_TEMPLATE_CODE || '',
  },

  // ===== 语音转写 ASR =====
  // provider=mock（默认）：返回示例逐字稿；provider=whisper/funasr 时调用真实服务。
  asr: {
    provider: process.env.ASR_PROVIDER || 'mock',
    enabled: (process.env.ASR_PROVIDER || 'mock') !== 'mock', // 兼容旧字段
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
  // 试用次数用完后需开通会员。付费默认走「模拟开通」（本地即可跑通付费墙）；
  // 接真实支付时把 PAYMENT_PROVIDER 设为 stripe / wechat 并在 integrations/payment.js 实现。
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

  // ===== 支付 =====
  // provider=mock（默认）：模拟开通，直接写入会员状态，本地即可跑通付费墙；
  // provider=stripe / wechat：调用真实支付，支付成功回调后写入会员（见 integrations/payment.js）。
  payment: {
    provider: process.env.PAYMENT_PROVIDER || 'mock',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    wechatMchId: process.env.WECHAT_MCH_ID || '',
    wechatApiKey: process.env.WECHAT_API_KEY || '',
  },

  // ===== OCR（简历 / JD 解析）=====
  // provider=mock（默认）：内置示例解析文本，保证「上传截图 → 岗位适配」链路在无 OCR 服务时也能演示；
  // provider=tencent / baidu：调用真实 OCR（见 integrations/ocr.js）。
  ocr: {
    provider: process.env.OCR_PROVIDER || 'mock',
    secretId: process.env.OCR_SECRET_ID || '',
    secretKey: process.env.OCR_SECRET_KEY || '',
  },
}

export default config
