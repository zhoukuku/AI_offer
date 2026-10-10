import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import Icon from '../components/Icon.jsx'
import { Preview } from '../components/Preview.jsx'
import { normalizeResume } from '../../../shared/resume.js'

export default function JobMatch() {
  const nav = useNavigate()
  const [resumes, setResumes] = useState([])
  const [current, setCurrent] = useState('')
  const [resume, setResume] = useState(null)
  const [company, setCompany] = useState('')
  const [position, setPosition] = useState('')
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [jd, setJd] = useState('')
  const [matching, setMatching] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [saveMsg, setSaveMsg] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [importing, setImporting] = useState(false)
  const [greetLoading, setGreetLoading] = useState(false)
  const [greetVariants, setGreetVariants] = useState([])
  const [greetCopied, setGreetCopied] = useState('')
  const [coverLoading, setCoverLoading] = useState(false)
  const [coverText, setCoverText] = useState('')
  const fileRef = useRef(null)
  const resumeFileRef = useRef(null)

  useEffect(() => {
    api.listResumes().then((list) => { setResumes(list); if (list[0]) load(list[0].id) }).catch(e => setError(e.message))
  }, [])

  const selection = useRef(0)
  function load(id) {
    const ticket = ++selection.current
    setCurrent(id)
    setResult(null); setResume(null); setSaveMsg(''); setShowPreview(false)
    api.getResume(id).then(r => { if (ticket !== selection.current) return; setResume(r); setPosition(r.basics?.title || '') }).catch(e => setError(e.message))
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setOcrLoading(true); setError('')
    try {
      const r = await api.ocr(file)
      setJd(r.text); setResult(null); setSaveMsg('')
    } catch (err) { setError(err.message) } finally { setOcrLoading(false);if(fileRef.current)fileRef.current.value='' }
  }

  // 本页导入旧简历：解析后自动刷新列表并选中，无需跳转到其他页面
  async function importResume(file) {
    if (!file) return
    setImporting(true); setSaveMsg(''); setError('')
    try {
      const r = await api.importResume(file)
      const list = await api.listResumes()
      setResumes(list)
      load(r.id)
      setSaveMsg(`已导入并选中：${r.name || '简历'}`)
    } catch (err) { setError(err.message) } finally {
      setImporting(false)
      if (resumeFileRef.current) resumeFileRef.current.value = ''
    }
  }

  async function doMatch() {
    if (ocrLoading) { setError('请等待岗位截图识别完成'); return }
    if (!resume) { setError('请先选择或导入简历'); return }
    if (!jd.trim()) { setError('请先粘贴 JD 或上传岗位截图'); return }
    setMatching(true); setError(''); setResult(null); setSaveMsg(''); setShowPreview(false)
    try {
      const r = await api.match({ jd, resume, basics: resume?.basics })
      setResult(r)
    } catch (err) { setError(err.message) } finally { setMatching(false) }
  }

  async function saveAsNew() {
    setSaving(true); setError('')
    try {
      const created = await api.createResume(`适配 ${position || '岗位'} 版本`, { ...normalizeResume(result.adaptedResume), basics: {...normalizeResume(result.adaptedResume).basics, avatar: resume.basics?.avatar || ''}, template: resume?.template || 'single', accent: resume?.accent || '#4f46e5' })
      nav(`/resume/${created.id}`)
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  async function overwrite() {
    if (!window.confirm('将保留原简历快照并应用适配稿，请先核实内容。是否继续？')) return
    setSaving(true); setError('')
    try {
      const before = {id:'v' + Date.now(),name:'岗位适配前备份',createdAt:Date.now(),content:normalizeResume(resume)}
      const after = await api.updateResume(current, { ...normalizeResume(result.adaptedResume), basics: {...normalizeResume(result.adaptedResume).basics, avatar: resume.basics?.avatar || ''}, versions:[...(resume.versions || []),before] })
      setResume(after); setSaveMsg('已应用并保存适配稿')
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  async function recordApplication() {
    if (!company.trim() || !position.trim()) { setError('请填写目标公司和岗位后记录投递'); return }
    setSaving(true); setError('')
    try {
      await api.addApplication({company,position,url,resumeId:current,jd,source:'其他',status:'已投递'})
      nav('/applications')
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  const matched = result?.keywords || []
  const missing = result?.missing || []
  const kwTotal = matched.length + missing.length
  const coverage = kwTotal ? Math.round((matched.length / kwTotal) * 100) : 0

  return (
    <div>
      <div className="page-header">
        <h1>岗位适配</h1>
        <p>跨行求职？把目标岗位 JD 粘贴进来，AI 会把你的经历改写映射成可迁移能力，生成一份对标 JD 的简历。</p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
        <div className="card card-pad">
          <div className="field">
            <label className="label">选择简历</label>
            <div className="flex gap-8">
              <select disabled={matching || saving || importing} className="select" value={current} onChange={(e) => load(e.target.value)} style={{ flex: 1 }}>
                {resumes.length ? resumes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)
                  : <option value="">（暂无简历，请先导入）</option>}
              </select>
              <button className="btn" onClick={() => resumeFileRef.current?.click()} disabled={importing}>
                {importing ? '导入中…' : <><Icon name="upload" size={16} />导入旧简历</>}
              </button>
              <input ref={resumeFileRef} type="file" accept=".txt,.md,.pdf,.docx" style={{ display: 'none' }} onChange={(e) => importResume(e.target.files?.[0])} />
            </div>
            {importing && <div className="muted small" style={{ marginTop: 6 }}>正在解析旧简历并自动填写…</div>}
          </div>
          <div className="grid two-col">
            <div className="field"><label className="label">目标公司</label><input className="input" value={company} onChange={e => setCompany(e.target.value)} placeholder="记录投递时填写" /></div>
            <div className="field"><label className="label">目标岗位</label><input className="input" value={position} onChange={e => setPosition(e.target.value)} /></div>
          </div>
          <div className="field"><label className="label">岗位链接（可选）</label><input className="input" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" /></div>
          <div className="field">
            <label className="label">岗位 JD</label>
            <textarea className="textarea" rows={10} value={jd} disabled={matching || saving} onChange={(e) => { setJd(e.target.value); setResult(null); setSaveMsg('') }} placeholder="粘贴招聘岗位描述（职责 / 要求）…" />
          </div>
          <div className="flex gap-8 mb-16 wrap">
            <button className="btn" onClick={() => fileRef.current?.click()} disabled={ocrLoading || matching || saving || importing}>
              {ocrLoading ? '识别中…' : <><Icon name="image" size={16} />上传岗位截图识别</>}
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
            <button className="btn btn-primary" onClick={doMatch} disabled={matching || saving || importing || ocrLoading || !resume}>
              {matching ? '适配中…' : <><Icon name="target" size={16} />开始适配</>}
            </button>
          </div>
          {saveMsg && <div className="badge badge-green">{saveMsg}</div>}
        </div>

        <div className="card card-pad">
          {!result ? (
            <div className="empty">
              <div className="empty-icon">🎯</div>
              <div>输入 JD 后点击「开始适配」，这里将展示匹配结果与优化建议。</div>
            </div>
          ) : (
            <div>
              <div className="match-score">
                <div className="score-num">{result.score ?? '--'}</div>
                <div className="muted small">岗位匹配度</div>
                <div className="score-bar"><div className="score-bar-fill" style={{ width: `${result.score ?? 0}%` }} /></div>
              </div>

              <p style={{ fontSize: 13.5 }}>{result.matchAnalysis}</p>

              <div className="mt-16">
                <div className="section-title mb-8">我的优势</div>
                <div className="flex gap-8 wrap">
                  {(result.highLights || []).map((h, i) => <span className="kw-tag" key={i}>{h}</span>)}
                </div>
              </div>

              <div className="mt-16">
                <div className="section-title mb-8">关键词覆盖率</div>
                <div className="coverage">
                  <div className="cov-ring">
                    <svg width="64" height="64" viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r="28" fill="none" stroke="var(--surface-2)" strokeWidth="7" />
                      <circle cx="32" cy="32" r="28" fill="none" stroke="var(--primary)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${coverage * 1.76} 176`} />
                    </svg>
                    <div className="cov-num">{coverage}%</div>
                  </div>
                  <div className="cov-desc">已覆盖 {matched.length} / {kwTotal} 个目标岗位关键词，覆盖越充分，初筛通过率越高。</div>
                </div>
                <div className="kw-grid mt-16">
                  <div className="kw-block">
                    <div className="kw-title"><Icon name="check" size={14} />已覆盖关键词</div>
                    <div className="flex gap-8 wrap">
                      {matched.length ? matched.map((k, i) => <span className="kw-tag" key={i}>{k}</span>) : <span className="muted small">暂无</span>}
                    </div>
                  </div>
                  <div className="kw-block">
                    <div className="kw-title"><Icon name="search" size={14} />建议补充关键词</div>
                    <div className="flex gap-8 wrap">
                      {missing.length ? missing.map((k, i) => <span className="kw-tag missing" key={i}>{k}</span>) : <span className="muted small">无缺失</span>}
                    </div>
                  </div>
                </div>
              </div>

              {(result.suggestions || []).length > 0 && (
                <div className="mt-16">
                  <div className="section-title mb-8">优化建议</div>
                  <ul style={{ paddingLeft: 18, margin: 0, fontSize: 13.5 }}>{result.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
              )}

              {result.adaptedResume && (
                <div className="mt-16">
                  <div className="section-title mb-8">已生成对标 JD 的简历</div>
                  {result.adaptNote && (
                    <div className="adapt-note"><Icon name="sparkles" size={14} />{result.adaptNote}</div>
                  )}
                  <div className="flex gap-8 wrap">
                    <button className="btn btn-primary" onClick={saveAsNew} disabled={saving}>保存为新简历</button>
                    <button className="btn" onClick={overwrite} disabled={saving}>应用并备份原文</button>
                    <button className="btn" onClick={recordApplication} disabled={saving}>已投递，记录进度</button>
                    <button className="btn btn-ghost" onClick={() => setShowPreview((v) => !v)}>
                      <Icon name="file" size={15} />{showPreview ? '收起预览' : '预览适配版简历'}
                    </button>
                  </div>
                  {showPreview && (
                    <div className="match-preview">
                      <Preview resume={result.adaptedResume} template={resume?.template || 'single'} accent={resume?.accent || '#4f46e5'} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}