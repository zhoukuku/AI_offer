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
  const [tab, setTab] = useState('overview')
  const [logs, setLogs] = useState(null)
  const [category, setCategory] = useState('')
  const [filterUser, setFilterUser] = useState('')
  const [page, setPage] = useState(1)
  const [refresh, setRefresh] = useState(0)
  const me = getStoredUser()

  function load() {
    Promise.all([api.adminStats(), api.adminUsers()])
      .then(([s, u]) => { setStats(s); setUsers(u) })
      .catch((e) => setError(e.message))
  }

  useEffect(() => { load() }, [refresh])
  useEffect(() => {
    let active = true
    setLogs(null)
    api.adminLogs({category,userId:filterUser,page}).then(data=>{if(active)setLogs(data)}).catch(e=>{if(active)setError(e.message)})
    return ()=>{active=false}
  }, [category,filterUser,page,refresh])

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
        { key: 'users', label: '普通用户', icon: 'user', color: '#eaf2fe', value: stats.customers },
        { key: 'resumes', label: '简历总数', icon: 'file', color: '#eef1ff', value: stats.resumes },
        { key: 'apps', label: '有效会员', icon: 'inbox', color: '#e9f9ef', value: stats.members },
        { key: 'interviews', label: '今日 AI 成功', icon: 'calendar', color: '#fef3e2', value: stats.todayAI },
      ]
    : []

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>运营 Dashboard</h1>
          <p className="muted small" style={{ margin: '4px 0 0' }}>用户增长、简历活动与 AI 服务运行状况</p>
        </div>
      </div>

      <div className="admin-tabs no-print">
        {[['overview','运营概览'],['users','用户管理'],['logs','操作与简历日志']].map(([key,label])=><button key={key} className={`btn ${tab===key?'btn-primary':''}`} onClick={()=>setTab(key)}>{label}</button>)}
        <button className="btn" onClick={()=>{setError('');setRefresh(n=>n+1)}}>刷新数据</button>
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

      {tab === 'overview' && stats && <div className="admin-overview grid">
        <div className="card card-pad">
          <div className="section-title">最近 7 天平台活动</div>
          <p className="muted small">蓝色为操作总数，浅色为其中的 AI 成功请求</p>
          <div className="admin-bars">{stats.trend.map(day=><div key={day.date} className="admin-bar-day">
            <span>{day.operations}</span><div className="admin-bar-track"><div style={{height:`${Math.max(2,day.operations / Math.max(1,...stats.trend.map(d=>d.operations))*100)}%`}} /><div className="admin-bar-ai" style={{height:`${Math.max(0,day.ai / Math.max(1,...stats.trend.map(d=>d.operations))*100)}%`}} /></div><small>{day.date.slice(5)}</small>
          </div>)}</div>
        </div>
        <div className="card card-pad"><div className="section-title">运行概况</div>
          <div className="admin-summary-line"><span>今日活跃账号</span><b>{stats.todayActive}</b></div>
          <div className="admin-summary-line"><span>今日失败操作</span><b>{stats.todayFailures}</b></div>
          <div className="admin-summary-line"><span>投递 / 面试记录</span><b>{stats.applications} / {stats.interviews}</b></div>
          <p className="muted small">日志从功能启用后开始记录；未补造历史记录。登录及管理员测试操作也计入活动。</p>
          <p className="muted small">真实支付尚未接入，模拟会员不代表真实营收。</p>
          <button className="btn" onClick={()=>setTab('logs')}>查看操作日志</button>
        </div>
      </div>}
      {(tab === 'overview' || tab === 'logs') && <div className="card card-pad mt-16">
        <div className="flex-between"><div className="section-title">{tab==='overview'?'近期操作':'操作与简历日志'}</div><span className="muted small">共 {logs?.total ?? 0} 条</span></div>
        <div className="admin-log-filters">
          <select className="select" aria-label="日志类型" value={category} onChange={e=>{setCategory(e.target.value);setPage(1)}}><option value="">全部操作</option>{[['resume','简历日志'],['ai','AI 调用'],['auth','登录与注册'],['application','投递记录'],['interview','面试复盘'],['payment','会员操作'],['admin','管理操作']].map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>
          <select className="select" aria-label="日志用户" value={filterUser} onChange={e=>{setFilterUser(e.target.value);setPage(1)}}><option value="">全部用户</option>{(users||[]).map(u=><option key={u.id} value={u.id}>{u.account || u.nickname}</option>)}</select>
        </div>
        {!logs ? <div className="loading">加载日志中…</div> : !logs.rows.length ? <div className="empty">暂无符合条件的操作记录</div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>时间</th><th>账号</th><th>操作</th><th>资源 ID</th><th>结果</th><th>耗时</th></tr></thead><tbody>{logs.rows.slice(0,tab==='overview'?8:25).map(row=><tr key={row.id}><td className="small">{new Date(row.createdAt).toLocaleString('zh-CN')}</td><td>{row.account}</td><td>{row.action}</td><td className="muted small">{row.resourceId || '—'}</td><td><span className={`badge ${row.status<400?'badge-green':'badge-red'}`}>{row.status<400?'成功':'失败'} · {row.status}</span></td><td>{row.duration} ms</td></tr>)}</tbody></table></div>}
        {tab==='logs' && <div className="admin-log-filters"><button className="btn btn-sm" disabled={page<=1||!logs} onClick={()=>setPage(p=>p-1)}>上一页</button><span>第 {page} 页</span><button className="btn btn-sm" disabled={!logs||page*25>=logs.total} onClick={()=>setPage(p=>p+1)}>下一页</button></div>}
      </div>}
      {tab === 'users' && <div className="card card-pad">
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
                          <div className="muted small">{u.quota?.proActive ? '有效会员' : u.role==='admin' ? '管理员' : '免费用户'}</div>
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
                          : <button disabled={u.id===me?.id} className="btn btn-sm btn-ghost" onClick={() => setRole(u, 'user')}>取消管理员</button>}
                        {u.status === 'active'
                          ? <button disabled={u.id===me?.id} className="btn btn-sm btn-danger" onClick={() => setStatus(u, 'disabled')}>禁用</button>
                          : <button className="btn btn-sm btn-ghost" onClick={() => setStatus(u, 'active')}>启用</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>}
    </div>
  )
}