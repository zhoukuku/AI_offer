import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import Database from 'better-sqlite3'
import config from '../config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '../../data')
fs.mkdirSync(DATA_DIR, { recursive: true })

// SQLite 数据库文件（生产级：支持多用户并发、原子事务）
const DB_FILE = config.db.file
  ? path.resolve(config.db.file)
  : path.join(DATA_DIR, 'app.db')

// ===== 生成短 id =====
function genId() {
  return crypto.randomBytes(6).toString('hex')
}

// ===== 简历默认结构（空模板）=====
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

// ===== SQLite 存储层 =====
// 设计：每个实体一张表，核心字段（id / userId / token / 时间戳）单独成列用于索引与计数，
// 其余富结构（简历正文、申请记录、面试复盘、分享阅读追踪等）以 JSON 存入 data 列。
// 对外暴露的方法签名与原 JSON 文件版完全一致，调用方（index / auth / plan）无需改动。
class Store {
  constructor() {
    this.db = new Database(DB_FILE)
    this.db.pragma('journal_mode = WAL') // 写前日志，提升并发读写性能
    this.db.pragma('busy_timeout = 5000') // 锁等待，避免并发写入偶发失败
    this._initSchema()
    this._migrateFromJson()
    this._healUserIdColumns()
  }

  // 自检修复：早期版本通过 _save 写入时未填充 userId 列，导致 _byUser 过滤失效。
  // 从 data 列的 JSON 回填 userId 列，幂等，可重复执行。
  _healUserIdColumns() {
    for (const t of ['resumes', 'applications', 'interviews']) {
      try {
        this.db.prepare(
          `UPDATE ${t} SET userId = json_extract(data, '$.userId') WHERE userId IS NULL AND json_extract(data, '$.userId') IS NOT NULL`
        ).run()
      } catch (e) {
        console.error('[heal] 回填 userId 列失败:', t, e?.message)
      }
    }
  }

  _initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        createdAt INTEGER,
        updatedAt INTEGER
      );
      CREATE TABLE IF NOT EXISTS resumes (
        id TEXT PRIMARY KEY,
        userId TEXT,
        data TEXT NOT NULL,
        createdAt INTEGER,
        updatedAt INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_resumes_user ON resumes(userId);
      CREATE TABLE IF NOT EXISTS applications (
        id TEXT PRIMARY KEY,
        userId TEXT,
        data TEXT NOT NULL,
        createdAt INTEGER,
        updatedAt INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_apps_user ON applications(userId);
      CREATE TABLE IF NOT EXISTS interviews (
        id TEXT PRIMARY KEY,
        userId TEXT,
        data TEXT NOT NULL,
        createdAt INTEGER,
        updatedAt INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_interviews_user ON interviews(userId);
      CREATE TABLE IF NOT EXISTS shares (
        id TEXT PRIMARY KEY,
        resumeId TEXT,
        userId TEXT,
        token TEXT UNIQUE,
        data TEXT NOT NULL,
        createdAt INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_shares_token ON shares(token);
      CREATE INDEX IF NOT EXISTS idx_shares_ru ON shares(resumeId, userId);
    `)
  }

  // 从旧版 db.json 一次性迁移（仅当目标表为空且 db.json 存在时），迁移后改名避免重复执行
  _migrateFromJson() {
    const jsonPath = path.join(DATA_DIR, 'db.json')
    if (!fs.existsSync(jsonPath)) return
    const userCount = this.db.prepare('SELECT COUNT(*) AS c FROM users').get().c
    if (userCount > 0) {
      // 已迁移过，直接归档旧文件
      try { fs.renameSync(jsonPath, jsonPath + '.migrated') } catch {}
      return
    }
    let json
    try {
      json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
    } catch {
      return
    }
    const insertUser = this.db.prepare('INSERT OR REPLACE INTO users (id, data, createdAt, updatedAt) VALUES (?, ?, ?, ?)')
    const insertResume = this.db.prepare('INSERT OR REPLACE INTO resumes (id, userId, data, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)')
    const insertApp = this.db.prepare('INSERT OR REPLACE INTO applications (id, userId, data, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)')
    const insertInterview = this.db.prepare('INSERT OR REPLACE INTO interviews (id, userId, data, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)')
    const insertShare = this.db.prepare('INSERT OR REPLACE INTO shares (id, resumeId, userId, token, data, createdAt) VALUES (?, ?, ?, ?, ?, ?)')

    const tx = this.db.transaction(() => {
      for (const u of json.users || []) insertUser.run(u.id, JSON.stringify(u), u.createdAt || Date.now(), u.updatedAt || Date.now())
      for (const r of json.resumes || []) insertResume.run(r.id, r.userId || null, JSON.stringify(r), r.createdAt || Date.now(), r.updatedAt || Date.now())
      for (const a of json.applications || []) insertApp.run(a.id, a.userId || null, JSON.stringify(a), a.createdAt || Date.now(), a.updatedAt || Date.now())
      for (const i of json.interviews || []) insertInterview.run(i.id, i.userId || null, JSON.stringify(i), i.createdAt || Date.now(), i.updatedAt || Date.now())
      for (const s of json.shares || []) insertShare.run(s.id, s.resumeId || null, s.userId || null, s.token || '', JSON.stringify(s), s.createdAt || Date.now())
    })
    tx()
    try { fs.renameSync(jsonPath, jsonPath + '.migrated') } catch {}
    console.log(`   ✓ 已从 db.json 迁移 ${ (json.users||[]).length } 用户 / ${ (json.resumes||[]).length } 简历 至 SQLite`)
  }

  // ---- 通用读写助手 ----
  _get(table, id) {
    const row = this.db.prepare(`SELECT data FROM ${table} WHERE id = ?`).get(id)
    return row ? JSON.parse(row.data) : null
  }

  // 写入实体：users 表无 userId 列；业务表（resumes/applications/interviews）需同步 userId 列，
  // 以便 _byUser 按列过滤（保证多用户数据隔离与列表/更新/删除正确）。
  _save(table, id, obj, createdAt, updatedAt) {
    if (table === 'users') {
      this.db.prepare(`INSERT OR REPLACE INTO users (id, data, createdAt, updatedAt) VALUES (?, ?, ?, ?)`)
        .run(id, JSON.stringify(obj), createdAt ?? Date.now(), updatedAt ?? Date.now())
    } else {
      this.db.prepare(`INSERT OR REPLACE INTO ${table} (id, userId, data, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)`)
        .run(id, obj?.userId ?? null, JSON.stringify(obj), createdAt ?? Date.now(), updatedAt ?? Date.now())
    }
    return obj
  }

  _all(table) {
    return this.db.prepare(`SELECT data FROM ${table}`).all().map((r) => JSON.parse(r.data))
  }

  _byUser(table, userId) {
    return this.db.prepare(`SELECT data FROM ${table} WHERE userId = ?`).all(userId).map((r) => JSON.parse(r.data))
  }

  // ===== 用户 =====
  findUserByPhone(phone) {
    return this._all('users').find((u) => u.phone === phone) || null
  }

  findUserByAccount(account) {
    return this._all('users').find((u) => u.account === account) || null
  }

  findUserById(id) {
    return this._get('users', id) || null
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
    return this._save('users', user.id, user, now, now)
  }

  updateUser(id, patch) {
    const u = this.findUserById(id)
    if (!u) return null
    Object.assign(u, patch, { updatedAt: Date.now() })
    return this._save('users', id, u, u.createdAt, u.updatedAt)
  }

  // 开通会员（模拟支付：直接写入 plan=pro 与到期时间）
  grantPlan(id, { planKey, days }) {
    return this.updateUser(id, { plan: 'pro', planExpiresAt: Date.now() + days * 86400000, planKey })
  }

  // 用户已保留的简历数量（用于免费档简历名额判断）
  countResumes(userId) {
    return this.db.prepare('SELECT COUNT(*) AS c FROM resumes WHERE userId = ?').get(userId).c
  }

  listUsers() {
    return this._all('users').sort((a, b) => a.createdAt - b.createdAt)
  }

  countUsers() {
    return this.db.prepare('SELECT COUNT(*) AS c FROM users').get().c
  }

  // 全局统计（管理员看板）
  stats() {
    return {
      users: this.db.prepare('SELECT COUNT(*) AS c FROM users').get().c,
      resumes: this.db.prepare('SELECT COUNT(*) AS c FROM resumes').get().c,
      applications: this.db.prepare('SELECT COUNT(*) AS c FROM applications').get().c,
      interviews: this.db.prepare('SELECT COUNT(*) AS c FROM interviews').get().c,
    }
  }

  // 历史遗留的"孤儿"数据（无 userId）归属给指定用户（用于首个注册用户平滑接管）
  adoptOrphans(userId) {
    let changed = false
    for (const r of this._all('resumes')) {
      if (!r.userId) { r.userId = userId; this._save('resumes', r.id, r, r.createdAt, Date.now()); changed = true }
    }
    for (const a of this._all('applications')) {
      if (!a.userId) { a.userId = userId; this._save('applications', a.id, a, a.createdAt, Date.now()); changed = true }
    }
    for (const i of this._all('interviews')) {
      if (!i.userId) { i.userId = userId; this._save('interviews', i.id, i, i.createdAt, Date.now()); changed = true }
    }
    return changed
  }

  // ===== 简历 =====
  listResumes(userId) {
    return this._byUser('resumes', userId).map((r) => ({
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
    const r = this._get('resumes', id)
    if (r && userId && r.userId !== userId) return null
    return r || null
  }

  createResume(name, userId) {
    const now = Date.now()
    const r = { id: genId(), name: name || '未命名简历', ...emptyResume(), userId, createdAt: now, updatedAt: now }
    return this._save('resumes', r.id, r, now, now)
  }

  updateResume(id, patch, userId) {
    const r = this.getResume(id, userId)
    if (!r) return null
    Object.assign(r, patch, { updatedAt: Date.now() })
    return this._save('resumes', id, r, r.createdAt, r.updatedAt)
  }

  deleteResume(id, userId) {
    const r = this.getResume(id, userId)
    if (!r) return false
    this.db.prepare('DELETE FROM resumes WHERE id = ?').run(id)
    return true
  }

  // ===== 投递记录 =====
  listApplications(userId) {
    return this._byUser('applications', userId)
      .map((a) => ({ ...a, createdAt: a.createdAt || Date.now() }))
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
    return this._save('applications', rec.id, rec, rec.createdAt, rec.createdAt)
  }

  updateApplication(id, patch, userId) {
    const rec = this._byUser('applications', userId).find((a) => a.id === id)
    if (!rec) return null
    Object.assign(rec, patch, { updatedAt: Date.now() })
    return this._save('applications', id, rec, rec.createdAt, rec.updatedAt)
  }

  deleteApplication(id, userId) {
    const rec = this._byUser('applications', userId).find((a) => a.id === id)
    if (!rec) return
    this.db.prepare('DELETE FROM applications WHERE id = ?').run(id)
  }

  // ===== 面试复盘 =====
  listInterviews(userId) {
    return this._byUser('interviews', userId)
      .map((i) => ({ ...i, createdAt: i.createdAt || Date.now() }))
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  addInterview(rec, userId) {
    const item = { id: genId(), ...rec, userId, createdAt: Date.now() }
    return this._save('interviews', item.id, item, item.createdAt, item.createdAt)
  }

  updateInterview(id, patch, userId) {
    const rec = this._byUser('interviews', userId).find((a) => a.id === id)
    if (!rec) return null
    Object.assign(rec, patch, { updatedAt: Date.now() })
    return this._save('interviews', id, rec, rec.createdAt, rec.updatedAt)
  }

  deleteInterview(id, userId) {
    const rec = this._byUser('interviews', userId).find((a) => a.id === id)
    if (!rec) return
    this.db.prepare('DELETE FROM interviews WHERE id = ?').run(id)
  }

  // ===== 加密投递链接（分享给 HR，支持阅读追踪 / 撤销）=====
  // 同一份简历复用同一个私密链接；已存在的直接返回
  createShare(resumeId, userId) {
    const existing = this.db.prepare('SELECT data FROM shares WHERE resumeId = ? AND userId = ?').get(resumeId, userId)
    if (existing) return JSON.parse(existing.data)
    const s = {
      id: genId(),
      resumeId,
      userId,
      token: crypto.randomBytes(16).toString('hex'), // 128 位随机令牌，不可猜测
      createdAt: Date.now(),
      views: [], // 阅读追踪：[{ at, ua }]
    }
    this.db.prepare('INSERT OR REPLACE INTO shares (id, resumeId, userId, token, data, createdAt) VALUES (?, ?, ?, ?, ?, ?)')
      .run(s.id, resumeId, userId, s.token, JSON.stringify(s), s.createdAt)
    return s
  }

  getShareByResume(resumeId, userId) {
    const row = this.db.prepare('SELECT data FROM shares WHERE resumeId = ? AND userId = ?').get(resumeId, userId)
    return row ? JSON.parse(row.data) : null
  }

  getShareByToken(token) {
    const row = this.db.prepare('SELECT data FROM shares WHERE token = ?').get(token)
    return row ? JSON.parse(row.data) : null
  }

  // 记录一次阅读（HR 打开链接时）
  trackShareView(token, ua = '') {
    const s = this.getShareByToken(token)
    if (!s) return false
    s.views.push({ at: Date.now(), ua: String(ua).slice(0, 200) })
    this.db.prepare('UPDATE shares SET data = ? WHERE token = ?').run(JSON.stringify(s), token)
    return true
  }

  revokeShare(resumeId, userId) {
    this.db.prepare('DELETE FROM shares WHERE resumeId = ? AND userId = ?').run(resumeId, userId)
  }
}

const store = new Store()
export default store
