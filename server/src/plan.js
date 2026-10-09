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

// 免费档剩余 AI 免费试用次数；会员 / 管理员返回 -1 表示不限
export function aiRemaining(user) {
  const s = planState(user)
  if (s.effective === 'pro') return -1
  return Math.max(0, config.subscription.free.aiQuota - (user?.aiUsed || 0))
}

// 免费档剩余简历名额；会员 / 管理员返回 -1 表示不限
export function resumeRemaining(user) {
  const s = planState(user)
  if (s.effective === 'pro') return -1
  return Math.max(0, config.subscription.free.maxResumes - store.countResumes(user.id))
}

// AI 调用配额中间件：免费档超出免费试用次数拦截；免费档每次调用消耗 1 次
export function requireAIQuota(req, res, next) {
  const s = planState(req.user)
  if (s.effective === 'free') {
    if (aiRemaining(req.user) <= 0) {
      return res.status(402).json({ error: '免费 AI 试用次数已用完，请开通会员', code: 'UPGRADE_REQUIRED', upgrade: true })
    }
    if (!store.reserveAI(req.user.id, config.subscription.free.aiQuota)) {
      return res.status(402).json({ error: '免费 AI 次数已用完，请开通会员', code: 'UPGRADE_REQUIRED', upgrade: true })
    }
    let settled = false
    const settle = () => {
      if (settled) return
      settled = true
      if (!res.writableFinished || res.statusCode >= 400) store.refundAI(req.user.id)
    }
    res.once('finish', settle)
    res.once('close', settle)
  }
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