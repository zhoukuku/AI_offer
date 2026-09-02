import { useEffect, useState } from 'react'
import { api } from '../api.js'
import Icon from '../components/Icon.jsx'

export default function CoverLetter() {
  const [resumes, setResumes] = useState([])
  const [current, setCurrent] = useState('')
  const [resume, setResume] = useState(null)
  const [company, setCompany] = useState('')
  const [position, setPosition] = useState('')
  const [highlights, setHighlights] = useState('')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

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
    if (!company.trim()) { setError('请填写目标公司'); return }
    setLoading(true); setError(''); setCopied(false)
    try {
      const r = await api.coverletter({ resume, company, position, highlights })
      setText(typeof r === 'string' ? r : r.text || '')
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  async function copy() {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* ignore */ }
  }

  return (
    <div>
      <div className="page-header">
        <h1>求职信</h1>
        <p>基于你的简历，为目标公司与岗位生成一封专业、有说服力的自荐信，一键复制即可投递。</p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="grid two-col" style={{ gridTemplateColumns: '380px 1fr', alignItems: 'start' }}>
        <div className="card card-pad">
          <div className="field">
            <label className="label">选择简历</label>
            <select className="select" value={current} onChange={(e) => loadResume(e.target.value)}>
              {resumes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label">目标公司 *</label>
            <input className="input" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="如：字节跳动" />
          </div>
          <div className="field">
            <label className="label">目标岗位</label>
            <input className="input" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="如：前端开发工程师" />
          </div>
          <div className="field">
            <label className="label">想突出的亮点（可选，逗号分隔）</label>
            <textarea className="textarea" rows={4} value={highlights} onChange={(e) => setHighlights(e.target.value)} placeholder="如：性能优化、低代码平台、跨团队协作" />
          </div>
          <button className="btn btn-primary btn-block" onClick={generate} disabled={loading}>
            {loading ? '生成中…' : <><Icon name="sparkles" size={16} />生成求职信</>}
          </button>

          {resume && (
            <div className="mt-16 muted small">
              <div className="flex-center gap-8">
                <Icon name="user" size={14} />
                <span>{resume.basics?.name || '未填写姓名'} · {resume.basics?.title || '未填写求职意向'}</span>
              </div>
            </div>
          )}
        </div>

        <div className="card card-pad">
          <div className="flex-between mb-16">
            <div className="section-title">求职信预览</div>
            {text && (
              <button className="btn btn-sm" onClick={copy}>
                <Icon name={copied ? 'check' : 'download'} size={15} />{copied ? '已复制' : '复制全文'}
              </button>
            )}
          </div>
          {!text ? (
            <div className="empty">
              <div className="empty-icon"><Icon name="pencil" size={40} /></div>
              <div>填写左侧信息后点击「生成求职信」，这里将展示可直接复制的正文。</div>
            </div>
          ) : (
            <textarea
              className="textarea cover-text"
              rows={18}
              value={text}
              onChange={(e) => setText(e.target.value)}
              style={{ lineHeight: 1.9, minHeight: 420, fontFamily: 'var(--font)' }}
            />
          )}
        </div>
      </div>
    </div>
  )
}