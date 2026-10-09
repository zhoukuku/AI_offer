import { useEffect, useState } from 'react'
import { api, getStoredUser, setStoredUser } from '../api.js'
import Icon from '../components/Icon.jsx'

function fmtDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('zh-CN')
}

export default function Upgrade() {
  const [payment, setPayment] = useState(false)
  const [user, setUser] = useState(getStoredUser())
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  useEffect(() => {
    api.health().then(h => setPayment(h.capabilities?.payment)).catch(() => {})
    api.payPlans().then(setPlans).catch(() => {})
    // 拉最新会员状态（可能刚开通）
    api.me().then((u) => { setStoredUser(u); setUser(u) }).catch(() => {})
  }, [])

  const q = user?.quota || {}
  const effective = q.effective === 'pro'
  const stateText = q.proActive ? '会员' : '免费版'

  async function checkout(key) {
    setLoading(true); setError(''); setOk('')
    try {
      const result = await api.checkout(key)
      if (result.payUrl) { window.location.assign(result.payUrl); return }
      const u = result.user
      setStoredUser(u); setUser(u)
      setOk(result.mock ? '演示权益已开通，没有发生真实扣款' : '会员已生效')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="page-header flex-between">
        <div>
          <h1 style={{ margin: 0 }}>升级会员</h1>
          <p className="mt-8">会员可增加使用额度；服务是否可用取决于当前配置。</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {ok && <div className="ok-banner">{ok}</div>}

      {/* 当前状态 */}
      <div className="card card-pad mb-16">
        <div className="flex-between">
          <div className="flex-center gap-8">
            <span className="upgrade-state-dot" style={{ background: effective ? 'var(--green)' : 'var(--orange)' }} />
            <b>当前状态：{stateText}</b>
          </div>
          {q.proActive && <span className="muted small">到期时间：{fmtDate(user?.planExpiresAt)}</span>}
        </div>
        <div className="upgrade-quota-row">
          <div className="upgrade-quota">
            <div className="upgrade-quota-label">AI 调用剩余</div>
            <div className="upgrade-quota-value">{q.aiRemaining === -1 ? '不限' : q.aiRemaining}</div>
          </div>
          <div className="upgrade-quota">
            <div className="upgrade-quota-label">可保留简历</div>
            <div className="upgrade-quota-value">{q.resumeRemaining === -1 ? '不限' : q.resumeRemaining}</div>
          </div>
        </div>
      </div>

      {q.aiResetsAt && <p className="muted small">本期额度重置：{fmtDate(q.aiResetsAt)} · 未用次数不累计</p>}
      {/* 套餐 */}
      <div className="upgrade-plans">
        {plans.length === 0 && <div className="muted small">加载套餐中…</div>}
        {plans.map((p) => (
          <div className="upgrade-plan highlight" key={p.key}>
            <div className="upgrade-plan-tag">月度会员</div>
            <div className="upgrade-plan-name">{p.name}</div>
            <div className="upgrade-plan-price"><b>¥{(p.price / 100).toFixed(0)}</b><span>/月</span></div>
            <div className="upgrade-plan-desc">每 {p.days} 天 {p.aiQuota} 次 AI 调用，每天最多 {p.dailyQuota} 次；失败不扣次</div>
            <button className="btn btn-primary btn-block" onClick={() => checkout(p.key)} disabled={loading || !payment}>
              {loading ? '开通中…' : payment ? '模拟开通（不扣款）' : '支付服务尚未接入'}
            </button>
          </div>
        ))}
      </div>

      <div className="muted small mt-16" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name="shield" size={14} /> 演示环境可模拟开通；真实支付、订单和回调尚未接入。
      </div>
    </div>
  )
}