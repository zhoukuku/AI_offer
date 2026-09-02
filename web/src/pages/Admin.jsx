import { useEffect, useState } from 'react'
import { api, getStoredUser } from '../api.js'
import Icon from '../components/Icon.jsx'

function formatTime(ts) {
  if (!ts) return '-'
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Admin() {
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState(null)
  const [error, setError] = useState('')
  const me = getStoredUser()

  function load() {
    Promise.all([api.adminStats(), api.adminUsers()])
      .then(([s, u]) => { setStats(s); setUsers(u) })
      .catch((e) => setError(e.message))
  }

  useEffect(() => { load() }, [])

  async function setRole(u, role) {
    if (u.id === me?.id) return setError('不能修改自己的角色')
    try { await api.adminUpdateUser(u.id, { role }); load() } catch (e) { setError(e.message) }
  }

  async function setStatus(u, status) {
    if (u.id === me?.id) return setError('不能禁用自己的账号')
    try { await api.adminUpdateUser(u.id, { status }); load() } catch (e) { setError(e.message) }
  }

  const statItems = stats
    ? [
        { key: 'users', label: '注册用户', icon: 'user', color: '#eaf2fe', value: stats.users },
        { key: 'resumes', label: '简历总数', icon: 'file', color: '#eef1ff', value: stats.resumes },
        { key: 'apps', label: '投递总数', icon: 'inbox', color: '#e9f9ef', value: stats.applications },
        { key: 'interviews', label: '面试复盘', icon: 'calendar', color: '#fef3e2', value: stats.interviews },
      ]
    : []

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>管理后台</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>管理用户、角色与平台运营数据</p>
        </div>
      </div>

      <div className="stat-grid">
        {statItems.map((s) => (
          <div className="card stat-card" key={s.key}>
            <div className="stat-icon" style={{ background: s.color }}><Icon name={s.icon} size={20} /></div>
            <div>
              <div className="stat-num">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card card-pad">
        <div className="flex-between mb-16">
          <div className="section-title">用户列表（{users?.length ?? 0}）</div>
        </div>
        {users === null ? (
          <div className="loading">加载中…</div>
        ) : users.length === 0 ? (
          <div className="empty"><div className="empty-icon">👥</div>暂无用户</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>用户</th>
                  <th>手机号</th>
                  <th>角色</th>
                  <th>状态</th>
                  <th>注册时间</th>
                  <th style={{ textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="admin-user-cell">
                        <div className="admin-avatar">{u.nickname?.[0] || '用'}</div>
                        <div>
                          <div className="admin-uname">{u.nickname || '未设置昵称'}{u.id === me?.id && <span className="badge badge-primary" style={{ marginLeft: 6 }}>我</span>}</div>
                          <div className="muted small">{u.plan === 'free' ? '免费用户' : u.plan}</div>
                        </div>
                      </div>
                    </td>
                    <td>{u.phone === 'admin' ? '-' : u.phone}</td>
                    <td>
                      <span className={`badge ${u.role === 'admin' ? 'badge-primary' : 'badge-gray'}`}>{u.role === 'admin' ? '管理员' : '普通用户'}</span>
                    </td>
                    <td>
                      <span className="status-dot" style={{ background: u.status === 'active' ? '#16a34a' : '#ef4444' }} />
                      {u.status === 'active' ? '正常' : '已禁用'}
                    </td>
                    <td className="muted small">{formatTime(u.createdAt)}</td>
                    <td>
                      <div className="admin-actions">
                        {u.role === 'user'
                          ? <button className="btn btn-sm btn-ghost" onClick={() => setRole(u, 'admin')}>设为管理员</button>
                          : <button className="btn btn-sm btn-ghost" onClick={() => setRole(u, 'user')}>取消管理员</button>}
                        {u.status === 'active'
                          ? <button className="btn btn-sm btn-danger" onClick={() => setStatus(u, 'disabled')}>禁用</button>
                          : <button className="btn btn-sm btn-ghost" onClick={() => setStatus(u, 'active')}>启用</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}