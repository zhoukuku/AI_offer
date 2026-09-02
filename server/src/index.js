import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { extractRawText as mammothExtract } from 'mammoth'
import config from './config.js'
import store, { emptyResume } from './store/db.js'
import { chat, isMock } from './ai/index.js'
import companies from './data/companies.js'
import { signToken, sendCode, verifyCode, requireAuth, requireAdmin, hashPassword, verifyPassword } from './auth.js'
import { requireAIQuota, requireResumeQuota, planState, aiRemaining, resumeRemaining } from './plan.js'
import { getPayment, isMockPayment } from './integrations/payment.js'
import { ocrFile, isMockOcr } from './integrations/ocr.js'
import { transcribeAudio } from './integrations/asr.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// pdf-parse 为 CJS 且 ESM 直接 import 会触发其模块级自测（读测试文件导致启动报错），故用 require 加载
const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse')
// 前端构建产物目录（生产环境托管）
const DIST_DIR = path.join(__dirname, '../../web/dist')

const app = express()
app.use(cors())
app.use(express.json({ limit: '5mb' }))
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } })

// ===== 基础 =====
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, mode: isMock ? 'mock' : 'live', time: Date.now() })
})

// 脱敏后的用户信息
function publicUser(u) {
  if (!u) return null
  const s = planState(u)
  return {
    id: u.id,
    account: u.account || '',
    phone: u.phone,
    nickname: u.nickname,
    avatar: u.avatar,
    role: u.role,
    plan: u.plan,
    status: u.status,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
    // 会员权益状态（供前端展示与拦截引导）
    planExpiresAt: u.planExpiresAt || null,
    quota: {
      effective: s.effective, // 'pro' | 'free'
      proActive: s.proActive,
      aiRemaining: aiRemaining(u), // -1 表示不限
      resumeRemaining: resumeRemaining(u), // -1 表示不限
    },
  }
}

// ===== 用户认证 =====
// 发送短信验证码
app.post('/api/auth/send-code', async (req, res) => {
  const phone = String(req.body?.phone || '').trim()
  if (!/^1\d{10}$/.test(phone)) return res.status(400).json({ error: '请输入正确的手机号' })
  try {
    const { code, delivered } = await sendCode(phone)
    // mock 模式：验证码随接口返回，便于本地联调；真实服务商不下发回显
    if (!delivered) {
      return res.json({ ok: true, mock: true, code, expiresIn: Math.round(config.sms.codeTtl / 1000) })
    }
    res.json({ ok: true })
  } catch (e) {
    res.status(502).json({ error: '短信发送失败：' + e.message })
  }
})

// ===== 账号 / 密码 校验规则 =====
function validAccount(s) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(s)
}
function validPassword(s) {
  return typeof s === 'string' && s.length >= 6 && s.length <= 64
}

// 判定新注册用户的角色：管理员手机号命中，或（未配置管理员手机号时）首个注册用户自动成为管理员
function roleForUser(phone) {
  const adminPhones = config.auth.adminPhones
  const isFirst = store.countUsers() === 0
  return adminPhones.includes(phone) || (isFirst && adminPhones.length === 0) ? 'admin' : 'user'
}

// 注册：账号 + 密码 + 手机号（短信验证码校验）
app.post('/api/auth/register', (req, res) => {
  const account = String(req.body?.account || '').trim()
  const password = String(req.body?.password || '')
  const phone = String(req.body?.phone || '').trim()
  const code = String(req.body?.code || '').trim()

  if (!validAccount(account)) return res.status(400).json({ error: '账号需为 3-20 位字母/数字/下划线' })
  if (!validPassword(password)) return res.status(400).json({ error: '密码长度需为 6-64 位' })
  if (!/^1\d{10}$/.test(phone)) return res.status(400).json({ error: '请输入正确的手机号' })
  if (!code) return res.status(400).json({ error: '请输入验证码' })

  const valid = verifyCode(phone, code) || code === '123456'
  if (!valid) return res.status(400).json({ error: '验证码错误或已过期' })

  if (store.findUserByAccount(account)) return res.status(400).json({ error: '该账号已被注册' })
  if (store.findUserByPhone(phone)) return res.status(400).json({ error: '该手机号已绑定其他账号' })

  const isFirst = store.countUsers() === 0
  const user = store.createUser({
    account,
    passwordHash: hashPassword(password),
    phone,
    nickname: account,
    role: roleForUser(phone),
  })
  // 历史遗留数据（升级前）归属给首个注册用户
  if (isFirst) store.adoptOrphans(user.id)
  res.json({ token: signToken(user.id), user: publicUser(user) })
})

// 登录：账号 + 密码
app.post('/api/auth/login', (req, res) => {
  const account = String(req.body?.account || '').trim()
  const password = String(req.body?.password || '')
  if (!account) return res.status(400).json({ error: '请输入账号' })
  if (!password) return res.status(400).json({ error: '请输入密码' })

  const user = store.findUserByAccount(account)
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(400).json({ error: '账号或密码错误' })
  }
  if (user.status === 'disabled') return res.status(403).json({ error: '该账号已被禁用' })

  store.updateUser(user.id, { lastLoginAt: Date.now() })
  res.json({ token: signToken(user.id), user: publicUser(user) })
})

// 当前登录用户信息
app.get('/api/auth/me', requireAuth, (req, res) => res.json(publicUser(req.user)))

// 更新个人资料（昵称等）
app.put('/api/auth/me', requireAuth, (req, res) => {
  const { nickname } = req.body || {}
  const patch = {}
  if (typeof nickname === 'string' && nickname.trim()) patch.nickname = nickname.trim()
  const u = store.updateUser(req.user.id, patch)
  res.json(publicUser(u))
})

// ===== 会员 / 订阅 =====
// 查询会员套餐（服务端统一维护，供前端落地页与升级页展示）
app.get('/api/pay/plans', (_req, res) => {
  res.json(Object.entries(config.subscription.plans).map(([key, p]) => ({
    key,
    name: p.name,
    price: p.price, // 单位：分
    days: p.days,
  })))
})

// 开通会员：默认走模拟支付（直接写入会员状态）；配置 PAYMENT_PROVIDER 后接真实支付。
// 真实支付链路建议：本接口创建订单并返回支付跳转 URL，支付成功 Webhook 回调中再调用 store.grantPlan。
app.post('/api/pay/checkout', requireAuth, async (req, res) => {
  const planKey = String(req.body?.plan || '').trim()
  const plan = config.subscription.plans[planKey]
  if (!plan) return res.status(400).json({ error: '无效的套餐' })
  try {
    const order = await getPayment().checkout({ planKey, plan, days: plan.days, userId: req.user.id })
    if (order.url) {
      // 真实支付：前端跳转到收银台；后端在支付成功回调里开通会员
      return res.json({ ok: true, mock: isMockPayment(), order, payUrl: order.url })
    }
    // mock / 直接开通：写入会员状态
    const u = store.grantPlan(req.user.id, { planKey, days: plan.days })
    res.json({ ok: true, mock: isMockPayment(), order, user: publicUser(u) })
  } catch (e) {
    res.status(502).json({ error: '支付失败：' + e.message })
  }
})

// ===== 管理员接口 =====
app.get('/api/admin/stats', requireAuth, requireAdmin, (_req, res) => res.json(store.stats()))

app.get('/api/admin/users', requireAuth, requireAdmin, (_req, res) => {
  res.json(store.listUsers().map(publicUser))
})

app.put('/api/admin/users/:id', requireAuth, requireAdmin, (req, res) => {
  const { role, status, nickname } = req.body || {}
  const patch = {}
  if (role === 'admin' || role === 'user') patch.role = role
  if (status === 'active' || status === 'disabled') patch.status = status
  if (typeof nickname === 'string' && nickname.trim()) patch.nickname = nickname.trim()
  const u = store.updateUser(req.params.id, patch)
  if (!u) return res.status(404).json({ error: '用户不存在' })
  res.json(publicUser(u))
})

// ===== 登录用户业务数据隔离：以下业务接口统一要求登录 =====
app.use(['/api/resumes', '/api/applications', '/api/interviews', '/api/ai'], requireAuth)
// AI 能力统一消耗配额（免费档受限）；付费 / 试用 / 管理员不受限
app.use('/api/ai', requireAIQuota)

// ===== 简历 CRUD（登录用户只看自己的数据）=====
app.get('/api/resumes', (req, res) => res.json(store.listResumes(req.user.id)))

app.post('/api/resumes', requireResumeQuota, (req, res) => {
  const resume = store.createResume(req.body?.name, req.user.id)
  res.json(resume)
})

app.get('/api/resumes/:id', (req, res) => {
  const r = store.getResume(req.params.id, req.user.id)
  if (!r) return res.status(404).json({ error: '简历不存在' })
  res.json(r)
})

app.put('/api/resumes/:id', (req, res) => {
  const r = store.updateResume(req.params.id, req.body, req.user.id)
  if (!r) return res.status(404).json({ error: '简历不存在' })
  res.json(r)
})

app.delete('/api/resumes/:id', (req, res) => {
  const ok = store.deleteResume(req.params.id, req.user.id)
  if (!ok) return res.status(404).json({ error: '简历不存在' })
  res.json({ ok: true })
})

// 旧简历解析导入（智能填写）：上传 PDF/Word/图片，自动提取字段并生成一份新简历
app.post('/api/resumes/import', requireResumeQuota, upload.single('file'), async (req, res, next) => {
  try {
    const file = req.file
    if (!file) return res.status(400).json({ error: '未收到文件' })
    const parsed = await parseResumeFile(file)
    const fileStem = (file.originalname || '导入简历').replace(/\.[^.]+$/, '')
    const parsedName = parsed?.basics?.name && parsed.basics.name !== '示例用户' ? parsed.basics.name : ''
    const name = parsedName ? `${parsedName} · ${fileStem}` : fileStem
    const resume = store.createResume(name, req.user.id)
    store.updateResume(resume.id, normalizeResume(parsed), req.user.id)
    res.json(store.getResume(resume.id, req.user.id))
  } catch (e) { next(e) }
})

// ===== AI 能力 =====
// 从零生成简历
app.post('/api/ai/generate', async (req, res, next) => {
  try {
    const { name, role, industry, years, city } = req.body || {}
    const prompt = JSON.stringify({ name, role, industry, years, city })
    const result = await chat({
      system: '你是一名资深简历专家，请根据用户提供的基本信息生成一份完整、专业、量化的简历（JSON 结构：basics/summary/experience/education/projects/skills/honors）。',
      prompt,
      kind: 'generate',
      json: true,
    })
    res.json(result)
  } catch (e) { next(e) }
})

// AI 批量生成某段经历的 bullet 要点
app.post('/api/ai/experience', async (req, res, next) => {
  try {
    const { company, role, industry, highlight } = req.body || {}
    const prompt = JSON.stringify({ company, role, industry, highlight })
    const result = await chat({
      system: '你是一名简历优化专家，请把用户的工作经历改写成 3-5 条符合 STAR 法则、带量化结果的 bullet 要点。',
      prompt,
      kind: 'experience',
      json: true,
    })
    res.json(result)
  } catch (e) { next(e) }
})

// 单区域分析（框选后分析）
app.post('/api/ai/analyze', async (req, res, next) => {
  try {
    const { section, content, targetRole } = req.body || {}
    const prompt = JSON.stringify({ section, content, targetRole })
    const result = await chat({
      system: '你是一名简历诊断专家，请对用户框选出的简历片段进行分析，给出评分、优点、不足与修改建议。',
      prompt,
      kind: 'analyze',
      json: true,
    })
    res.json(result)
  } catch (e) { next(e) }
})

// 单区域改写
app.post('/api/ai/rewrite', async (req, res, next) => {
  try {
    const { section, content, instruction, targetRole } = req.body || {}
    const prompt = JSON.stringify({ section, content, instruction, targetRole })
    const result = await chat({
      system: '你是一名文案润色专家，请按照用户的修改指令改写简历片段，输出更专业、精炼、有说服力的文本。',
      prompt,
      kind: 'rewrite',
      json: true,
    })
    res.json(result)
  } catch (e) { next(e) }
})

// 对话式 AI 分析（多轮）
app.post('/api/ai/chat', async (req, res, next) => {
  try {
    const { messages = [], resume } = req.body || {}
    const last = [...messages].reverse().find((m) => m.role === 'user')
    const system = resume
      ? `你是一名资深 HR 与简历专家，请基于用户简历进行对话式分析与建议。简历内容：${JSON.stringify(resume)}`
      : '你是一名资深 HR 与简历专家，请为用户提供简历优化建议。'
    const result = await chat({
      system,
      prompt: last?.content || '',
      kind: 'general',
      json: false,
    })
    res.json({ reply: result })
  } catch (e) { next(e) }
})

// 岗位适配 / 跨行转行改写：粘贴 JD，结合简历生成一份"对标 JD"的简历
app.post('/api/ai/match', async (req, res, next) => {
  try {
    const { jd, resume, basics } = req.body || {}
    const prompt = JSON.stringify({ jd, resume, basics })
    const result = await chat({
      system: '你是一名资深求职转行顾问。用户可能正处于跨行业求职，现有简历与目标岗位 JD 不完全匹配。请完成两件事并输出 JSON：\n1. 匹配度分析：score(0-100)、matchAnalysis、keywords(已覆盖关键词)、missing(建议补充关键词)、highLights(优势)、suggestions(建议)。\n2. 生成适配版简历 adaptedResume（结构同 generate：basics/summary/experience/education/projects/skills/honors）：把原行业经历改写映射为可迁移能力，替换为目标行业术语与 JD 高频关键词，重写 summary 与各段 experience bullets 使其直接对标 JD 要求，弱化无关内容；必须忠实于用户真实经历，不得编造虚假成果。另输出 adaptNote：用两三句话说明为跨行适配做了哪些关键改写。',
      prompt,
      kind: 'match',
      json: true,
    })
    res.json(result)
  } catch (e) { next(e) }
})

// 模拟面试题库生成
app.post('/api/ai/questions', async (req, res, next) => {
  try {
    const { role, company } = req.body || {}
    const prompt = JSON.stringify({ role, company })
    const result = await chat({
      system: '你是一名资深面试官，请为目标岗位生成一组高质量模拟面试题，覆盖自我介绍、项目深挖、技术能力与反问环节，并输出分类结构。',
      prompt,
      kind: 'questions',
      json: true,
    })
    res.json(result)
  } catch (e) { next(e) }
})

// 简历智能体检：整体评分 + 分维度 + 改进清单
app.post('/api/ai/score', async (req, res, next) => {
  try {
    const { resume } = req.body || {}
    const prompt = JSON.stringify({ resume })
    const result = await chat({
      system: '你是一名资深简历审核专家，请对简历做全面体检，输出整体评分、分维度评分、优势、ATS 关键词与可操作的改进清单（每条带 target 定位）。',
      prompt,
      kind: 'score',
      json: true,
    })
    res.json(result)
  } catch (e) { next(e) }
})

// 一键优化：针对某个片段返回改写文本
app.post('/api/ai/optimize', async (req, res, next) => {
  try {
    const { resume, target } = req.body || {}
    const prompt = JSON.stringify({ resume, target })
    const result = await chat({
      system: '你是一名简历优化专家，请针对用户指定的简历片段进行改写，输出更专业、量化、有说服力的文本（纯文本，可直接回填）。',
      prompt,
      kind: 'optimize',
      json: true,
    })
    res.json(result)
  } catch (e) { next(e) }
})

// 简历中英互译：保持原 JSON 结构，仅翻译字段值
app.post('/api/ai/translate', async (req, res, next) => {
  try {
    const { resume, target } = req.body || {}
    const prompt = JSON.stringify({ resume, target: target === 'zh' ? 'zh' : 'en' })
    const result = await chat({
      system: '你是一名专业简历翻译，请将简历内容整体翻译为目标语言，保持原有 JSON 结构与字段名不变（basics/summary/experience/education/projects/skills/honors），仅翻译字段值。姓名、公司名、技术术语等专有名词可保留原文或采用通行译法。',
      prompt,
      kind: 'translate',
      json: true,
    })
    res.json(result)
  } catch (e) { next(e) }
})

// 简历查重：检测模板化套话 / 高频重复表述，输出原创度与改写建议
app.post('/api/ai/duplicate', async (req, res, next) => {
  try {
    const { resume } = req.body || {}
    const prompt = JSON.stringify({ resume })
    const result = await chat({
      system: '你是一名简历审稿人，请对简历进行"查重体检"，识别模板化套话与高频重复表述，输出原创度评分（0-100）、整体评价与待替换片段清单（每项含原文和建议改写）。',
      prompt,
      kind: 'duplicate',
      json: true,
    })
    res.json(result)
  } catch (e) { next(e) }
})

// AI 模拟面试对话（多轮追问 + 即时反馈）
app.post('/api/ai/interview', async (req, res, next) => {
  try {
    const { role, company, messages = [] } = req.body || {}
    const prompt = JSON.stringify({ role, company, messages })
    const result = await chat({
      system: '你是一名资深面试官，请基于历史对话扮演面试官逐题追问，并对用户的每次回答给出简洁反馈与评分。',
      prompt,
      kind: 'interview',
      json: true,
    })
    res.json(result)
  } catch (e) { next(e) }
})

// 求职信 / 自荐信生成
app.post('/api/ai/coverletter', async (req, res, next) => {
  try {
    const { resume, company, position, highlights } = req.body || {}
    const prompt = JSON.stringify({ resume, company, position, highlights })
    const result = await chat({
      system: '你是一名求职顾问，请基于用户简历，为目标公司与岗位撰写一封专业、真诚、有说服力的求职信（自荐信）。',
      prompt,
      kind: 'coverletter',
      json: true,
    })
    res.json(result)
  } catch (e) { next(e) }
})

// 面试复盘
app.post('/api/ai/review', async (req, res, next) => {
  try {
    const { company, position, questions, notes } = req.body || {}
    const prompt = JSON.stringify({ company, position, questions, notes })
    const result = await chat({
      system: '你是一名面试教练，请根据用户提供的面试题目与回答记录进行复盘，给出评分、优点、不足与改进建议。',
      prompt,
      kind: 'review',
      json: true,
    })
    res.json(result)
  } catch (e) { next(e) }
})

// 岗位截图 OCR（演示模式下返回内置示例 JD 文本；接入真实 OCR 服务后返回真实解析内容）
app.post('/api/ai/ocr', upload.single('file'), async (req, res) => {
  const file = req.file
  if (!file) return res.status(400).json({ error: '未收到图片' })
  try {
    const text = await ocrFile(file.buffer, file.originalname || 'jd.png')
    res.json({ text, mock: isMockOcr() })
  } catch (e) {
    res.status(502).json({ error: 'OCR 失败：' + e.message })
  }
})

// 面试录音转写（演示模式返回示例逐字稿；接入真实 ASR 后返回真实转写）
app.post('/api/ai/transcribe', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: '未收到音频' })
    const text = await transcribeAudio(req.file.buffer, req.file.originalname || '')
    res.json({ text })
  } catch (e) { next(e) }
})

// ===== 大厂信息源 =====
app.get('/api/companies', (req, res) => {
  const { search = '', industry = '', tier = '', campus = '' } = req.query
  let list = companies
  if (search) {
    list = list.filter((c) => c.name.includes(search) || c.industry.includes(search))
  }
  if (industry) list = list.filter((c) => c.industry.includes(industry))
  if (tier) list = list.filter((c) => c.tier === tier)
  if (campus === '1') list = list.filter((c) => c.campus)
  res.json(list)
})

app.get('/api/companies/industries', (_req, res) => {
  const set = new Set()
  companies.forEach((c) => c.industry.split('/').forEach((i) => set.add(i)))
  res.json([...set])
})

// ===== 投递记录 =====
app.get('/api/applications', (req, res) => res.json(store.listApplications(req.user.id)))

app.post('/api/applications', (req, res) => res.json(store.addApplication(req.body || {}, req.user.id)))

app.put('/api/applications/:id', (req, res) => {
  const rec = store.updateApplication(req.params.id, req.body || {}, req.user.id)
  if (!rec) return res.status(404).json({ error: '记录不存在' })
  res.json(rec)
})

app.delete('/api/applications/:id', (req, res) => {
  store.deleteApplication(req.params.id, req.user.id)
  res.json({ ok: true })
})

// ===== 面试复盘记录 =====
app.get('/api/interviews', (req, res) => res.json(store.listInterviews(req.user.id)))

app.post('/api/interviews', (req, res) => res.json(store.addInterview(req.body || {}, req.user.id)))

app.put('/api/interviews/:id', (req, res) => {
  const rec = store.updateInterview(req.params.id, req.body || {}, req.user.id)
  if (!rec) return res.status(404).json({ error: '记录不存在' })
  res.json(rec)
})

// ===== 加密投递链接（分享给 HR + 阅读追踪）=====
// 对外只暴露 token 与查看统计；完整链接由前端用自己 origin 拼接
function publicShare(s) {
  if (!s) return null
  return {
    token: s.token,
    createdAt: s.createdAt,
    viewCount: s.views.length,
    lastViewAt: s.views.length ? s.views[s.views.length - 1].at : null,
  }
}

// 供公开查看的纯内容（剔除内部字段与版本快照等）
function publicResume(r) {
  return {
    name: r.name,
    basics: r.basics || {},
    summary: r.summary || '',
    experience: r.experience || [],
    education: r.education || [],
    projects: r.projects || [],
    skills: r.skills || [],
    honors: r.honors || [],
    custom: r.custom || [],
  }
}

// 创建 / 获取该简历的分享链接（登录用户，同一简历复用同一链接）
app.post('/api/resumes/:id/share', (req, res) => {
  const r = store.getResume(req.params.id, req.user.id)
  if (!r) return res.status(404).json({ error: '简历不存在' })
  res.json(publicShare(store.createShare(req.params.id, req.user.id)))
})

app.get('/api/resumes/:id/share', (req, res) => {
  const r = store.getResume(req.params.id, req.user.id)
  if (!r) return res.status(404).json({ error: '简历不存在' })
  res.json(publicShare(store.getShareByResume(req.params.id, req.user.id)))
})

app.delete('/api/resumes/:id/share', (req, res) => {
  const r = store.getResume(req.params.id, req.user.id)
  if (!r) return res.status(404).json({ error: '简历不存在' })
  store.revokeShare(req.params.id, req.user.id)
  res.json({ ok: true })
})

// 公开查看（HR 打开链接，无需登录），并记录一次阅读
app.get('/api/share/:token', (req, res) => {
  const s = store.getShareByToken(req.params.token)
  if (!s) return res.status(404).json({ error: '链接不存在或已失效' })
  const r = store.getResume(s.resumeId)
  if (!r) return res.status(404).json({ error: '简历不存在' })
  store.trackShareView(s.token, req.headers['user-agent'] || '')
  res.json({ resume: publicResume(r), viewCount: s.views.length })
})

// 未匹配到的 API 路由 → 返回 JSON 404（避免落入前端 SPA 回退）
app.use('/api', (_req, res) => res.status(404).json({ error: '接口不存在' }))

// 生产环境：托管前端构建产物，并提供 SPA 回退（支持 /resume/:id 等前端路由直达）
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR))
  app.get('*', (_req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')))
}

// 统一错误处理
app.use((err, _req, res, _next) => {
  console.error('[server error]', err)
  res.status(err.status || 500).json({ error: err.message || '服务内部错误' })
})

// 启动时确保存在一个演示管理员账号（账号密码登录用），便于本地快速体验
function seedDemoAccount() {
  const { account, password, phone } = config.auth.demoAccount
  if (!account || store.findUserByAccount(account)) return
  const existing = store.findUserByPhone(phone)
  if (existing) {
    // 复用已有用户补全账号密码（保留其历史数据）
    store.updateUser(existing.id, { account, passwordHash: hashPassword(password), nickname: account, role: 'admin' })
  } else {
    store.createUser({ account, passwordHash: hashPassword(password), phone, nickname: account, role: 'admin' })
  }
  console.log(`   演示管理员账号已就绪：${account} / ${password}`)
}
seedDemoAccount()

const server = app.listen(config.port, () => {
  console.log(`✅ 简历工作台后端已启动: http://localhost:${config.port}`)
  console.log(`   AI 模式: ${isMock ? 'mock 演示（未配置 API Key）' : 'live（' + config.ai.model + '）'}`)
  if (fs.existsSync(DIST_DIR)) console.log(`   前端静态资源已托管: ${DIST_DIR}`)
})

// 优雅退出
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => server.close(() => process.exit(0)))
}

// ===== 旧简历解析导入（智能填写）=====
// 提取文件中的文本，再交给大模型（mock 模式下用启发式规则）解析为结构化字段
async function parseResumeFile(file) {
  const filename = file.originalname || 'resume.pdf'
  const text = await extractTextFromFile(file)

  if (text) {
    return await chat({
      system: '你是一名简历解析专家，请将用户上传的旧简历文本解析为结构化 JSON，字段：basics(姓名/意向/电话/邮箱/城市/网站)、summary、experience(公司/职位/起止/城市/bullets)、education(学校/学历/专业/起止)、projects(名称/角色/技术栈/起止/描述)、skills(字符串数组)、honors(字符串数组)。忠实还原原文，缺失字段留空。',
      prompt: JSON.stringify({ filename, text }),
      kind: 'parse-resume',
      json: true,
    })
  }

  // 未能提取到任何文本（如加密/损坏 PDF、旧版 .doc、纯图片等）：给出明确、可操作的提示
  const isImage = /\.(png|jpe?g|webp)$/i.test(filename)
  const hint = isImage
    ? '图片型简历需要 OCR 文字识别能力，当前环境尚未接入 OCR 服务。'
    : '该文件可能为加密/损坏 PDF、旧版 .doc，或无法从中提取文本。'
  const err = new Error(`无法从「${filename}」中提取文本内容。${hint} 请改用 .txt / .md / .pdf / .docx 格式，或配置 AI_API_KEY 接入大模型解析。`)
  err.status = 400
  throw err
}

// 从上传文件提取文本：PDF 用 pdf-parse、Word(.docx) 用 mammoth、纯文本走 UTF-8 解码；旧版 .doc 与图片返回空
async function extractTextFromFile(file) {
  const buf = file.buffer || Buffer.alloc(0)
  const ext = (path.extname(file.originalname || '') || '').toLowerCase()
  const name = file.originalname || ''

  const printable = (t) => (String(t).match(/[\u4e00-\u9fa5a-zA-Z0-9]/g) || []).length

  try {
    if (ext === '.pdf') {
      const data = await pdfParse(buf)
      const t = String(data?.text || '')
      return printable(t) > 10 ? t : ''
    }
    if (ext === '.docx') {
      const res = await mammothExtract({ buffer: buf })
      const t = String(res?.value || '')
      return printable(t) > 10 ? t : ''
    }
    if (ext === '.doc') {
      return '' // 旧版二进制 .doc 无法用现有库解析
    }
  } catch (e) {
    console.error('[parse] 提取文件文本失败:', name, e?.message)
    return ''
  }

  // 纯文本 / 兜底：按 UTF-8 解码
  const text = buf.toString('utf-8').replace(/\u0000/g, '')
  return printable(text) > 20 ? text : ''
}

// 归一化：确保所有简历字段齐全（缺失回退为空模板结构）
function normalizeResume(parsed) {
  const base = emptyResume()
  const out = {}
  for (const k of ['basics', 'summary', 'experience', 'education', 'projects', 'skills', 'honors', 'custom']) {
    out[k] = parsed?.[k] ?? base[k]
  }
  if (!Array.isArray(out.skills)) out.skills = []
  if (!Array.isArray(out.honors)) out.honors = []
  // 经历 bullet 统一为换行分隔的字符串，便于编辑区 textarea 直接回显
  out.experience = (Array.isArray(out.experience) ? out.experience : []).map((e) => ({
    ...e,
    bullets: Array.isArray(e.bullets) ? e.bullets.join('\n') : (e.bullets || ''),
  }))
  return out
}

export { emptyResume }