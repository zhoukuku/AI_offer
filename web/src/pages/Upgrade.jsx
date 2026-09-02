import { useEffect, useState } from 'react'
import { api, getStoredUser, setStoredUser } from '../api.js'
import Icon from '../components/Icon.jsx'

function fmtDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('zh-CN')
}

export default function Upgrade() {
  const [user, setUser] = useState(getStoredUser())
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  useEffect(() => {
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
      const u = await api.checkout(key)
      setStoredUser(u); setUser(u)
      setOk('开通成功，会员已生效 ✦')
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
          <p className="mt-8">解锁全部 AI 功能与无限简历，让求职更高效。</p>
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
            <div className="upgrade-quota-label">AI 免费试用剩余</div>
            <div className="upgrade-quota-value">{q.aiRemaining === -1 ? '不限' : q.aiRemaining}</div>
          </div>
          <div className="upgrade-quota">
            <div className="upgrade-quota-label">可保留简历</div>
            <div className="upgrade-quota-value">{q.resumeRemaining === -1 ? '不限' : q.resumeRemaining}</div>
          </div>
        </div>
      </div>

      {/* 套餐 */}
      <div className="upgrade-plans">
        {plans.length === 0 && <div className="muted small">加载套餐中…</div>}
        {plans.map((p) => (
          <div className="upgrade-plan highlight" key={p.key}>
            <div className="upgrade-plan-tag">全功能解锁</div>
            <div className="upgrade-plan-name">{p.name}</div>
            <div className="upgrade-plan-price"><b>¥{(p.price / 100).toFixed(0)}</b><span>/月</span></div>
            <div className="upgrade-plan-desc">无限 AI 优化、无限简历与全部模板，随开随用</div>
            <button className="btn btn-primary btn-block" onClick={() => checkout(p.key)} disabled={loading}>
              {loading ? '开通中…' : `立即开通 · ¥${(p.price / 100).toFixed(0)}`}
            </button>
          </div>
        ))}
      </div>

      <div className="muted small mt-16" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name="shield" size={14} /> 当前为模拟开通（本地验证付费链路），正式支付即将上线，可直接切换到支付宝/微信商户号。
      </div>
    </div>
  )
}