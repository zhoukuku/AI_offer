import { useEffect, useState } from 'react'
import { api } from '../api.js'
import Icon from '../components/Icon.jsx'

const STATUSES = ['已投递', '笔试', '面试', 'Offer', '已拒绝']
const STATUS_COLOR = {
  '已投递': '#3b82f6',
  '笔试': '#f59e0b',
  '面试': '#8b5cf6',
  'Offer': '#16a34a',
  '已拒绝': '#ef4444',
}
const SOURCES = ['官网', 'Boss直聘', '拉勾', '猎聘', '内推', '猎头', '其他']

const EMPTY_FORM = { company: '', position: '', url: '', note: '', source: '', deadline: '', followUp: '' }

// 计算截止日期紧急程度
function deadlineState(d) {
  if (!d) return null
  const t = new Date(d + 'T00:00:00')
  if (Number.isNaN(t.getTime())) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diff = Math.round((t - today) / 86400000)
  if (diff < 0) return { label: `${-diff} 天前截止`, cls: 'badge-red', urgent: true }
  if (diff === 0) return { label: '今日截止', cls: 'badge-red', urgent: true }
  if (diff <= 7) return { label: `${diff} 天后截止`, cls: 'badge-orange', urgent: true }
  return { label: `${diff} 天后`, cls: '', urgent: false }
}

// 计算跟进状态
function followUpState(fu, status) {
  if (!fu || status === 'Offer' || status === '已拒绝') return null
  const t = new Date(fu + 'T00:00:00')
  if (Number.isNaN(t.getTime())) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diff = Math.round((t - today) / 86400000)
  if (diff <= 0) return { label: diff === 0 ? '今日跟进' : `逾期 ${-diff} 天`, cls: 'badge-red', urgent: true }
  if (diff <= 3) return { label: `${diff} 天后跟进`, cls: 'badge-orange', urgent: false }
  return null
}

export default function Applications() {
  const [list, setList] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')

  function load() { api.listApplications().then(setList).catch((e) => setError(e.message)) }
  useEffect(load, [])

  async function add() {
    if (!form.company.trim()) { setError('请填写公司名称'); return }
    setError('')
    try {
      await api.addApplication(form)
      setForm(EMPTY_FORM)
      load()
    } catch (e) { setError(e.message) }
  }

  async function setStatus(row, status) {
    try { await api.updateApplication(row.id, { status }); load() } catch (e) { setError(e.message) }
  }

  async function remove(id) {
    if (!confirm('删除这条投递记录？')) return
    try { await api.deleteApplication(id); load() } catch (e) { setError(e.message) }
  }

  // 转化漏斗数据（累计口径）
  const stageIndex = { '已投递': 0, '笔试': 1, '面试': 2, 'Offer': 3 }
  const funnelStages = ['已投递', '笔试', '面试', 'Offer']
  const funnelTotal = list?.length || 0
  const stages = funnelTotal
    ? funnelStages.map((label, i) => ({
        label,
        count: list.filter((a) => (stageIndex[a.status] ?? 0) >= i).length,
      }))
    : []
  const funnelPrev = (i) => (i === 0 ? stages[0]?.count || 1 : stages[i - 1]?.count || 1)

  // 待办统计
  const urgentDeadlines = (list || []).filter((a) => deadlineState(a.deadline)?.urgent && a.status !== 'Offer' && a.status !== '已拒绝')
  const followUps = (list || []).filter((a) => followUpState(a.followUp, a.status)?.urgent)

  return (
    <div>
      <div className="page-header">
        <h1>投递记录</h1>
        <p>记录你的每一次网申与投递进度，设置截止日期与跟进提醒，直观跟踪求职全流程。</p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* 待办提醒条 */}
      {(urgentDeadlines.length > 0 || followUps.length > 0) && (
        <div className="reminder-strip mb-16">
          {urgentDeadlines.length > 0 && (
            <div className="reminder-item">
              <Icon name="clock" size={16} />
              <span><b>{urgentDeadlines.length}</b> 个岗位即将截止（{urgentDeadlines.map((a) => a.company).slice(0, 3).join('、')}{urgentDeadlines.length > 3 ? '…' : ''}），请尽快完成投递。</span>
            </div>
          )}
          {followUps.length > 0 && (
            <div className="reminder-item">
              <Icon name="bell" size={16} />
              <span><b>{followUps.length}</b> 条记录需要跟进（{followUps.map((a) => a.company).slice(0, 3).join('、')}{followUps.length > 3 ? '…' : ''}）。</span>
            </div>
          )}
        </div>
      )}

      <div className="card card-pad mb-16">
        <div className="section-title mb-16">新增投递</div>
        <div className="row-3">
          <div className="field" style={{ margin: 0 }}><label className="label">公司 *</label><input className="input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="如：字节跳动" /></div>
          <div className="field" style={{ margin: 0 }}><label className="label">职位</label><input className="input" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="如：前端开发工程师" /></div>
          <div className="field" style={{ margin: 0 }}><label className="label">投递渠道</label>
            <select className="select" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              <option value="">选择渠道</option>
              {SOURCES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="row-3 mt-16">
          <div className="field" style={{ margin: 0 }}><label className="label">截止日期</label><input className="input" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></div>
          <div className="field" style={{ margin: 0 }}><label className="label">跟进日期</label><input className="input" type="date" value={form.followUp} onChange={(e) => setForm({ ...form, followUp: e.target.value })} /></div>
          <div className="field" style={{ margin: 0 }}><label className="label">投递链接</label><input className="input" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" /></div>
        </div>
        <div className="flex gap-8 mt-16">
          <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="备注（可选）" />
          <button className="btn btn-primary" onClick={add}><Icon name="plus" size={16} />添加记录</button>
        </div>
      </div>

      {/* 投递转化漏斗 */}
      {funnelTotal > 0 && (
        <div className="card card-pad mb-16">
          <div className="section-title mb-16">投递转化漏斗</div>
          {stages.map((s, i) => {
            const pct = Math.round((s.count / funnelPrev(i)) * 100)
            const width = funnelTotal ? (s.count / funnelTotal) * 100 : 0
            return (
              <div className="funnel-row" key={s.label}>
                <div className="funnel-label">{s.label}</div>
                <div className="funnel-track">
                  <div className="funnel-bar" style={{ width: `${Math.max(width, 8)}%`, background: STATUS_COLOR[s.label] }}>{s.count} 人</div>
                </div>
                <div className="funnel-pct">{pct}%{i > 0 && <span className="muted" style={{ fontSize: 11 }}> 转化</span>}</div>
              </div>
            )
          })}
          <div className="muted small mt-8">转化率 = 本阶段人数 ÷ 上一阶段人数</div>
        </div>
      )}

      <div className="card">
        {list === null ? (
          <div className="loading">加载中…</div>
        ) : list.length === 0 ? (
          <div className="empty"><div className="empty-icon">📮</div>还没有投递记录</div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>公司</th><th>职位</th><th>渠道</th><th>状态</th><th>截止/跟进</th><th>备注</th><th>投递时间</th><th></th></tr>
            </thead>
            <tbody>
              {list.map((a) => {
                const dd = deadlineState(a.deadline)
                const fu = followUpState(a.followUp, a.status)
                return (
                  <tr key={a.id}>
                    <td><b>{a.company}</b>{a.url && <a href={a.url} target="_blank" rel="noreferrer" className="small" style={{ color: 'var(--primary)', marginLeft: 6 }}>链接</a>}</td>
                    <td>{a.position || '-'}</td>
                    <td className="muted small">{a.source || '-'}</td>
                    <td>
                      <span className="status-dot" style={{ background: STATUS_COLOR[a.status] || '#999' }} />
                      <select className="select" style={{ width: 'auto', padding: '3px 8px', border: 'none', background: 'transparent' }} value={a.status} onChange={(e) => setStatus(a, e.target.value)}>
                        {STATUSES.map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>
                      <div className="flex gap-8 wrap">
                        {dd && <span className={`badge ${dd.cls}`}>{dd.label}</span>}
                        {fu && <span className={`badge ${fu.cls}`}>{fu.label}</span>}
                        {!dd && !fu && <span className="muted small">-</span>}
                      </div>
                    </td>
                    <td className="muted" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.note || '-'}</td>
                    <td className="muted small">{new Date(a.createdAt).toLocaleDateString('zh-CN')}</td>
                    <td className="text-right"><button className="btn btn-sm btn-danger" onClick={() => remove(a.id)}>删除</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}