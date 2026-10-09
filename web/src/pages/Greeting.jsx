import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import Icon from '../components/Icon.jsx'

const STYLES = [
  { key: 'concise', label: '极简有力', hint: '≤45 字 · Boss/脉脉首选', icon: 'send', color: '#10b981' },
  { key: 'professional', label: '专业稳重', hint: '90~120 字 · 国企/外企/正式', icon: 'briefcase', color: '#4f46e5' },
  { key: 'sincere', label: '真诚亲和', hint: '100~140 字 · 创业/中小企业', icon: 'heart', color: '#ec4899' },
  { key: 'technical', label: '技术专项', hint: '100~140 字 · 开发/测试/运维', icon: 'code', color: '#0ea5e9' },
  { key: 'career-change', label: '转行/跨行', hint: '100~140 字 · 跨行业转岗', icon: 'refresh', color: '#f59e0b' },
]

const STATUS = [
  { key: '在职看机会', label: '在职看机会' },
  { key: '离职可立即到岗', label: '离职可立即到岗' },
  { key: '应届2026届', label: '应届 2026 届' },
  { key: '应届2027届', label: '应届 2027 届（实习）' },
]

// 字数合规：Boss 真实硬约束
function lengthBadge(n) {
  if (n <= 50) return { label: 'Boss 可发', cls: 'gd-tag-ok' }
  if (n <= 150) return { label: '通用可发', cls: 'gd-tag-info' }
  return { label: '超出 Boss 限制', cls: 'gd-tag-warn' }
}

export default function Greeting() {
  const [resumes, setResumes] = useState([])
  const [current, setCurrent] = useState('')
  const [resume, setResume] = useState(null)
  const [position, setPosition] = useState('')
  const [status, setStatus] = useState('在职看机会')
  const [highlight, setHighlight] = useState('')
  const [jd, setJd] = useState('')
  const [variants, setVariants] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('') // 哪个 style 被复制了

  useEffect(() => {
    api.listResumes().then((list) => {
      setResumes(list)
      if (list[0]) loadResume(list[0].id)
    })
  }, [])

  function loadResume(id) {
    setCurrent(id)
    api.getResume(id).then((r) => {
      setResume(r)
      if (r.basics?.title && !position) setPosition(r.basics.title)
    })
  }

  async function generate() {
    if (!jd.trim() && !position.trim()) {
      setError('请至少粘贴一份 JD 或填写目标岗位')
      return
    }
    setLoading(true)
    setError('')
    setVariants([])
    setCopied('')
    try {
      const r = await api.greet({ resume, jd, position, status, highlight })
      const list = Array.isArray(r?.variants) ? r.variants : []
      setVariants(list)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  async function copy(text, styleKey) {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(styleKey)
      setTimeout(() => setCopied(''), 1500)
    } catch { /* ignore */ }
  }

  const totalChars = useMemo(() => variants.reduce((s, v) => s + (v.text || '').length, 0), [variants])

  return (
    <div>
      <div className="page-header-row">
        <div className="page-header-left">
          <h1>Boss 打招呼</h1>
          <p>把简历与 JD 喂进来，一键产出 5 种风格的破冰短句。HR 只看前 50 字，前两行必须亮出核心匹配点。</p>
        </div>
        <div className="page-header-actions">
          <a className="btn btn-sm btn-ghost" href="/cover" target="_self">
            <Icon name="pencil" size={14} />需要正式求职信？
          </a>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="grid two-col" style={{ gridTemplateColumns: '420px 1fr', alignItems: 'start' }}>
        {/* 左侧：输入 */}
        <div className="card card-pad">
          <div className="section-title">基础信息</div>

          <div className="field">
            <label className="label">选择简历</label>
            <select className="select" value={current} onChange={(e) => loadResume(e.target.value)}>
              {resumes.length === 0 && <option value="">（暂无简历）</option>}
              {resumes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>

          <div className="field">
            <label className="label">目标岗位（选填，JD 里包含可省略）</label>
            <input className="input" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="如：前端开发工程师" />
          </div>

          <div className="field">
            <label className="label">到岗状态</label>
            <div className="status-pills">
              {STATUS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={`pill${status === s.key ? ' active' : ''}`}
                  onClick={() => setStatus(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="label">想突出的亮点（选填，逗号分隔）</label>
            <textarea
              className="textarea" rows={2}
              value={highlight}
              onChange={(e) => setHighlight(e.target.value)}
              placeholder="如：性能优化、低代码平台、跨团队协作"
            />
          </div>

          <div className="field">
            <label className="label">粘贴岗位 JD <span className="muted small">（推荐，会自动提取关键词）</span></label>
            <textarea
              className="textarea gd-jd" rows={9}
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder={"粘一份 Boss 上的 JD 到这里，例如：\n\n【职位】Agent 算法工程师 - AI Platform\n【职责】\n1. 负责 Agent 框架核心模块设计与开发\n2. LLM 微调与 RAG 检索增强落地\n3. 跨部门协作推进 AI 应用上线\n【要求】\n1. 本科及以上，3 年以上经验\n2. Python、LangChain、向量数据库实战经验"}
            />
          </div>

          <button className="btn btn-primary btn-block" onClick={generate} disabled={loading}>
            <Icon name="sparkles" size={16} />{loading ? '生成中…' : '一键生成 5 种风格'}
          </button>

          {resume && (
            <div className="muted small gd-hint">
              <Icon name="info" size={13} />当前简历：{resume.basics?.name || '未命名'} · {resume.basics?.title || '未填岗位'}
            </div>
          )}
        </div>

        {/* 右侧：5 卡片 */}
        <div className="card card-pad">
          <div className="flex-between mb-12">
            <div>
              <div className="section-title">打招呼语产出</div>
              <div className="muted small">点卡片右上「复制」即可贴到 Boss/脉脉/LinkedIn</div>
            </div>
            {variants.length > 0 && (
              <div className="muted small">共 {variants.length} 条 / 合计 {totalChars} 字</div>
            )}
          </div>

          {!variants.length && !loading && (
            <div className="empty">
              <div className="empty-icon"><Icon name="send" size={40} /></div>
              <div>填好左侧 → 点击「一键生成」 → 这里会出现 5 种风格的打招呼语</div>
            </div>
          )}

          {loading && (
            <div className="gd-skeleton-list">
              {STYLES.map((s) => (
                <div key={s.key} className="gd-card gd-skel">
                  <div className="gd-card-head">
                    <div className="gd-tag" style={{ background: s.color + '22', color: s.color }}>{s.label}</div>
                    <div className="muted small">生成中…</div>
                  </div>
                  <div className="gd-skel-line" style={{ width: '92%' }} />
                  <div className="gd-skel-line" style={{ width: '70%' }} />
                </div>
              ))}
            </div>
          )}

          {variants.length > 0 && (
            <div className="gd-list">
              {variants.map((v) => {
                const meta = STYLES.find((s) => s.key === v.style) || STYLES[0]
                const n = (v.text || '').length
                const badge = lengthBadge(n)
                return (
                  <div key={v.style} className="gd-card">
                    <div className="gd-card-head">
                      <div className="flex-center gap-8">
                        <div className="gd-tag" style={{ background: meta.color + '22', color: meta.color }}>
                          <Icon name={meta.icon} size={13} />{v.label || meta.label}
                        </div>
                        <span className={`gd-length ${badge.cls}`}>
                          {n} 字 · {badge.label}
                        </span>
                      </div>
                      <button className="btn btn-sm" onClick={() => copy(v.text, v.style)}>
                        <Icon name={copied === v.style ? 'check' : 'copy'} size={14} />{copied === v.style ? '已复制' : '复制'}
                      </button>
                    </div>
                    <div className="gd-hint-row">{v.hint || meta.hint}</div>
                    <div className="gd-text">{v.text}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
