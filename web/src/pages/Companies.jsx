import { useEffect, useState } from 'react'
import { api } from '../api.js'

const TIERS = ['一线', '二线', '独角兽']

export default function Companies() {
  const [list, setList] = useState(null)
  const [industries, setIndustries] = useState([])
  const [search, setSearch] = useState('')
  const [industry, setIndustry] = useState('')
  const [tier, setTier] = useState('')
  const [campusOnly, setCampusOnly] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.industries().then(setIndustries).catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    api.companies({ search, industry, tier, campus: campusOnly ? '1' : '' })
      .then((r) => { if (!cancelled) setList(r) })
      .catch((e) => setError(e.message))
    return () => { cancelled = true }
  }, [search, industry, tier, campusOnly])

  return (
    <div>
      <div className="page-header">
        <h1>大厂信息源</h1>
        <p>收录常见互联网 / 科技大厂官方招聘入口与行业分类，支持一键直达官网投递。</p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="company-toolbar">
        <input className="input" style={{ maxWidth: 240 }} placeholder="搜索公司 / 行业…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="select" style={{ maxWidth: 180 }} value={industry} onChange={(e) => setIndustry(e.target.value)}>
          <option value="">全部行业</option>
          {industries.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
        <select className="select" style={{ maxWidth: 140 }} value={tier} onChange={(e) => setTier(e.target.value)}>
          <option value="">全部梯队</option>
          {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <label className="flex-center" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={campusOnly} onChange={(e) => setCampusOnly(e.target.checked)} />
          <span>仅看有校招</span>
        </label>
      </div>

      <div className="muted small mb-16">共 {list ? list.length : 0} 家公司</div>

      {list === null ? (
        <div className="loading">加载中…</div>
      ) : list.length === 0 ? (
        <div className="empty"><div className="empty-icon">🏢</div>没有匹配的公司</div>
      ) : (
        <div className="company-grid">
          {list.map((c, i) => (
            <a key={i} className="card company-card" href={c.domain} target="_blank" rel="noreferrer">
              <div className="cc-name">{c.name}</div>
              <div className="cc-industry">{c.industry}</div>
              <div className="flex gap-8 mt-8">
                <span className="badge badge-primary">{c.tier}</span>
                {c.campus && <span className="badge badge-green">校招/秋招</span>}
              </div>
              <div className="cc-link">官网 ↗</div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}