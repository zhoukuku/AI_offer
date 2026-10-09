import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getStoredUser } from '../api.js'
import Icon from '../components/Icon.jsx'
import { Preview } from '../components/Preview.jsx'

const FINAL_STATUS = ['Offer', '已拒绝']
const STAGE = { '已投递': 0, '笔试': 1, '面试': 2, 'Offer': 3 }
const STATUS_COLOR = {
  '已投递': '#3b82f6',
  '笔试': '#f59e0b',
  '面试': '#8b5cf6',
  'Offer': '#16a34a',
  '已拒绝': '#ef4444',
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysUntil(d) {
  if (!d) return null
  const t = new Date(d + 'T00:00:00')
  if (Number.isNaN(t.getTime())) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((t - today) / 86400000)
}

export default function Dashboard() {
  const nav = useNavigate()
  const fileRef = useRef(null)
  const [list, setList] = useState(null)
  const [previews, setPreviews] = useState({})
  const [visibleCount, setVisibleCount] = useState(6)
  const [apps, setApps] = useState([])
  const [interviews, setInterviews] = useState([])
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [user, setUser] = useState(getStoredUser())

  function load() { api.listResumes().then(rows => setList([...rows].sort((a,b) => b.updatedAt - a.updatedAt))).catch((e) => setError(e.message)) }

  useEffect(() => {
    load()
    Promise.all([api.listApplications(), api.listInterviews()])
      .then(([a, i]) => { setApps(a); setInterviews(i) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    let active = true
    Promise.allSettled((list || []).slice(0, visibleCount).map(r => api.getResume(r.id))).then(results => {
      if (active) setPreviews(Object.fromEntries(results.filter(r => r.status === 'fulfilled').map(r => [r.value.id, r.value])))
    })
    return () => { active = false }
  }, [list, visibleCount])

  async function create() {
    try {
      const r = await api.createResume('新建简历')
      nav(`/resume/${r.id}`)
    } catch (e) { setError(e.message) }
  }

  async function remove(id, e) {
    e.stopPropagation()
    if (!confirm('确定删除这份简历吗？')) return
    try { await api.deleteResume(id); load() } catch (err) { setError(err.message) }
  }

  async function rename(r, e) {
    e.stopPropagation()
    const next = window.prompt('重命名简历', r.name || '')
    if (!next || !next.trim() || next.trim() === r.name) return
    try { await api.updateResume(r.id, { name: next.trim() }); load() } catch (err) { setError(err.message) }
  }

  async function duplicate(r, e) {
    e.stopPropagation()
    try {
      const src = await api.getResume(r.id)
      await api.createResume(`${src.name || r.name}（副本）`, { template: src.template, accent: src.accent,
        basics: src.basics, summary: src.summary, experience: src.experience,
        education: src.education, projects: src.projects, skills: src.skills, honors: src.honors, custom: src.custom,
      })
      load()
    } catch (err) { setError(err.message) }
  }

  // 上传旧简历，解析后自动生成新简历并进入编辑
  async function importResume(file) {
    if (!file) return
    setImporting(true)
    setError('')
    try {
      const r = await api.importResume(file)
      nav(`/resume/${r.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function pickFile(e) {
    importResume(e.target.files?.[0])
  }

  // 统计
  const totalApps = apps.length
  const activeApps = apps.filter((a) => !FINAL_STATUS.includes(a.status))
  const offers = apps.filter((a) => a.status === 'Offer')
  const conversion = totalApps ? Math.round((offers.length / totalApps) * 100) : 0

  const statItems = [
    { key: 'apps', label: '投递总数', icon: 'inbox', color: '#eaf2fe', value: totalApps },
    { key: 'active', label: '进行中', icon: 'trendingUp', color: '#eef1ff', value: activeApps.length },
    { key: 'interviews', label: '面试复盘', icon: 'calendar', color: '#e9f9ef', value: interviews.length },
    { key: 'offers', label: '已获 Offer', icon: 'trophy', color: '#fef3e2', value: offers.length },
  ]

  // 漏斗
  const funnelStages = ['已投递', '笔试', '面试', 'Offer']
  const stages = totalApps
    ? funnelStages.map((label, i) => ({ label, count: apps.filter((a) => (STAGE[a.status] ?? 0) >= i).length }))
    : []

  // 待办提醒
  const deadlineUrgent = apps.filter((a) => {
    const d = daysUntil(a.deadline)
    return d != null && d <= 7 && !FINAL_STATUS.includes(a.status)
  })
  const followUpDue = apps.filter((a) => {
    const d = daysUntil(a.followUp)
    return d != null && d <= 3 && !FINAL_STATUS.includes(a.status)
  })

  // 最近动态：投递 + 面试复盘合并
  const activity = [
    ...apps.map((a) => ({ ts: a.createdAt, type: '投递', title: a.company, sub: a.position || a.status, color: STATUS_COLOR[a.status] || '#3b82f6' })),
    ...interviews.map((i) => ({ ts: i.createdAt, type: '面试复盘', title: i.company, sub: i.position || '', color: '#8b5cf6' })),
  ].sort((a, b) => b.ts - a.ts).slice(0, 6)

  return (
    <div>
      {/* 页面头部：统一的页头规则 */}
      <div className="page-header page-header-row">
        <div className="page-header-left">
          <div className="page-header-title">
            <h1>我的求职工作台</h1>
            <p>欢迎回来，{user?.nickname || '同学'}。先准备一份好简历，再向心仪的岗位出发。</p>
          </div>
        </div>
        <div className="page-header-actions">
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={importing}>
            <Icon name="image" size={15} />{importing ? '导入中…' : '导入旧简历'}
          </button>
          <button className="btn btn-primary" onClick={create}>
            <Icon name="plus" size={15} />新建简历
          </button>
        </div>
      </div>

      <div className="page-header-row section-header-row">
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>我的简历 <span className="muted small" style={{ marginLeft: 8 }}>{list?.length || 0} 份</span></h2>
        <div className="page-header-actions">
          <button className="btn btn-sm" onClick={() => fileRef.current?.click()} disabled={importing}>
            <Icon name="image" size={14} />{importing ? '导入中…' : '导入旧简历'}
          </button>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp"
        style={{ display: 'none' }}
        onChange={pickFile}
      />

      {list === null ? (
        <div className="loading">加载中…</div>
      ) : list.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-state-art">
            <svg viewBox="0 0 80 80" width="80" height="80" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="14" y="10" width="44" height="56" rx="6" fill="url(#g1)" />
              <rect x="22" y="6" width="44" height="56" rx="6" fill="#fff" stroke="url(#g1)" strokeWidth="1.5" />
              <rect x="30" y="18" width="28" height="3" rx="1.5" fill="#cbd5e1" />
              <rect x="30" y="26" width="22" height="3" rx="1.5" fill="#e2e8f0" />
              <rect x="30" y="36" width="28" height="3" rx="1.5" fill="#cbd5e1" />
              <rect x="30" y="44" width="18" height="3" rx="1.5" fill="#e2e8f0" />
              <rect x="30" y="54" width="28" height="3" rx="1.5" fill="#cbd5e1" />
              <circle cx="56" cy="14" r="11" fill="var(--primary)" />
              <path d="M52 14h8M56 10v8" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#6366f1" />
                  <stop offset="1" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="empty-state-title">还没有简历，开始你的第一份吧</div>
          <div className="empty-state-sub">填写真实经历，或导入已有的 PDF、Word、TXT 简历。图片识别需要配置视觉服务。</div>
          <div className="empty-state-actions">
            <button className="btn btn-primary" onClick={create}><Icon name="plus" size={15} />创建第一份简历</button>
            <button className="btn" onClick={() => fileRef.current?.click()} disabled={importing}>
              <Icon name="image" size={15} />{importing ? '导入中…' : '导入旧简历'}
            </button>
            <button className="btn btn-ghost" onClick={() => nav('/examples')}><Icon name="star" size={15} />参考范文</button>
          </div>
        </div>
      ) : (
        <div className="resume-grid">
          {list.slice(0, visibleCount).map((r) => (
            <div key={r.id} className="card resume-card">
              <button className="resume-thumbnail" aria-label={`编辑简历：${r.name}`} onClick={() => nav(`/resume/${r.id}`)}>
                {previews[r.id] ? <div className="resume-thumbnail-paper" aria-hidden="true"><Preview resume={previews[r.id]} template={previews[r.id].template} accent={previews[r.id].accent} /></div> : <span className="muted">简历预览</span>}
              </button>
              <div className="rc-actions">
                <button className="btn btn-sm btn-ghost" title="重命名" onClick={(e) => rename(r, e)}><Icon name="pencil" size={13} /></button>
                <button className="btn btn-sm btn-ghost" title="复制简历" onClick={(e) => duplicate(r, e)}><Icon name="copy" size={13} /></button>
                <button className="btn btn-sm btn-danger" onClick={(e) => remove(r.id, e)}>删除</button>
              </div>
              <div className="rc-name"><button className="resume-title-link" onClick={() => nav(`/resume/${r.id}`)}>{r.name}</button>{r.versionCount > 0 && <span className="badge badge-gray rc-version">{r.versionCount} 个版本</span>}</div>
              <div className="rc-person">{r.name2 || '未填写姓名'}{r.title ? ` · ${r.title}` : ''}</div>
              <div className="rc-time">更新于 {formatTime(r.updatedAt)}</div>
            </div>
          ))}
          <button className="card resume-card resume-card-new" onClick={create}>
            <div className="plus-btn">＋</div>
            <div>新建简历</div><span className="muted small">为不同岗位准备不同版本</span>
          </button>
        </div>
      )}

      {list && list.length > visibleCount && <button className="btn mb-16" onClick={() => setVisibleCount(n => n + 6)}>查看更多简历（还有 {list.length - visibleCount} 份）</button>}
      <div className="card flow-card">
        <div className="section-title">完成一次有针对性的投递</div>
        <p className="muted small">先填写真实经历，再对照岗位调整内容，核实后导出；记录投递并沉淀面试反馈。</p>
        <div className="flow-steps">
          <button className="btn" onClick={() => fileRef.current?.click()}>1. 导入简历</button>
          <button className="btn" onClick={() => list?.[0] ? nav(`/resume/${list[0].id}`) : create()}>2. 编辑与诊断</button>
          <button className="btn" onClick={() => nav('/match')}>3. 对照岗位 JD</button>
          <button className="btn" onClick={() => nav('/applications')}>4. 记录投递</button>
          <button className="btn" onClick={() => nav('/interviews')}>5. 面试与复盘</button>
        </div>
      </div>
      {/* 统计 */}
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

      {/* 求职看板主体 */}
      <div className="grid" style={{ gridTemplateColumns: '1.55fr 1fr', alignItems: 'start' }}>
        {/* 左栏：转化漏斗 + 进行中的投递 */}
        <div>
          <div className="card card-pad mb-16">
            <div className="flex-between mb-16">
              <div className="section-title">求职进度概览</div>
              <span className="muted small">投递转化率 <b style={{ color: 'var(--primary)' }}>{conversion}%</b></span>
            </div>
            {totalApps === 0 ? (
              <div className="empty"><div className="empty-icon">📊</div>还没有投递记录，去「投递记录」添加第一条吧。</div>
            ) : (
              stages.map((s, i) => {
                const width = (s.count / totalApps) * 100
                return (
                  <div className="funnel-row" key={s.label}>
                    <div className="funnel-label">{s.label}</div>
                    <div className="funnel-track">
                      <div className="funnel-bar" style={{ width: `${Math.max(width, 8)}%`, background: STATUS_COLOR[s.label] }}>{s.count}</div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className="card card-pad mb-16">
            <div className="flex-between mb-8">
              <div className="section-title">进行中的投递</div>
              <button className="btn btn-sm btn-ghost" onClick={() => nav('/applications')}>查看全部 <Icon name="arrowLeft" size={13} style={{ transform: 'rotate(180deg)' }} /></button>
            </div>
            {activeApps.length === 0 ? (
              <div className="muted small">暂无进行中的投递。</div>
            ) : (
              <div className="dash-app-list">
                {activeApps.slice(0, 5).map((a) => (
                  <div className="dash-app-item" key={a.id}>
                    <span className="status-dot" style={{ background: STATUS_COLOR[a.status] || '#999' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b>{a.company}</b>
                      <div className="muted small">{a.position || '-'}</div>
                    </div>
                    <span className={`badge ${a.status === '面试' ? 'badge-primary' : a.status === '笔试' ? 'badge-orange' : 'badge-gray'}`}>{a.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 右栏：待办提醒 + 最近动态 */}
        <div>
          <div className="card card-pad mb-16">
            <div className="flex-between mb-8">
              <div className="section-title">待办提醒</div>
              <span className="muted small">{deadlineUrgent.length + followUpDue.length} 项</span>
            </div>
            {deadlineUrgent.length === 0 && followUpDue.length === 0 ? (
              <div className="muted small">暂无待办，一切尽在掌握 👍</div>
            ) : (
              <div className="dash-reminders">
                {deadlineUrgent.map((a) => {
                  const d = daysUntil(a.deadline)
                  return (
                    <div className="dash-reminder" key={'d' + a.id}>
                      <Icon name="clock" size={15} style={{ color: 'var(--orange)' }} />
                      <span style={{ flex: 1 }}><b>{a.company}</b> · {a.position || '岗位'}</span>
                      <span className="badge badge-orange">{d < 0 ? '已截止' : d === 0 ? '今日截止' : `${d} 天后`}</span>
                    </div>
                  )
                })}
                {followUpDue.map((a) => {
                  const d = daysUntil(a.followUp)
                  return (
                    <div className="dash-reminder" key={'f' + a.id}>
                      <Icon name="bell" size={15} style={{ color: 'var(--red)' }} />
                      <span style={{ flex: 1 }}><b>{a.company}</b> · 跟进</span>
                      <span className="badge badge-red">{d < 0 ? `逾期 ${-d} 天` : d === 0 ? '今日' : `${d} 天后`}</span>
                    </div>
                  )
                })}
              </div>
            )}
            <button className="btn btn-block mt-16" onClick={() => nav('/applications')}><Icon name="inbox" size={16} />管理投递记录</button>
          </div>

          <div className="card card-pad">
            <div className="section-title mb-8">最近动态</div>
            {activity.length === 0 ? (
              <div className="muted small">暂无动态。</div>
            ) : (
              <div className="dash-activity">
                {activity.map((a, i) => (
                  <div className="dash-activity-item" key={i}>
                    <span className="dash-activity-dot" style={{ background: a.color }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div><b>{a.title}</b><span className="muted small" style={{ marginLeft: 6 }}>{a.sub}</span></div>
                      <div className="muted small">{formatTime(a.ts)}</div>
                    </div>
                    <span className="badge badge-gray">{a.type}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>


    </div>
  )
}