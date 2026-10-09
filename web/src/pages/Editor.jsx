import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import Icon from '../components/Icon.jsx'
import { Preview } from '../components/Preview.jsx'
import { TEMPLATES, getTemplate } from '../templates.js'

const EMPTY_EXP = { company: '', role: '', start: '', end: '', city: '', bullets: '' }
const EMPTY_EDU = { school: '', degree: '', major: '', start: '', end: '' }
const EMPTY_PROJ = { name: '', role: '', tech: '', start: '', end: '', description: '' }

// 简历正文字段，用于版本快照与切换
const CONTENT_KEYS = ['basics', 'summary', 'experience', 'education', 'projects', 'skills', 'honors', 'custom']
function pickContent(r) {
  const o = {}
  CONTENT_KEYS.forEach((k) => { o[k] = r?.[k] })
  return o
}

// 归一化 AI 返回的正文（如翻译结果），确保各字段类型与编辑器一致
function normalizeContent(r) {
  const out = {}
  CONTENT_KEYS.forEach((k) => { out[k] = r?.[k] })
  if (!Array.isArray(out.experience)) out.experience = []
  out.experience = out.experience.map((e) => ({ ...e, bullets: Array.isArray(e.bullets) ? e.bullets.join('\n') : (e.bullets || '') }))
  if (!Array.isArray(out.skills)) out.skills = []
  if (!Array.isArray(out.honors)) out.honors = []
  return out
}

const THEMES = [
  { key: 'indigo', color: '#4f46e5', label: '靛蓝' },
  { key: 'violet', color: '#8b5cf6', label: '紫罗兰' },
  { key: 'blue', color: '#2563eb', label: '蔚蓝' },
  { key: 'emerald', color: '#059669', label: '翡翠' },
  { key: 'rose', color: '#e11d48', label: '玫红' },
  { key: 'amber', color: '#d97706', label: '琥珀' },
  { key: 'teal', color: '#0d9488', label: '青绿' },
  { key: 'slate', color: '#0f172a', label: '石墨' },
]

export default function Editor() {
  const { id } = useParams()
  const nav = useNavigate()
  const [resume, setResume] = useState(null)
  const [saved, setSaved] = useState(true)
  const [error, setError] = useState('')
  const [genOpen, setGenOpen] = useState(false)
  const [genForm, setGenForm] = useState({ name: '', role: '', industry: '', years: '', city: '' })
  const [genLoading, setGenLoading] = useState(false)
  const [genExpIdx, setGenExpIdx] = useState(-1)
  const [template, setTemplate] = useState('single')
  const [accent, setAccent] = useState('#4f46e5')
  const [scoreOpen, setScoreOpen] = useState(false)
  const [scoreData, setScoreData] = useState(null)
  const [scoreLoading, setScoreLoading] = useState(false)
  const [applyingId, setApplyingId] = useState('')
  const [dupOpen, setDupOpen] = useState(false)
  const [dupData, setDupData] = useState(null)
  const [dupLoading, setDupLoading] = useState(false)
  const [transLoading, setTransLoading] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [tplOpen, setTplOpen] = useState(false)
  const [shareData, setShareData] = useState(null)
  const [shareLoading, setShareLoading] = useState(false)

  // 一键优化闭环（评分 → 逐条优化应用 → 保存 → 复检）
  const [optOpen, setOptOpen] = useState(false)
  const [optStep, setOptStep] = useState(0) // 0 未开始 1 评分 2 优化应用 3 保存 4 完成
  const [optBefore, setOptBefore] = useState(null)
  const [optAfter, setOptAfter] = useState(null)
  const [optCount, setOptCount] = useState(0)
  const [optErr, setOptErr] = useState('')

  useEffect(() => {
    api.getResume(id).then((r) => {
      setResume(r)
      setTemplate(r.template || 'single')
      setAccent(r.accent || '#4f46e5')
    }).catch((e) => setError(e.message))
  }, [id])

  function patch(fn) { setResume((p) => fn(structuredClone(p))); setSaved(false) }

  async function save() {
    try {
      await api.updateResume(id, resume)
      setSaved(true)
    } catch (e) { setError(e.message) }
  }

  async function doGenerate() {
    setGenLoading(true)
    setError('')
    try {
      const r = await api.generate(genForm)
      // 合并：保留原 id / 名称 / 时间戳，替换内容
      setResume((old) => ({ ...old, ...r, updatedAt: Date.now() }))
      setSaved(false)
      setGenOpen(false)
    } catch (e) { setError(e.message) } finally { setGenLoading(false) }
  }

  async function genExperience(idx) {
    setGenExpIdx(idx)
    setError('')
    try {
      const exp = resume.experience[idx]
      const r = await api.experience({ company: exp.company, role: exp.role, industry: resume.basics?.title || '互联网', highlight: '' })
      const bullets = Array.isArray(r.bullets) ? r.bullets.join('\n') : r.bullets || exp.bullets
      patch((d) => { d.experience[idx].bullets = bullets; return d })
    } catch (e) { setError(e.message) } finally { setGenExpIdx(-1) }
  }

  async function doScore() {
    setScoreLoading(true); setError('')
    try {
      const r = await api.score({ resume })
      setScoreData(r)
      setScoreOpen(true)
    } catch (e) { setError(e.message) } finally { setScoreLoading(false) }
  }

  async function applyImprovement(item) {
    setApplyingId(item.id)
    setError('')
    try {
      const r = await api.optimize({ resume, target: item.target })
      const text = typeof r === 'string' ? r : r.text || ''
      patch((d) => {
        const t = item.target || {}
        if (t.type === 'experience' && d.experience?.[t.index]) d.experience[t.index].bullets = text
        else if (t.type === 'projects' && d.projects?.[t.index]) d.projects[t.index].description = text
        else d.summary = text
        return d
      })
      // 应用后从改进清单中移除该项
      setScoreData((s) => s ? { ...s, improvements: s.improvements.filter((x) => x.id !== item.id) } : s)
    } catch (e) { setError(e.message) } finally { setApplyingId('') }
  }

  async function saveAsVersion() {
    if (!resume) return
    const name = window.prompt('保存为新版本，请命名（如「前端岗版」）', `版本 ${(resume.versions || []).length + 1}`)
    if (!name || !name.trim()) return
    const v = { id: 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: name.trim(), createdAt: Date.now(), content: pickContent(resume) }
    const versions = [...(resume.versions || []), v]
    setError('')
    try {
      // 连同当前正文一起持久化，避免快照与工作区内容不一致
      await api.updateResume(id, { ...pickContent(resume), versions })
      setResume((p) => ({ ...p, versions }))
      setSaved(true)
    } catch (e) { setError(e.message) }
  }

  async function switchVersion(vid) {
    const v = (resume.versions || []).find((x) => x.id === vid)
    if (!v || !resume) return
    if (!saved && !window.confirm('当前有未保存的修改，切换版本将覆盖，是否继续？')) return
    setError('')
    setResume((p) => ({ ...p, ...pickContent(v.content), versions: p.versions || [] }))
    try {
      await api.updateResume(id, pickContent(v.content))
      setSaved(true)
    } catch (e) { setError(e.message) }
  }

  async function doDuplicate() {
    setDupLoading(true); setError('')
    try {
      const r = await api.duplicate({ resume })
      setDupData(r)
      setDupOpen(true)
    } catch (e) { setError(e.message) } finally { setDupLoading(false) }
  }

  async function doOneClickOptimize() {
    if (optOpen) return
    setOptOpen(true); setOptErr(''); setOptStep(1); setOptBefore(null); setOptAfter(null); setOptCount(0)
    setError('')
    try {
      // 步骤 1：评分诊断
      const s1 = await api.score({ resume })
      setOptBefore(s1.overall)
      const items = s1.improvements || []
      if (items.length === 0) { setOptStep(4); setOptAfter(s1.overall); return }

      // 步骤 2：逐条调用优化并应用到副本
      setOptStep(2)
      const next = structuredClone(resume)
      for (const it of items) {
        try {
          const r = await api.optimize({ resume: next, target: it.target })
          const text = typeof r === 'string' ? r : r.text || ''
          const t = it.target || {}
          if (t.type === 'experience' && next.experience?.[t.index]) next.experience[t.index].bullets = text
          else if (t.type === 'projects' && next.projects?.[t.index]) next.projects[t.index].description = text
          else next.summary = text
        } catch { /* 单条失败跳过，不影响其余项 */ }
      }
      setOptCount(items.length)

      // 步骤 3：保存
      setOptStep(3)
      setResume(next)
      await api.updateResume(id, pickContent(next))
      setSaved(true)

      // 步骤 4：复检评分
      setOptStep(4)
      const s2 = await api.score({ resume: next })
      setOptAfter(s2.overall)
    } catch (e) {
      setOptErr(e.message || '一键优化失败')
    }
  }

  async function doTranslate() {
    setTransLoading(true); setError('')
    try {
      const chinese = (String(resume?.summary || '') + String(resume?.basics?.title || '')).match(/[\u4e00-\u9fa5]/g)?.length || 0
      const target = chinese > 0 ? 'en' : 'zh'
      const r = await api.translate({ resume: pickContent(resume), target })
      setResume((old) => ({ ...old, ...normalizeContent(r), updatedAt: Date.now() }))
      setSaved(false)
    } catch (e) { setError(e.message) } finally { setTransLoading(false) }
  }

  async function openShare() {
    setShareLoading(true); setError('')
    try {
      const s = await api.createShare(id)
      setShareData({ ...s, url: `${window.location.origin}/share/${s.token}` })
      setShareOpen(true)
    } catch (e) { setError(e.message) } finally { setShareLoading(false) }
  }

  async function doRevoke() {
    setError('')
    try {
      await api.revokeShare(id)
      setShareData(null)
    } catch (e) { setError(e.message) }
  }

  async function copyShare() {
    if (!shareData?.url) return
    try {
      await navigator.clipboard.writeText(shareData.url)
    } catch {
      /* 剪贴板不可用时静默失败 */
    }
  }

  if (error && !resume) return <div className="error-banner">{error}</div>
  if (!resume) return <div className="loading">加载中…</div>

  const b = resume.basics || {}

  return (
    <div className="editor-page">
      <div className="page-header page-header-row">
        <div className="page-header-left">
          <button className="btn btn-sm btn-ghost" onClick={() => nav('/app')} aria-label="返回">
            <Icon name="arrowLeft" size={16} />返回
          </button>
          <div className="page-header-title">
            <div className="page-header-h1">
              <h1>{resume.name}</h1>
              {saved ? <span className="badge badge-green">已保存</span> : <span className="badge badge-orange">未保存</span>}
            </div>
            <p>左侧结构化编辑，右侧实时预览；支持切换模板与主题色，一键导出 PDF。</p>
          </div>
        </div>
        <div className="page-header-actions">
          <button className="btn" onClick={doScore} disabled={scoreLoading}><Icon name="activity" size={15} />{scoreLoading ? '体检中…' : 'AI 体检'}</button>
          <button className="btn" onClick={doDuplicate} disabled={dupLoading}><Icon name="search" size={15} />{dupLoading ? '查重中…' : '查重'}</button>
          <button className="btn" onClick={doTranslate} disabled={transLoading}><Icon name="refresh" size={15} />{transLoading ? '翻译中…' : '中英互译'}</button>
          <button className="btn" onClick={openShare} disabled={shareLoading}><Icon name="send" size={15} />{shareLoading ? '生成中…' : '分享投递'}</button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* 工具栏：分主区/版本/模板/主题/导出 五段，主操作靠右更醒目 */}
      <div className="editor-toolbar">
        <div className="toolbar-section toolbar-main">
          <button className="btn btn-primary" onClick={() => setGenOpen(true)}><Icon name="sparkles" size={16} />从零生成</button>
          <button className="btn btn-primary-soft" onClick={doOneClickOptimize} disabled={optOpen}><Icon name="wand" size={16} />一键优化</button>
          <button className="btn" onClick={save} disabled={saved}><Icon name="check" size={16} />{saved ? '已保存' : '保存'}</button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-section">
          <span className="toolbar-label">版本</span>
          <select
            className="input version-select"
            value=""
            onChange={(e) => e.target.value && switchVersion(e.target.value)}
          >
            <option value="" disabled>切换版本…</option>
            {(resume.versions || []).map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
          <button className="btn btn-sm btn-ghost" onClick={saveAsVersion} title="把当前内容保存为一个新版本"><Icon name="plus" size={14} /></button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-section">
          <button className="btn btn-sm" onClick={() => setTplOpen(true)}>
            <Icon name="layout" size={14} />模板 · {TEMPLATES.find((t) => t.key === template)?.label || '经典单栏'}
          </button>
        </div>

        <div className="toolbar-section">
          <div className="color-dots">
            {THEMES.map((t) => (
              <span
                key={t.key}
                className={`color-dot${accent === t.color ? ' active' : ''}`}
                style={{ background: t.color }}
                title={t.label}
                onClick={() => { setAccent(t.color); api.updateResume(id, { accent: t.color }).catch((err) => setError(err.message)) }}
              />
            ))}
          </div>
        </div>

        <div className="toolbar-spacer" />

        <div className="toolbar-section">
          <button className="btn btn-primary" onClick={() => window.print()}><Icon name="download" size={15} />导出 PDF</button>
        </div>
      </div>

      <div className="editor-wrap">
        {/* ===== 左侧：结构化表单 ===== */}
        <div>
          <Section title="基本信息">
            <div className="row-2">
              <Field label="姓名"><input className="input" value={b.name || ''} onChange={(e) => patch((d) => { d.basics.name = e.target.value; return d })} /></Field>
              <Field label="求职意向 / 职位"><input className="input" value={b.title || ''} onChange={(e) => patch((d) => { d.basics.title = e.target.value; return d })} /></Field>
            </div>
            <div className="row-3">
              <Field label="电话"><input className="input" value={b.phone || ''} onChange={(e) => patch((d) => { d.basics.phone = e.target.value; return d })} /></Field>
              <Field label="邮箱"><input className="input" value={b.email || ''} onChange={(e) => patch((d) => { d.basics.email = e.target.value; return d })} /></Field>
              <Field label="城市"><input className="input" value={b.city || ''} onChange={(e) => patch((d) => { d.basics.city = e.target.value; return d })} /></Field>
            </div>
            <Field label="个人网站 / 链接"><input className="input" value={b.website || ''} onChange={(e) => patch((d) => { d.basics.website = e.target.value; return d })} /></Field>
          </Section>

          <Section title="个人总结">
            <textarea className="textarea" rows={4} value={resume.summary || ''} onChange={(e) => patch((d) => { d.summary = e.target.value; return d })} placeholder="一句话概括你的经验、优势与求职方向…" />
          </Section>

          <Section title="工作经历">
            {(resume.experience || []).map((exp, i) => (
              <div className="sub-item" key={i}>
                <button className="btn btn-sm btn-ghost remove-btn" onClick={() => patch((d) => { d.experience.splice(i, 1); return d })}><Icon name="x" size={14} /></button>
                <div className="row-2">
                  <Field label="公司"><input className="input" value={exp.company || ''} onChange={(e) => patch((d) => { d.experience[i].company = e.target.value; return d })} /></Field>
                  <Field label="职位"><input className="input" value={exp.role || ''} onChange={(e) => patch((d) => { d.experience[i].role = e.target.value; return d })} /></Field>
                </div>
                <div className="row-3">
                  <Field label="开始"><input className="input" placeholder="2022-07" value={exp.start || ''} onChange={(e) => patch((d) => { d.experience[i].start = e.target.value; return d })} /></Field>
                  <Field label="结束"><input className="input" placeholder="至今" value={exp.end || ''} onChange={(e) => patch((d) => { d.experience[i].end = e.target.value; return d })} /></Field>
                  <Field label="城市"><input className="input" value={exp.city || ''} onChange={(e) => patch((d) => { d.experience[i].city = e.target.value; return d })} /></Field>
                </div>
                <Field label="工作内容（每行一条）">
                  <textarea className="textarea" rows={4} value={exp.bullets || ''} onChange={(e) => patch((d) => { d.experience[i].bullets = e.target.value; return d })} placeholder={'负责……（动作 + 结果 + 量化指标）'} />
                </Field>
                <button className="btn btn-sm btn-soft" onClick={() => genExperience(i)} disabled={genExpIdx === i}>
                  {genExpIdx === i ? '生成中…' : <><Icon name="sparkles" size={14} />AI 生成经历</>}
                </button>
              </div>
            ))}
            <button className="btn btn-block" onClick={() => patch((d) => { d.experience.push(structuredClone(EMPTY_EXP)); return d })}><Icon name="plus" size={16} />添加工作经历</button>
          </Section>

          <Section title="教育经历">
            {(resume.education || []).map((edu, i) => (
              <div className="sub-item" key={i}>
                <button className="btn btn-sm btn-ghost remove-btn" onClick={() => patch((d) => { d.education.splice(i, 1); return d })}><Icon name="x" size={14} /></button>
                <div className="row-2">
                  <Field label="学校"><input className="input" value={edu.school || ''} onChange={(e) => patch((d) => { d.education[i].school = e.target.value; return d })} /></Field>
                  <Field label="专业"><input className="input" value={edu.major || ''} onChange={(e) => patch((d) => { d.education[i].major = e.target.value; return d })} /></Field>
                </div>
                <div className="row-3">
                  <Field label="学历"><input className="input" value={edu.degree || ''} onChange={(e) => patch((d) => { d.education[i].degree = e.target.value; return d })} /></Field>
                  <Field label="开始"><input className="input" value={edu.start || ''} onChange={(e) => patch((d) => { d.education[i].start = e.target.value; return d })} /></Field>
                  <Field label="结束"><input className="input" value={edu.end || ''} onChange={(e) => patch((d) => { d.education[i].end = e.target.value; return d })} /></Field>
                </div>
              </div>
            ))}
            <button className="btn btn-block" onClick={() => patch((d) => { d.education.push(structuredClone(EMPTY_EDU)); return d })}><Icon name="plus" size={16} />添加教育经历</button>
          </Section>

          <Section title="项目经历">
            {(resume.projects || []).map((p, i) => (
              <div className="sub-item" key={i}>
                <button className="btn btn-sm btn-ghost remove-btn" onClick={() => patch((d) => { d.projects.splice(i, 1); return d })}><Icon name="x" size={14} /></button>
                <div className="row-2">
                  <Field label="项目名"><input className="input" value={p.name || ''} onChange={(e) => patch((d) => { d.projects[i].name = e.target.value; return d })} /></Field>
                  <Field label="角色"><input className="input" value={p.role || ''} onChange={(e) => patch((d) => { d.projects[i].role = e.target.value; return d })} /></Field>
                </div>
                <Field label="技术栈"><input className="input" value={p.tech || ''} onChange={(e) => patch((d) => { d.projects[i].tech = e.target.value; return d })} /></Field>
                <div className="row-2">
                  <Field label="开始"><input className="input" value={p.start || ''} onChange={(e) => patch((d) => { d.projects[i].start = e.target.value; return d })} /></Field>
                  <Field label="结束"><input className="input" value={p.end || ''} onChange={(e) => patch((d) => { d.projects[i].end = e.target.value; return d })} /></Field>
                </div>
                <Field label="项目描述">
                  <textarea className="textarea" rows={3} value={p.description || ''} onChange={(e) => patch((d) => { d.projects[i].description = e.target.value; return d })} />
                </Field>
              </div>
            ))}
            <button className="btn btn-block" onClick={() => patch((d) => { d.projects.push(structuredClone(EMPTY_PROJ)); return d })}><Icon name="plus" size={16} />添加项目经历</button>
          </Section>

          <Section title="技能">
            <textarea className="textarea" rows={3} value={(resume.skills || []).join('\n')} onChange={(e) => patch((d) => { d.skills = e.target.value.split('\n').filter(Boolean); return d })} placeholder="每行一个技能，如：JavaScript / TypeScript" />
          </Section>

          <Section title="荣誉奖项">
            <textarea className="textarea" rows={3} value={(resume.honors || []).join('\n')} onChange={(e) => patch((d) => { d.honors = e.target.value.split('\n').filter(Boolean); return d })} placeholder="每行一条荣誉" />
          </Section>
        </div>

        {/* ===== 右侧：预览 ===== */}
        <div className="print-area">
          <Preview resume={resume} template={template} accent={accent} />
        </div>
      </div>

      {genOpen && (
        <div className="modal-mask" onClick={() => setGenOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><span><Icon name="sparkles" size={16} />从零生成简历</span><span style={{ cursor: 'pointer' }} onClick={() => setGenOpen(false)}><Icon name="x" size={18} /></span></div>
            <div className="modal-body">
              <p className="muted small">填写基础信息，AI 将为你生成一份结构完整、量化表达的简历（正文内容可稍后修改）。</p>
              <div className="row-2">
                <Field label="姓名"><input className="input" value={genForm.name} onChange={(e) => setGenForm({ ...genForm, name: e.target.value })} placeholder="张三" /></Field>
                <Field label="目标岗位"><input className="input" value={genForm.role} onChange={(e) => setGenForm({ ...genForm, role: e.target.value })} placeholder="前端开发工程师" /></Field>
              </div>
              <div className="row-3">
                <Field label="行业"><input className="input" value={genForm.industry} onChange={(e) => setGenForm({ ...genForm, industry: e.target.value })} placeholder="互联网" /></Field>
                <Field label="工作年限"><input className="input" value={genForm.years} onChange={(e) => setGenForm({ ...genForm, years: e.target.value })} placeholder="3 年" /></Field>
                <Field label="城市"><input className="input" value={genForm.city} onChange={(e) => setGenForm({ ...genForm, city: e.target.value })} placeholder="北京" /></Field>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setGenOpen(false)}>取消</button>
              <button className="btn btn-primary" onClick={doGenerate} disabled={genLoading}><Icon name="sparkles" size={16} />{genLoading ? '生成中…' : '立即生成'}</button>
            </div>
          </div>
        </div>
      )}

      {scoreOpen && scoreData && (
        <div className="modal-mask" onClick={() => setScoreOpen(false)}>
          <div className="modal" style={{ maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span><Icon name="activity" size={16} />AI 简历体检报告</span>
              <span style={{ cursor: 'pointer' }} onClick={() => setScoreOpen(false)}><Icon name="x" size={18} /></span>
            </div>
            <div className="modal-body">
              <div className="score-overview">
                <div className="score-ring">
                  <svg width="96" height="96" viewBox="0 0 96 96">
                    <circle cx="48" cy="48" r="42" fill="none" stroke="var(--surface-2)" strokeWidth="9" />
                    <circle cx="48" cy="48" r="42" fill="none" stroke="var(--primary)" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${scoreData.overall * 2.64} 264`} transform="rotate(-90 48 48)" />
                  </svg>
                  <div className="score-ring-num">{scoreData.overall}</div>
                </div>
                <div>
                  <div className="score-grade">{gradeText(scoreData.overall)}</div>
                  <p className="muted small" style={{ margin: '4px 0 0' }}>{scoreData.summary}</p>
                </div>
              </div>

              <div className="mt-16"><div className="section-title mb-8">分维度评分</div>
                <div className="dim-list">
                  {scoreData.dimensions.map((d) => (
                    <div className="dim-row" key={d.key}>
                      <div className="dim-head"><span>{d.name}</span><b>{d.score}</b></div>
                      <div className="dim-track"><div className="dim-bar" style={{ width: `${d.score}%` }} /></div>
                      <div className="muted small">{d.tip}</div>
                    </div>
                  ))}
                </div>
              </div>

              {scoreData.atsKeywords?.length > 0 && (
                <div className="mt-16">
                  <div className="section-title mb-8">ATS 关键词</div>
                  <div className="flex gap-8 wrap">{scoreData.atsKeywords.map((k, i) => <span className="kw-tag" key={i}>{k}</span>)}</div>
                </div>
              )}

              {scoreData.strengths?.length > 0 && (
                <div className="mt-16">
                  <div className="section-title mb-8">简历亮点</div>
                  <ul className="check-list">{scoreData.strengths.map((s, i) => <li key={i}><Icon name="check" size={14} />{s}</li>)}</ul>
                </div>
              )}

              <div className="mt-16">
                <div className="section-title mb-8">可改进项（点击一键应用）</div>
                {(!scoreData.improvements || scoreData.improvements.length === 0) ? (
                  <div className="muted small">暂无待改进项，简历已相当完善 🎉</div>
                ) : (
                  <div className="improve-list">
                    {scoreData.improvements.map((it) => (
                      <div className="improve-item" key={it.id}>
                        <div className="flex-between">
                          <b className="small">{it.title}</b>
                          <button className="btn btn-sm btn-soft" onClick={() => applyImprovement(it)} disabled={applyingId === it.id}>
                            {applyingId === it.id ? '应用中…' : <><Icon name="sparkles" size={13} />一键应用</>}
                          </button>
                        </div>
                        {it.issue && <div className="muted small mt-8">问题：{it.issue}</div>}
                        {it.suggestion && <div className="small mt-8" style={{ color: 'var(--green)' }}>建议：{it.suggestion}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {dupOpen && dupData && (
        <div className="modal-mask" onClick={() => setDupOpen(false)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span><Icon name="search" size={16} />简历查重报告</span>
              <span style={{ cursor: 'pointer' }} onClick={() => setDupOpen(false)}><Icon name="x" size={18} /></span>
            </div>
            <div className="modal-body">
              <div className="score-overview">
                <div className="score-ring">
                  <svg width="96" height="96" viewBox="0 0 96 96">
                    <circle cx="48" cy="48" r="42" fill="none" stroke="var(--surface-2)" strokeWidth="9" />
                    <circle cx="48" cy="48" r="42" fill="none" stroke="var(--green)" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${dupData.originality * 2.64} 264`} transform="rotate(-90 48 48)" />
                  </svg>
                  <div className="score-ring-num">{dupData.originality}</div>
                </div>
                <div>
                  <div className="score-grade">原创度</div>
                  <p className="muted small" style={{ margin: '4px 0 0' }}>{dupData.summary}</p>
                </div>
              </div>

              {dupData.flags?.length > 0 && (
                <div className="mt-16">
                  <div className="section-title mb-8">待替换的模板化表达</div>
                  <div className="improve-list">
                    {dupData.flags.map((f, i) => (
                      <div className="improve-item" key={i}>
                        <div className="small" style={{ color: 'var(--orange)' }}>原文：{f.text}</div>
                        {f.suggestion && <div className="small mt-8" style={{ color: 'var(--green)' }}>建议：{f.suggestion}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tplOpen && (
        <div className="modal-mask" onClick={() => setTplOpen(false)}>
          <div className="modal" style={{ maxWidth: 860 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span><Icon name="image" size={16} />选择简历模板</span>
              <button className="icon-btn" onClick={() => setTplOpen(false)}><Icon name="x" size={16} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '72vh', overflow: 'auto' }}>
              <p className="muted small" style={{ marginTop: 0 }}>以下为你的简历在 9 套模板下的实时效果，点击即可切换（自动保存）。模板差异体现在版式结构上，主题色可在工具栏单独调整。</p>
              <div className="tpl-grid">
                {TEMPLATES.map((t) => (
                  <div
                    key={t.key}
                    className={`tpl-card${template === t.key ? ' active' : ''}`}
                    onClick={() => {
                      setTemplate(t.key)
                      api.updateResume(id, { template: t.key }).catch((err) => setError(err.message))
                      setTplOpen(false)
                    }}
                  >
                    <div className="tpl-thumb">
                      <div className="tpl-thumb-inner">
                        <Preview resume={resume} template={t.key} accent={accent} />
                      </div>
                    </div>
                    <div className="tpl-meta">
                      <b>{t.label}{template === t.key ? ' ✓' : ''}</b>
                      <span>{t.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {shareOpen && (
        <div className="modal-mask" onClick={() => setShareOpen(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span><Icon name="send" size={16} />分享投递链接</span>
              <span style={{ cursor: 'pointer' }} onClick={() => setShareOpen(false)}><Icon name="x" size={18} /></span>
            </div>
            <div className="modal-body">
              {shareData ? (
                <>
                  <p className="muted small">将下方私密链接发给 HR，对方无需登录即可查看这份简历；每次打开都会记录阅读时间。</p>
                  <div className="flex gap-8">
                    <input className="input" style={{ flex: 1 }} readOnly value={shareData.url} onFocus={(e) => e.target.select()} />
                    <button className="btn" onClick={copyShare}><Icon name="copy" size={14} />复制</button>
                  </div>
                  <div className="flex-between mt-16">
                    <span className="muted small">阅读次数：<b>{shareData.viewCount}</b></span>
                    <span className="muted small">{shareData.lastViewAt ? `最近阅读：${new Date(shareData.lastViewAt).toLocaleString()}` : '暂无阅读记录'}</span>
                  </div>
                  <div style={{ padding: '12px 0 0' }}>
                    <button className="btn btn-danger" onClick={doRevoke}>撤销链接</button>
                  </div>
                </>
              ) : (
                <div className="muted small">链接已撤销。点击右上角关闭，或再次点击「分享投递」重新生成。</div>
              )}
            </div>
          </div>
        </div>
      )}

      {optOpen && (
        <div className="modal-mask" onClick={() => setOptOpen(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span><Icon name="sparkles" size={16} />一键优化整份简历</span>
              <span style={{ cursor: 'pointer' }} onClick={() => setOptOpen(false)}><Icon name="x" size={18} /></span>
            </div>
            <div className="modal-body">
              <ol className="opt-steps">
                {['评分诊断', '逐条优化应用', '保存修改', '复检评分'].map((label, i) => {
                  const n = i + 1
                  const state = optStep > n ? 'done' : optStep === n ? 'active' : 'todo'
                  return (
                    <li key={n} className={`opt-step ${state}`}>
                      <span className="opt-dot">{state === 'done' ? <Icon name="check" size={12} /> : n}</span>
                      <span>{label}</span>
                      {n === 1 && optBefore != null && <b className="opt-score">初始 {optBefore}</b>}
                      {n === 4 && optAfter != null && <b className="opt-score">复检 {optAfter}</b>}
                    </li>
                  )
                })}
              </ol>

              {optErr && <div className="error-banner">{optErr}</div>}

              {optStep === 4 && (
                <div className="opt-result">
                  {optCount === 0 ? (
                    <p className="muted small">当前简历已无明显可优化项，保持原样 🎉 你也可以继续手动微调。</p>
                  ) : (
                    <p className="muted small">
                      已自动应用 <b>{optCount}</b> 项优化{optBefore != null && optAfter != null ? `，评分 ${optBefore} → ${optAfter}` : ''}。左侧已更新为改写后的内容，可继续手动打磨。
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setOptOpen(false)}>关闭</button>
              {optStep === 4 && <button className="btn btn-primary" onClick={() => nav('/app')}>去我的简历</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function gradeText(score) {
  if (score >= 85) return '优秀'
  if (score >= 70) return '良好'
  if (score >= 60) return '及格'
  return '待改进'
}

function Section({ title, children }) {
  return (
    <div className="card section-card">
      <div className="section-head"><span className="section-title">{title}</span></div>
      <div className="section-body">{children}</div>
    </div>
  )
}

function Field({ label, children }) {
  return <div className="field"><label className="label">{label}</label>{children}</div>
}

export { Preview } from '../components/Preview.jsx'
