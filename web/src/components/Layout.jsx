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
  { to: '/cover', label: '求职信', icon: 'pencil' },
]

export default function Layout() {
  const nav = useNavigate()
  const [mode, setMode] = useState('')
  const [user, setUser] = useState(getStoredUser())

  useEffect(() => {
    api.health().then((h) => setMode(h.mode)).catch(() => setMode('unknown'))

    // 登录态失效时跳回登录页
    const onUnauthorized = () => {
      setUser(null)
      nav('/login', { replace: true })
    }
    window.addEventListener('rw-unauthorized', onUnauthorized)
    return () => window.removeEventListener('rw-unauthorized', onUnauthorized)
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
          <div className="user-chip">
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
            <div className="plan-chip">
              <div className="plan-chip-info">
                <span className={`plan-chip-badge${quota.effective === 'pro' ? ' pro' : ''}`}>{planLabel}</span>
                {showUpgrade && <span className="plan-chip-sub">剩余 AI {quota.aiRemaining === -1 ? '不限' : quota.aiRemaining} 次</span>}
              </div>
              {showUpgrade && (
                <button className="plan-chip-btn" onClick={() => nav('/upgrade')}>
                  <Icon name="sparkles" size={13} />升级
                </button>
              )}
            </div>
          )}
          <span className={`mode-badge mode-${mode}`}>
            {mode === 'mock' ? '演示模式（未配置 API Key）' : mode === 'live' ? '已接入大模型' : '...'}
          </span>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}