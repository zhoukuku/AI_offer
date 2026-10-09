import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import crypto from 'node:crypto'
import Database from 'better-sqlite3'
import config from '../config.js'
import { resumePatch } from '../../../shared/resume.js'

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
    this.db.exec(`CREATE TABLE IF NOT EXISTS ai_quota_requests (
      id TEXT PRIMARY KEY, userId TEXT NOT NULL, periodStart INTEGER NOT NULL,
      createdAt INTEGER NOT NULL, free INTEGER NOT NULL
    ); CREATE INDEX IF NOT EXISTS ai_quota_user_time ON ai_quota_requests(userId, createdAt);`)
    this.db.exec(`CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, userId TEXT NOT NULL, account TEXT NOT NULL,
      category TEXT NOT NULL, action TEXT NOT NULL, resourceId TEXT NOT NULL,
      status INTEGER NOT NULL, duration INTEGER NOT NULL, createdAt INTEGER NOT NULL
    ); CREATE INDEX IF NOT EXISTS operations_time ON operation_logs(createdAt);
    CREATE INDEX IF NOT EXISTS operations_user ON operation_logs(userId, category);`)
    this.db.exec(`CREATE TABLE IF NOT EXISTS model_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT, userId TEXT NOT NULL, task TEXT NOT NULL,
      model TEXT NOT NULL, input INTEGER NOT NULL, output INTEGER NOT NULL, cached INTEGER NOT NULL,
      estimatedCny REAL NOT NULL, createdAt INTEGER NOT NULL
    ); CREATE INDEX IF NOT EXISTS model_usage_time ON model_usage(createdAt);
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, userId TEXT NOT NULL, planKey TEXT NOT NULL, amount INTEGER NOT NULL,
      days INTEGER NOT NULL, provider TEXT NOT NULL, status TEXT NOT NULL,
      createdAt INTEGER NOT NULL, paidAt INTEGER, providerOrderId TEXT
    ); CREATE INDEX IF NOT EXISTS orders_user ON orders(userId,createdAt);`)
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
    const user = this.findUserById(id)
    const now = Date.now()
    const active = user?.plan === 'pro' && (!user.planExpiresAt || user.planExpiresAt > now)
    return this.updateUser(id, { plan: 'pro', planExpiresAt: Math.max(now, user?.planExpiresAt || 0) + days * 86400000, planKey, planStartedAt: active ? user.planStartedAt || user.createdAt : now })
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

  recordModelUsage({userId,task,model,input,output,cached}) {
    const estimatedCny = ((input-cached)*config.ai.inputPrice + cached*config.ai.cachePrice + output*config.ai.outputPrice)/1e6*config.ai.usdCny
    this.db.prepare('INSERT INTO model_usage (userId,task,model,input,output,cached,estimatedCny,createdAt) VALUES (?,?,?,?,?,?,?,?)').run(userId,task,model,input,output,cached,estimatedCny,Date.now())
  }
  costSummary() {
    const since = Date.now()-30*86400000
    const usage = this.db.prepare('SELECT count(*) AS calls,coalesce(sum(input),0) AS input,coalesce(sum(output),0) AS output,coalesce(sum(estimatedCny),0) AS estimatedCny FROM model_usage WHERE createdAt>=?').get(since)
    const byUser = this.db.prepare('SELECT userId,count(*) AS calls,sum(estimatedCny) AS estimatedCny FROM model_usage WHERE createdAt>=? GROUP BY userId ORDER BY estimatedCny DESC LIMIT 10').all(since).map(r=>({...r,account:this.findUserById(r.userId)?.account || '系统'}))
    const revenue = this.db.prepare("SELECT coalesce(sum(amount),0) AS cents,count(*) AS paidOrders FROM orders WHERE status='paid' AND provider!='mock' AND paidAt>=?").get(since)
    return {...usage,byUser,revenueCny:revenue.cents/100,paidOrders:revenue.paidOrders,since}
  }
  createOrder(userId,planKey,plan,provider) {
    const id = 'ord_'+crypto.randomBytes(12).toString('hex')
    this.db.prepare('INSERT INTO orders VALUES (?,?,?,?,?,?,?,?,?,?)').run(id,userId,planKey,plan.price,plan.days,provider,'pending',Date.now(),null,null)
    return this.getOrder(id,userId)
  }
  getOrder(id,userId) { return this.db.prepare('SELECT * FROM orders WHERE id=? AND userId=?').get(id,userId) || null }
  listOrders(userId) { return this.db.prepare('SELECT * FROM orders WHERE userId=? ORDER BY createdAt DESC LIMIT 100').all(userId) }
  failOrder(id) { this.db.prepare("UPDATE orders SET status='failed' WHERE id=? AND status='pending'").run(id) }
  // Called only after a trusted provider verifies payment. Idempotent settlement and entitlement update.
  settleOrder(id,{amount,providerOrderId}) {
    return this.db.transaction(()=>{
      const order=this.db.prepare('SELECT * FROM orders WHERE id=?').get(id)
      if (!order || order.amount!==amount) throw new Error('订单不存在或金额不一致')
      if (order.status==='paid') return this.findUserById(order.userId)
      if (order.status!=='pending') throw new Error('订单状态不可支付')
      const user=this.grantPlan(order.userId,{planKey:order.planKey,days:order.days})
      if (!user) throw new Error('用户不存在')
      this.db.prepare("UPDATE orders SET status='paid',paidAt=?,providerOrderId=? WHERE id=?").run(Date.now(),providerOrderId||'',id)
      return user
    })()
  }

  logOperation({ userId, account, category, action, resourceId = '', status, duration }) {
    this.db.prepare('INSERT INTO operation_logs (userId,account,category,action,resourceId,status,duration,createdAt) VALUES (?,?,?,?,?,?,?,?)').run(userId,account,category,action,resourceId,status,duration,Date.now())
  }

  operationLogs({ userId = '', category = '', page = 1 } = {}) {
    const where = 'WHERE (? = \'\' OR userId = ?) AND (? = \'\' OR category = ?)'
    const params = [userId,userId,category,category]
    const total = this.db.prepare('SELECT count(*) AS n FROM operation_logs '+where).get(...params).n
    const rows = this.db.prepare('SELECT * FROM operation_logs '+where+' ORDER BY id DESC LIMIT 25 OFFSET ?').all(...params,(page-1)*25)
    return { rows, total, page, pageSize:25 }
  }

  operationsSummary() {
    const now = Date.now(), day = 86400000
    const today = Math.floor((now + 8*3600000)/day)*day-8*3600000
    const since = today-6*day
    const trend = this.db.prepare("SELECT date(createdAt/1000,'unixepoch','+8 hours') AS date, count(*) AS operations, sum(category='ai' AND status<400) AS ai FROM operation_logs WHERE createdAt>=? GROUP BY date").all(since)
    const users = this.listUsers().filter(u=>u.role!=='admin')
    return {
      customers:users.length,
      members:users.filter(u=>u.plan==='pro'&&(!u.planExpiresAt||u.planExpiresAt>now)).length,
      todayActive:this.db.prepare('SELECT count(DISTINCT userId) AS n FROM operation_logs WHERE createdAt>=?').get(today).n,
      todayAI:this.db.prepare("SELECT count(*) AS n FROM operation_logs WHERE createdAt>=? AND category='ai' AND status<400").get(today).n,
      todayFailures:this.db.prepare('SELECT count(*) AS n FROM operation_logs WHERE createdAt>=? AND status>=400').get(today).n,
      trend:Array.from({length:7},(_,i)=>{const date=new Date(since+i*day+8*3600000).toISOString().slice(0,10);return trend.find(r=>r.date===date)||{date,operations:0,ai:0}}),
      loggingSince:this.db.prepare('SELECT min(createdAt) AS t FROM operation_logs').get().t || null,
    }
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

  countAIQuota(userId, start, free = false) {
    return this.db.prepare('SELECT count(*) AS n FROM ai_quota_requests WHERE userId = ? AND createdAt >= ? AND free = ?').get(userId, start, free ? 1 : 0).n
  }

  reserveAIQuota(userId, { limit, periodStart, dailyLimit, dayStart, free }) {
    return this.db.transaction(() => {
      const user = this.findUserById(userId)
      const used = free ? user?.aiUsed || 0 : this.countAIQuota(userId, periodStart)
      if (!user || used >= limit) return { error: 'period' }
      const daily = this.db.prepare('SELECT count(*) AS n FROM ai_quota_requests WHERE userId = ? AND createdAt >= ?').get(userId, dayStart).n
      if (daily >= dailyLimit) return { error: 'daily' }
      const id = crypto.randomBytes(16).toString('hex')
      this.db.prepare('INSERT INTO ai_quota_requests VALUES (?, ?, ?, ?, ?)').run(id, userId, periodStart, Date.now(), free ? 1 : 0)
      if (free) this.updateUser(userId, { aiUsed: (user.aiUsed || 0) + 1 })
      return { id }
    })()
  }

  refundAIQuota(id) {
    this.db.transaction(() => {
      const record = this.db.prepare('SELECT * FROM ai_quota_requests WHERE id = ?').get(id)
      if (!record) return
      this.db.prepare('DELETE FROM ai_quota_requests WHERE id = ?').run(id)
      if (record.free) {
        const user = this.findUserById(record.userId)
        if (user) this.updateUser(user.id, { aiUsed: Math.max(0, (user.aiUsed || 0) - 1) })
      }
    })()
  }

  // Reserve quota synchronously in one SQLite transaction, including multiple server processes.
  reserveAI(userId, limit) {
    return this.db.transaction(() => {
      const user = this.findUserById(userId)
      if (!user || (user.aiUsed || 0) >= limit) return false
      this.updateUser(userId, { aiUsed: (user.aiUsed || 0) + 1 })
      return true
    })()
  }

  refundAI(userId) {
    this.db.transaction(() => {
      const user = this.findUserById(userId)
      if (user) this.updateUser(userId, { aiUsed: Math.max(0, (user.aiUsed || 0) - 1) })
    })()
  }

  createResumeWithContent(name, content, userId, max = -1) {
    return this.db.transaction(() => {
      if (max >= 0 && this.countResumes(userId) >= max) {
        const error = new Error('简历名额已用完，请保存为当前简历的版本或升级会员')
        error.status = 402
        throw error
      }
      const resume = this.createResume(name, userId)
      return this.updateResume(resume.id, content, userId)
    })()
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
    Object.assign(r, resumePatch(patch), { updatedAt: Date.now() })
    return this._save('resumes', id, r, r.createdAt, r.updatedAt)
  }

  deleteResume(id, userId) {
    const r = this.getResume(id, userId)
    if (!r) return false
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM shares WHERE resumeId = ?').run(id)
      this.db.prepare('DELETE FROM resumes WHERE id = ?').run(id)
    })()
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
      jd: app.jd || '',
      userId,
      createdAt: Date.now(),
    }
    return this._save('applications', rec.id, rec, rec.createdAt, rec.createdAt)
  }

  updateApplication(id, patch, userId) {
    const rec = this._byUser('applications', userId).find((a) => a.id === id)
    if (!rec) return null
    Object.assign(rec, Object.fromEntries(Object.entries(patch).filter(([key]) => !['id', 'userId', 'createdAt'].includes(key))), { updatedAt: Date.now() })
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
    const item = { ...rec, id: genId(), userId, createdAt: Date.now() }
    return this._save('interviews', item.id, item, item.createdAt, item.createdAt)
  }

  updateInterview(id, patch, userId) {
    const rec = this._byUser('interviews', userId).find((a) => a.id === id)
    if (!rec) return null
    Object.assign(rec, Object.fromEntries(Object.entries(patch).filter(([key]) => !['id', 'userId', 'createdAt'].includes(key))), { updatedAt: Date.now() })
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
