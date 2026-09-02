import crypto from 'node:crypto'
import config from './config.js'
import store from './store/db.js'
import { getSms, isMockSms } from './integrations/sms.js'

// 签名密钥：未配置时进程内随机生成（重启后旧登录态失效）
const SECRET = config.auth.secret || crypto.randomBytes(32).toString('hex')

// 生成登录态 token（HMAC 签名，格式：payload.signature，base64url）
export function signToken(userId) {
  const payload = `${userId}.${Date.now() + config.auth.tokenTtl}`
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('hex')
  return Buffer.from(`${payload}.${sig}`).toString('base64url')
}

// ---- 密码加密（scrypt + 随机盐）----
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(String(password), salt, 32).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const check = crypto.scryptSync(String(password), salt, 32)
  const expect = Buffer.from(hash, 'hex')
  if (check.length !== expect.length) return false
  return crypto.timingSafeEqual(check, expect)
}

// 校验 token，成功返回 userId，失败返回 null
export function verifyToken(token) {
  if (!token) return null
  let decoded
  try {
    decoded = Buffer.from(token, 'base64url').toString('utf-8')
  } catch {
    return null
  }
  const idx = decoded.lastIndexOf('.')
  if (idx === -1) return null
  const payload = decoded.slice(0, idx)
  const sig = decoded.slice(idx + 1)
  const expect = crypto.createHmac('sha256', SECRET).update(payload).digest('hex')
  if (sig !== expect) return null
  const [userId, exp] = payload.split('.')
  if (!userId || !exp || Number(exp) < Date.now()) return null
  return userId
}

// ---- 短信验证码（委托给 integrations/sms.js，支持 mock / 真实服务商）----
// 发送验证码：mock 模式返回 { delivered:false, code }（code 随接口回显，便于本地联调）
export async function sendCode(phone) {
  return getSms().send(phone)
}

// 校验验证码；成功清除并返回 true
export function verifyCode(phone, code) {
  return getSms().verify(phone, code)
}

// 当前是否 mock 短信（供 index.js 决定是否回显验证码）
export function smsIsMock() {
  return isMockSms()
}

// ---- 鉴权中间件 ----
function readToken(req) {
  const h = req.headers.authorization
  if (h && h.startsWith('Bearer ')) return h.slice(7)
  return req.headers['x-auth-token'] || ''
}

export function requireAuth(req, res, next) {
  const userId = verifyToken(readToken(req))
  if (!userId) return res.status(401).json({ error: '未登录或登录已过期' })
  const user = store.findUserById(userId)
  if (!user || user.status !== 'active') return res.status(401).json({ error: '账号不可用' })
  req.user = user
  next()
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' })
  }
  next()
}

// 对外的简洁封装：解析出当前用户（供可选鉴权的接口用）
export function currentUser(req) {
  const userId = verifyToken(readToken(req))
  return userId ? store.findUserById(userId) : null
}