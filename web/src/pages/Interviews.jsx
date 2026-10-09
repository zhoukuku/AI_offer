import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import Icon from '../components/Icon.jsx'

export default function Interviews() {
  const [params] = useSearchParams()
  const [list, setList] = useState(null)
  const [form, setForm] = useState({ company: '', position: '', questions: '', notes: '' })
  const [reviewing, setReviewing] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [error, setError] = useState('')

  // 模拟面试
  const [mockRole, setMockRole] = useState('')
  const [mockCompany, setMockCompany] = useState('')
  const [mockMsgs, setMockMsgs] = useState([])
  const [mockInput, setMockInput] = useState('')
  const [mockSending, setMockSending] = useState(false)
  const [mockDone, setMockDone] = useState(false)
  const [mockStarted, setMockStarted] = useState(false)
  const [mockRound, setMockRound] = useState(0)
  const [mockTotal, setMockTotal] = useState(0)

  // 模拟题库
  const [bankRole, setBankRole] = useState('')
  const [bankCompany, setBankCompany] = useState('')
  const [bank, setBank] = useState(null)
  const [bankLoading, setBankLoading] = useState(false)
  const [mastered, setMastered] = useState({})

  function load() { api.listInterviews().then(setList).catch((e) => setError(e.message)) }
  useEffect(() => {
    load()
    if (params.get('application')) api.listApplications().then(list => { const app = list.find(a => a.id === params.get('application')); if (app) setForm(p => ({...p, company:app.company, position:app.position, applicationId:app.id})) }).catch(e => setError(e.message))
  }, [params])

  async function add() {
    if (!form.company.trim()) { setError('请填写公司名称'); return }
    setError(''); setReviewing(true)
    try {
      const rec = await api.addInterview(form)
      clear(); load()
      const review = await api.review({ company: rec.company, position: rec.position, questions: rec.questions, notes: rec.notes })
      await api.updateInterview(rec.id, { review })
      load()
    } catch (e) { setError(e.message) } finally { setReviewing(false) }
  }

  function clear() { setForm({ company: '', position: '', questions: '', notes: '' }) }
  function toggle(id) { setExpanded(expanded === id ? null : id) }

  async function rerunReview(record) {
    setReviewing(true); setError('')
    try { const review = await api.review(record); await api.updateInterview(record.id,{review}); load() }
    catch(e) { setError(e.message) } finally { setReviewing(false) }
  }
  async function remove(record) {
    if (!window.confirm('删除这条面试记录？')) return
    try { await api.deleteInterview(record.id); load() } catch(e) { setError(e.message) }
  }

  // ===== 模拟面试 =====
  async function startMock() {
    if (!mockRole.trim()) { setError('请输入目标岗位'); return }
    setMockSending(true); setError(''); setMockDone(false); setMockMsgs([])
    try {
      const r = await api.interview({ role: mockRole, company: mockCompany, messages: [] })
      setMockMsgs([{ role: 'interviewer', content: r.reply }])
      setMockRound(r.round); setMockTotal(r.total)
      setMockStarted(true)
    } catch (e) { setError(e.message) } finally { setMockSending(false) }
  }

  async function sendMock() {
    const content = mockInput.trim()
    if (!content || mockSending || mockDone) return
    const history = [...mockMsgs, { role: 'user', content }]
    setMockMsgs(history)
    setMockInput('')
    setMockSending(true)
    try {
      const messages = history
        .filter((m) => m.role !== 'feedback')
        .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))
      const r = await api.interview({ role: mockRole, company: mockCompany, messages })
      const append = []
      if (r.feedback) append.push({ role: 'feedback', content: r.feedback, score: r.score })
      append.push({ role: 'interviewer', content: r.reply })
      if (r.done) setMockDone(true)
      setMockRound(r.round); setMockTotal(r.total)
      setMockMsgs((prev) => [...prev, ...append])
    } catch (e) { setError(e.message) } finally { setMockSending(false) }
  }

  function resetMock() {
    setMockMsgs([]); setMockDone(false); setMockStarted(false); setMockInput(''); setMockRound(0); setMockTotal(0)
  }

  // ===== 模拟题库 =====
  async function genBank() {
    setBankLoading(true); setError('')
    try {
      const r = await api.questions({ role: bankRole, company: bankCompany })
      setBank(r.categories ? r : { categories: [{ name: '通用题目', icon: 'help', items: r.questions || [] }] })
      setMastered({})
    } catch (e) { setError(e.message) } finally { setBankLoading(false) }
  }

  function toggleMastered(q) { setMastered((m) => ({ ...m, [q]: !m[q] })) }

  function fillFormFromBank() {
    if (!bank) return
    const qs = bank.categories.flatMap((c) => c.items).join('\n')
    setForm((f) => ({ ...f, questions: qs, company: f.company || bankCompany, position: f.position || bankRole }))
  }

  const masteredCount = Object.values(mastered).filter(Boolean).length

  return (
    <div>
      <div className="page-header">
        <h1>面试复盘</h1>
        <p>从「模拟题库」备战 → 「AI 面试官」实战演练 → 「面试复盘」沉淀，形成完整闭环。</p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="grid two-col">
        {/* ===== 区块 1：AI 模拟面试 ===== */}
        <div className="card mock-card">
          <div className="mock-head">
            <div className="flex-center gap-8">
              <span className="mock-avatar"><Icon name="mic" size={16} /></span>
              <div>
                <b>AI 模拟面试</b>
                <div className="muted small">AI 扮演面试官，逐题追问并即时反馈打分</div>
              </div>
            </div>
            {mockStarted && mockTotal > 0 && <span className="badge badge-primary">{Math.min(mockRound, mockTotal)} / {mockTotal} 题</span>}
          </div>

          {!mockStarted ? (
            <div className="mock-start">
              <div className="row-2">
                <div className="field" style={{ margin: 0 }}><label className="label">目标岗位 *</label><input className="input" value={mockRole} onChange={(e) => setMockRole(e.target.value)} placeholder="如：前端开发工程师" /></div>
                <div className="field" style={{ margin: 0 }}><label className="label">目标公司</label><input className="input" value={mockCompany} onChange={(e) => setMockCompany(e.target.value)} placeholder="如：字节跳动（可选）" /></div>
              </div>
              <button className="btn btn-primary mt-16" onClick={startMock} disabled={mockSending}>
                {mockSending ? '准备中…' : <><Icon name="rocket" size={16} />开始模拟面试</>}
              </button>
            </div>
          ) : (
            <>
              <div className="mock-msgs">
                {mockMsgs.map((m, i) => {
                  if (m.role === 'feedback') {
                    return (
                      <div className="mock-feedback" key={i}>
                        <div className="flex-between">
                          <span className="flex-center gap-8"><Icon name="sparkles" size={14} />AI 面试官点评</span>
                          {m.score != null && <span className="badge badge-green">{m.score} 分</span>}
                        </div>
                        <div className="small" style={{ marginTop: 6 }}>{m.content}</div>
                      </div>
                    )
                  }
                  const isUser = m.role === 'user'
                  return (
                    <div className={`mock-msg ${isUser ? 'user' : 'ai'}`} key={i}>
                      {!isUser && <span className="mock-bubble-avatar"><Icon name="mic" size={13} /></span>}
                      <div className="mock-bubble">{m.content}</div>
                    </div>
                  )
                })}
                {mockSending && <div className="mock-msg ai"><div className="mock-bubble muted">思考中…</div></div>}
                {mockDone && <div className="mock-done"><Icon name="trophy" size={16} />模拟面试已结束，可在下方记录复盘</div>}
              </div>
              <div className="mock-input">
                <textarea
                  className="textarea"
                  rows={2}
                  value={mockInput}
                  disabled={mockDone}
                  placeholder={mockDone ? '面试已结束' : '输入你的回答…（Enter 发送）'}
                  onChange={(e) => setMockInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMock() } }}
                />
                <div className="flex gap-8">
                  <button className="btn btn-primary" onClick={sendMock} disabled={mockSending || mockDone || !mockInput.trim()}><Icon name="send" size={16} />回答</button>
                  <button className="btn" onClick={resetMock}><Icon name="refresh" size={16} />重来</button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ===== 区块 2：模拟题库 ===== */}
        <div className="card card-pad">
          <div className="section-title">模拟面试题库</div>
          <div className="muted small mb-16">按类型生成高质量题目，标记掌握程度，支持换一批。</div>
          <div className="row-2">
            <div className="field" style={{ margin: 0 }}><label className="label">岗位</label><input className="input" value={bankRole} onChange={(e) => setBankRole(e.target.value)} placeholder="如：后端开发工程师" /></div>
            <div className="field" style={{ margin: 0 }}><label className="label">公司</label><input className="input" value={bankCompany} onChange={(e) => setBankCompany(e.target.value)} placeholder="如：阿里（可选）" /></div>
          </div>
          <div className="flex gap-8 mt-16">
            <button className="btn btn-primary" onClick={genBank} disabled={bankLoading}>
              <Icon name={bank ? 'refresh' : 'sparkles'} size={16} />{bankLoading ? '生成中…' : bank ? '换一批' : '生成题库'}
            </button>
            {bank && <button className="btn" onClick={fillFormFromBank}><Icon name="download" size={16} />填入复盘表单</button>}
          </div>

          {bank && (
            <div className="bank-wrap mt-16">
              <div className="flex-between mb-8">
                <span className="muted small">共 {bank.categories.reduce((n, c) => n + c.items.length, 0)} 题</span>
                <span className="badge badge-green">已掌握 {masteredCount}</span>
              </div>
              {bank.categories.map((cat) => (
                <div className="bank-category" key={cat.name}>
                  <div className="bank-cat-head">{[cat.icon || 'help'].map((ic) => <Icon key={ic} name={ic} size={14} />)}{cat.name}</div>
                  {cat.items.map((q) => (
                    <div className={`bank-item${mastered[q] ? ' mastered' : ''}`} key={q} onClick={() => toggleMastered(q)}>
                      <span className={`bank-check${mastered[q] ? ' on' : ''}`}>{mastered[q] && <Icon name="check" size={12} />}</span>
                      <span>{q}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== 区块 3：面试复盘 ===== */}
      <div className="card card-pad mb-16 mt-24">
        <div className="section-title mb-16">新增面试复盘</div>
        <div className="row-2">
          <div className="field" style={{ margin: 0 }}><label className="label">公司 *</label><input className="input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="如：腾讯" /></div>
          <div className="field" style={{ margin: 0 }}><label className="label">职位</label><input className="input" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="如：后端开发工程师" /></div>
        </div>
        <div className="row-2 mt-16">
          <div className="field" style={{ margin: 0 }}><label className="label">面试题目（每行一题）</label><textarea className="textarea" rows={4} value={form.questions} onChange={(e) => setForm({ ...form, questions: e.target.value })} placeholder="如：自我介绍、项目难点、技术八股……" /></div>
          <div className="field" style={{ margin: 0 }}><label className="label">回答 / 复盘记录</label><textarea className="textarea" rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="记录你的回答要点或薄弱环节…" /></div>
        </div>
        <div className="mt-16"><button className="btn btn-primary" onClick={add} disabled={reviewing}>{reviewing ? '复盘生成中…' : <><Icon name="check" size={16} />保存并 AI 复盘</>}</button></div>
      </div>

      <div className="grid">
        {list === null ? (
          <div className="loading">加载中…</div>
        ) : list.length === 0 ? (
          <div className="card empty"><div className="empty-icon"><Icon name="calendar" size={40} /></div>还没有面试复盘记录</div>
        ) : list.map((it) => (
          <div className="card card-pad" key={it.id}>
            <div className="flex-between">
              <div>
                <b>{it.company}</b> <span className="muted">· {it.position || '未填写职位'}</span>
                <div className="muted small">{new Date(it.createdAt).toLocaleDateString('zh-CN')}</div>
              </div>
              <div className="flex gap-8">
                {it.review?.score != null && <span className="badge badge-primary">{it.review.score} 分</span>}
              </div>
            </div>

            {it.questions && (
              <div className="q-list mt-8">
                {it.questions.split('\n').filter(Boolean).map((q, i) => (
                  <div className="q-item" key={i}><span className="q-idx">{i + 1}</span><span>{q}</span></div>
                ))}
              </div>
            )}

            <div className="flex gap-8 mt-8"><button className="btn btn-sm" onClick={() => rerunReview(it)} disabled={reviewing}>重新复盘</button><button className="btn btn-sm btn-danger" onClick={() => remove(it)}>删除记录</button></div>
            {it.review && (
              <div className="mt-8">
                <button className="btn btn-sm btn-ghost" onClick={() => toggle(it.id)}>
                  {expanded === it.id ? '收起复盘' : '展开 AI 复盘'}
                </button>
                {expanded === it.id && it.review && (
                  <div className="mt-8" style={{ background: '#f8f9fb', padding: 14, borderRadius: 8, fontSize: 13 }}>
                    {it.review.summary && <p style={{ marginTop: 0 }}>{it.review.summary}</p>}
                    {it.review.strengths?.length > 0 && <div><b>优点</b><ul style={{ margin: '4px 0 8px', paddingLeft: 18 }}>{it.review.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
                    {(it.review.weaknesses || it.review.improvements)?.length > 0 && <div><b>不足</b><ul style={{ margin: '4px 0 8px', paddingLeft: 18 }}>{(it.review.weaknesses || it.review.improvements).map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
                    {it.review.suggestions?.length > 0 && <div><b>建议</b><ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{it.review.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}