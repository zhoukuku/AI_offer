import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '../../data')
const DB_FILE = path.join(DATA_DIR, 'db.json')

// 生成短 id
function genId() {
  return crypto.randomBytes(6).toString('hex')
}

// 简历的默认结构（空模板）
export function emptyResume() {
  return {
    basics: { name: '', title: '', phone: '', email: '', city: '', website: '', avatar: '' },
    summary: '',
    experience: [],
    education: [],
    projects: [],
    skills: [],
    honors: [],
    custom: [],
    // 同一个人针对不同岗位定制的多版本内容快照
    versions: [],
  }
}

// 简单的 JSON 文件数据库（单进程场景足够，写操作串行落盘）
class Store {
  constructor() {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    if (fs.existsSync(DB_FILE)) {
      try {
        this.data = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'))
      } catch {
        this.data = this._defaults()
      }
    } else {
      this.data = this._defaults()
    }
    this._migrate()
    this._persist()
  }

  _defaults() {
    return {
      users: [],
      resumes: [],
      applications: [],
      interviews: [],
      recordings: [],
      shares: [],
    }
  }

  // 数据兜底：确保各字段存在。旧数据（无用户归主）暂时保留，待首个真实用户接管。
  _migrate() {
    if (!Array.isArray(this.data.users)) this.data.users = []
    if (!Array.isArray(this.data.resumes)) this.data.resumes = []
    if (!Array.isArray(this.data.applications)) this.data.applications = []
    if (!Array.isArray(this.data.interviews)) this.data.interviews = []
    if (!Array.isArray(this.data.recordings)) this.data.recordings = []
    if (!Array.isArray(this.data.shares)) this.data.shares = []
    this.data.resumes.forEach((r) => { if (!Array.isArray(r.versions)) r.versions = [] })
  }

  // 将历史遗留的"孤儿"数据（无 userId）归属给指定用户（用于首个注册用户平滑接管）
  adoptOrphans(userId) {
    let changed = false
    this.data.resumes.forEach((r) => { if (!r.userId) { r.userId = userId; changed = true } })
    this.data.applications.forEach((a) => { if (!a.userId) { a.userId = userId; changed = true } })
    this.data.interviews.forEach((i) => { if (!i.userId) { i.userId = userId; changed = true } })
    if (changed) this._persist()
  }

  _persist() {
    // 原子写入：先写临时文件再重命名，避免进程中断导致数据文件损坏
    const tmp = DB_FILE + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf-8')
    fs.renameSync(tmp, DB_FILE)
  }

  // ---- 用户 ----
  findUserByPhone(phone) {
    return this.data.users.find((u) => u.phone === phone) || null
  }

  findUserByAccount(account) {
    return this.data.users.find((u) => u.account === account) || null
  }

  findUserById(id) {
    return this.data.users.find((u) => u.id === id) || null
  }

  createUser({ account, passwordHash, phone, nickname, role }) {
    const now = Date.now()
    const user = {
      id: genId(),
      account: account || '', // 登录账号（账号密码登录）
      passwordHash: passwordHash || '', // 密码哈希（scrypt: salt:hash）
      phone,
      nickname: nickname || '',
      avatar: '',
      role: role || 'user',
      status: 'active',
      plan: 'free',
      planExpiresAt: null,
      aiUsed: 0, // 免费档已消耗的 AI 免费试用次数（会员期不计）
      createdAt: now,
      lastLoginAt: now,
    }
    this.data.users.push(user)
    this._persist()
    return user
  }

  updateUser(id, patch) {
    const u = this.findUserById(id)
    if (!u) return null
    Object.assign(u, patch, { updatedAt: Date.now() })
    this._persist()
    return u
  }

  // 开通会员（模拟支付：直接写入 plan=pro 与到期时间）
  grantPlan(id, { planKey, days }) {
    const u = this.findUserById(id)
    if (!u) return null
    return this.updateUser(id, { plan: 'pro', planExpiresAt: Date.now() + days * 86400000, planKey })
  }

  // 用户已保留的简历数量（用于免费档简历名额判断）
  countResumes(userId) {
    return this.data.resumes.filter((r) => r.userId === userId).length
  }

  listUsers() {
    return [...this.data.users].sort((a, b) => a.createdAt - b.createdAt)
  }

  countUsers() {
    return this.data.users.length
  }

  // 全局统计（管理员看板）
  stats() {
    return {
      users: this.data.users.length,
      resumes: this.data.resumes.length,
      applications: this.data.applications.length,
      interviews: this.data.interviews.length,
    }
  }

  // ---- 简历 ----
  listResumes(userId) {
    return this.data.resumes
      .filter((r) => r.userId === userId)
      .map((r) => ({
        id: r.id,
        name: r.name,
        title: r.basics?.title || '',
        name2: r.basics?.name || '',
        versionCount: (r.versions || []).length,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }))
  }

  getResume(id, userId) {
    const r = this.data.resumes.find((r) => r.id === id)
    if (r && userId && r.userId !== userId) return null
    return r || null
  }

  createResume(name, userId) {
    const now = Date.now()
    const r = { id: genId(), name: name || '未命名简历', ...emptyResume(), userId, createdAt: now, updatedAt: now }
    this.data.resumes.push(r)
    this._persist()
    return r
  }

  updateResume(id, patch, userId) {
    const r = this.getResume(id, userId)
    if (!r) return null
    Object.assign(r, patch, { updatedAt: Date.now() })
    this._persist()
    return r
  }

  deleteResume(id, userId) {
    const i = this.data.resumes.findIndex((r) => r.id === id && r.userId === userId)
    if (i === -1) return false
    this.data.resumes.splice(i, 1)
    this._persist()
    return true
  }

  // ---- 投递记录 ----
  listApplications(userId) {
    return [...this.data.applications]
      .filter((a) => a.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  addApplication(app, userId) {
    const rec = {
      id: genId(),
      company: app.company || '',
      position: app.position || '',
      url: app.url || '',
      status: app.status || '已投递', // 已投递/笔试/面试/Offer/已拒绝
      note: app.note || '',
      source: app.source || '', // 投递渠道：官网/Boss直聘/内推/猎头…
      deadline: app.deadline || '', // 截止日期 YYYY-MM-DD
      followUp: app.followUp || '', // 跟进日期 YYYY-MM-DD
      resumeId: app.resumeId || null,
      userId,
      createdAt: Date.now(),
    }
    this.data.applications.push(rec)
    this._persist()
    return rec
  }

  updateApplication(id, patch, userId) {
    const rec = this.data.applications.find((a) => a.id === id && a.userId === userId)
    if (!rec) return null
    Object.assign(rec, patch, { updatedAt: Date.now() })
    this._persist()
    return rec
  }

  deleteApplication(id, userId) {
    this.data.applications = this.data.applications.filter((a) => !(a.id === id && a.userId === userId))
    this._persist()
  }

  // ---- 面试复盘 ----
  listInterviews(userId) {
    return [...this.data.interviews]
      .filter((i) => i.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  addInterview(rec, userId) {
    const item = { id: genId(), ...rec, userId, createdAt: Date.now() }
    this.data.interviews.push(item)
    this._persist()
    return item
  }

  updateInterview(id, patch, userId) {
    const rec = this.data.interviews.find((a) => a.id === id && a.userId === userId)
    if (!rec) return null
    Object.assign(rec, patch, { updatedAt: Date.now() })
    this._persist()
    return rec
  }

  // ---- 加密投递链接（分享给 HR，支持阅读追踪 / 撤销）----
  // 同一份简历复用同一个私密链接；已存在的直接返回
  createShare(resumeId, userId) {
    const existing = this.data.shares.find((s) => s.resumeId === resumeId && s.userId === userId)
    if (existing) return existing
    const s = {
      id: genId(),
      resumeId,
      userId,
      token: crypto.randomBytes(16).toString('hex'), // 128 位随机令牌，不可猜测
      createdAt: Date.now(),
      views: [], // 阅读追踪：[{ at, ua }]
    }
    this.data.shares.push(s)
    this._persist()
    return s
  }

  getShareByResume(resumeId, userId) {
    return this.data.shares.find((s) => s.resumeId === resumeId && s.userId === userId) || null
  }

  getShareByToken(token) {
    return this.data.shares.find((s) => s.token === token) || null
  }

  // 记录一次阅读（HR 打开链接时）
  trackShareView(token, ua = '') {
    const s = this.getShareByToken(token)
    if (!s) return false
    s.views.push({ at: Date.now(), ua: String(ua).slice(0, 200) })
    this._persist()
    return true
  }

  revokeShare(resumeId, userId) {
    const before = this.data.shares.length
    this.data.shares = this.data.shares.filter((s) => !(s.resumeId === resumeId && s.userId === userId))
    if (this.data.shares.length !== before) this._persist()
  }
}

const store = new Store()
export default store