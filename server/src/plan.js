import config from './config.js'
import store from './store/db.js'

// 计算用户当前生效的权益状态。
// 规则：管理员始终全功能；付费会员期内全功能；否则为免费档（有限的免费试用次数）。
export function planState(user) {
  const now = Date.now()
  const isAdmin = user?.role === 'admin'
  const proActive = user?.plan === 'pro' && (!user?.planExpiresAt || now < user?.planExpiresAt)
  const effective = isAdmin || proActive ? 'pro' : 'free'
  return {
    plan: user?.plan || 'free',
    isAdmin,
    proActive,
    effective,
    planExpiresAt: user?.planExpiresAt || null,
  }
}

const PERIOD = 30 * 86400000
export function aiPeriod(user, now = Date.now()) {
  const anchor = user?.planStartedAt || user?.createdAt || now
  const start = anchor + Math.max(0, Math.floor((now - anchor) / PERIOD)) * PERIOD
  return { start, resetsAt: Math.min(start + PERIOD, user?.planExpiresAt || start + PERIOD) }
}

export function aiRemaining(user) {
  const s = planState(user)
  if (s.isAdmin) return -1
  if (s.proActive) return Math.max(0, config.subscription.pro.aiQuota - store.countAIQuota(user.id, aiPeriod(user).start))
  return Math.max(0, config.subscription.free.aiQuota - (user?.aiUsed || 0))
}

// 免费档剩余简历名额；会员 / 管理员返回 -1 表示不限
export function resumeRemaining(user) {
  const s = planState(user)
  if (s.effective === 'pro') return -1
  return Math.max(0, config.subscription.free.maxResumes - store.countResumes(user.id))
}

// All customers use the server key; quota reservations are atomic and failed requests are refunded.
export function requireAIQuota(req, res, next) {
  const s = planState(req.user)
  if (s.isAdmin) return next()
  const now = Date.now()
  const reserved = store.reserveAIQuota(req.user.id, {
    limit: s.proActive ? config.subscription.pro.aiQuota : config.subscription.free.aiQuota,
    free: !s.proActive, periodStart: s.proActive ? aiPeriod(req.user).start : 0,
    dailyLimit: config.subscription.pro.dailyQuota,
    dayStart: Math.floor((now + 8 * 3600000) / 86400000) * 86400000 - 8 * 3600000,
  })
  if (reserved.error === 'daily') return res.status(429).json({ error: '今日 AI 调用次数已用完，明日再试', code: 'DAILY_QUOTA_EXCEEDED' })
  if (reserved.error) return res.status(402).json({ error: s.proActive ? '本期 AI 次数已用完，请等待下期额度重置' : '免费 AI 试用次数已用完，请开通会员', code: s.proActive ? 'AI_QUOTA_EXCEEDED' : 'UPGRADE_REQUIRED', upgrade: !s.proActive })
  let settled = false
  const settle = () => {
    if (settled) return
    settled = true
    if (!res.writableFinished || res.statusCode >= 400) store.refundAIQuota(reserved.id)
  }
  res.once('finish', settle)
  res.once('close', settle)
  next()
}

// 简历创建配额中间件：免费档超出名额拦截
export function requireResumeQuota(req, res, next) {
  const s = planState(req.user)
  if (s.effective === 'free' && resumeRemaining(req.user) <= 0) {
    return res.status(402).json({ error: '免费版简历名额已用完，请升级会员', code: 'UPGRADE_REQUIRED', upgrade: true })
  }
  next()
}