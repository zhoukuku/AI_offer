import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { api, getStoredUser, logout } from '../api.js'
import Icon from './Icon.jsx'

const BASE_NAV = [
  { to: '/app', label: '我的简历', icon: 'file', end: true },
  { to: '/ai', label: 'AI 对话分析', icon: 'chat' },
  { to: '/match', label: '岗位适配', icon: 'target' },
  { to: '/companies', label: '大厂信息源', icon: 'building' },
  { to: '/applications', label: '投递记录', icon: 'inbox' },
  { to: '/interviews', label: '面试复盘', icon: 'calendar' },
  { to: '/greet', label: 'Boss 打招呼', icon: 'send' },
  { to: '/cover', label: '求职信', icon: 'pencil' },
  { to: '/examples', label: '范文库', icon: 'star' },
]

export default function Layout() {
  const nav = useNavigate()
  const [mode, setMode] = useState('')
  const [upgradeNotice, setUpgradeNotice] = useState('')
  const [capabilities, setCapabilities] = useState({})
  const [user, setUser] = useState(getStoredUser())

  useEffect(() => {
    api.health().then((h) => { setMode(h.mode); setCapabilities(h.capabilities || {}) }).catch(() => setMode('unknown'))

    api.me().catch(() => {})
    const onUser = () => setUser(getStoredUser())
    const onUpgrade = e => setUpgradeNotice(e.detail)
    window.addEventListener('rw-user-updated', onUser)
    window.addEventListener('rw-upgrade-required', onUpgrade)
    // 登录态失效时跳回登录页
    const onUnauthorized = () => {
      setUser(null)
      nav('/login', { replace: true })
    }
    window.addEventListener('rw-unauthorized', onUnauthorized)
    return () => { window.removeEventListener('rw-unauthorized', onUnauthorized); window.removeEventListener('rw-user-updated', onUser); window.removeEventListener('rw-upgrade-required', onUpgrade) }
  }, [nav])

  function doLogout() {
    logout()
    setUser(null)
    nav('/login', { replace: true })
  }

  const NAV = user?.role === 'admin' ? [...BASE_NAV, { to: '/admin', label: '管理后台', icon: 'shield' }] : BASE_NAV
  const isAdmin = user?.role === 'admin'
  const quota = user?.quota || {}
  const planLabel = quota.proActive ? '会员' : '免费版'
  const showUpgrade = !isAdmin && quota.effective !== 'pro'

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">简</div>
          <div>
            <div className="brand-name">简历工作台</div>
            <div className="brand-sub">AI Resume Studio</div>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon"><Icon name={n.icon} size={16} /></span>
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          {/* 账户卡：用户 + 配额合并，一卡搞定 */}
          <div className="account-card">
            <div className="account-row">
              <div className={`user-avatar${isAdmin ? ' admin' : ''}`}>{user?.nickname?.[0] || '用'}</div>
              <div className="user-meta">
                <div className="user-name">{user?.nickname || '未登录'}</div>
                <div className="user-phone">{user?.phone === 'admin' ? '管理员' : user?.phone || ''}</div>
              </div>
              <button className="user-logout" onClick={doLogout} title="退出登录">
                <Icon name="logout" size={15} />
              </button>
            </div>
            {!isAdmin && (
              <div className="plan-row">
                <div className="plan-info">
                  <span className={`plan-chip-badge${quota.effective === 'pro' ? ' pro' : ''}`}>{planLabel}</span>
                  {showUpgrade && <span className="plan-chip-sub">剩余 AI {quota.aiRemaining === -1 ? '不限' : quota.aiRemaining} 次</span>}
                </div>
                {showUpgrade && (
                  <button className="plan-chip-btn" onClick={() => nav('/upgrade')}>
                    <Icon name="sparkles" size={12} />升级
                  </button>
                )}
              </div>
            )}
          </div>
          <span className={`mode-badge mode-${mode}`}>
            {mode === 'local' ? '本地规则模式' : mode === 'live' ? '已接入大模型' : '...'}
          </span>
        </div>
      </aside>

      <main className="content">
        {mode === 'local' && <div className="service-notice">当前使用本地规则：检查真实内容和关键词，不生成虚构经历。翻译需要接入大模型；截图识别可接 DeepSeek 视觉模型；录音识别需独立转写服务。</div>}
        {upgradeNotice && <div className="service-notice">{upgradeNotice} <button className="btn btn-sm" onClick={() => { setUpgradeNotice(''); nav('/upgrade') }}>查看权益</button><button className="btn btn-sm btn-ghost" onClick={() => setUpgradeNotice('')}>关闭</button></div>}
        <Outlet context={{ capabilities }} />
      </main>
    </div>
  )
}