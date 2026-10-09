import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import Icon from '../components/Icon.jsx'
import { Preview } from './Editor.jsx'
import { EXAMPLES, EXAMPLE_INDUSTRIES } from '../examplesData.js'

export default function Examples() {
  const nav = useNavigate()
  const [industry, setIndustry] = useState('全部')
  const [cloningId, setCloningId] = useState('')
  const [err, setErr] = useState('')
  const [zoom, setZoom] = useState(null) // 预览大图的示例

  const list = industry === '全部' ? EXAMPLES : EXAMPLES.filter((e) => e.industry === industry)

  async function cloneExample(ex) {
    if (cloningId) return
    setCloningId(ex.id)
    setErr('')
    try {
      const r = await api.createResume(`${ex.title} · 范文`)
      await api.updateResume(r.id, {
        basics: ex.resume.basics,
        summary: ex.resume.summary,
        experience: ex.resume.experience,
        education: ex.resume.education,
        projects: ex.resume.projects,
        skills: ex.resume.skills,
        honors: ex.resume.honors,
        template: ex.template,
        accent: ex.accent,
      })
      nav(`/resume/${r.id}`)
    } catch (e) {
      setErr(e.upgrade ? '简历数量已达免费版上限，请先升级会员或删除一份简历后再克隆。' : (e.message || '克隆失败'))
      setCloningId('')
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 style={{ margin: 0 }}>范文库</h1>
          <p className="mt-8">参考各行业高分简历范例，一键克隆成你自己的简历后再修改。示例覆盖互联网、人工智能、产品、市场运营与财务等方向。</p>
        </div>
      </div>

      {err && <div className="error-banner">{err}</div>}

      <div className="filter-tabs">
        {EXAMPLE_INDUSTRIES.map((ind) => (
          <button
            key={ind}
            className={`filter-tab${industry === ind ? ' active' : ''}`}
            onClick={() => setIndustry(ind)}
          >{ind}</button>
        ))}
      </div>

      <div className="example-grid">
        {list.map((ex) => (
          <div className="example-card" key={ex.id}>
            <div className="example-thumb" onClick={() => setZoom(ex)} title="点击查看大图">
              <div className="example-thumb-inner">
                <Preview resume={ex.resume} template={ex.template} accent={ex.accent} />
              </div>
            </div>
            <div className="example-meta">
              <div className="example-title-row">
                <b className="example-title">{ex.title}</b>
                <span className="example-industry">{ex.industry}</span>
              </div>
              <div className="example-tags">
                {ex.tags.map((t, i) => <span className="kw-tag" key={i}>{t}</span>)}
              </div>
              <div className="example-actions">
                <button className="btn btn-primary btn-sm" disabled={cloningId === ex.id} onClick={() => cloneExample(ex)}>
                  {cloningId === ex.id ? '克隆中…' : <><Icon name="copy" size={14} />克隆到我的简历</>}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setZoom(ex)}><Icon name="external" size={14} />大图</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {zoom && (
        <div className="modal-mask" onClick={() => setZoom(null)}>
          <div className="modal" style={{ maxWidth: 840 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span><Icon name="external" size={16} />{zoom.title} · 简历范例</span>
              <span style={{ cursor: 'pointer' }} onClick={() => setZoom(null)}><Icon name="x" size={18} /></span>
            </div>
            <div className="modal-body" style={{ maxHeight: '72vh', overflow: 'auto' }}>
              <Preview resume={zoom.resume} template={zoom.template} accent={zoom.accent} />
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setZoom(null)}>关闭</button>
              <button className="btn btn-primary" disabled={cloningId === zoom.id} onClick={() => cloneExample(zoom)}>
                {cloningId === zoom.id ? '克隆中…' : '克隆这份到我的简历'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
