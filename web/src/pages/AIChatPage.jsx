import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { normalizeResume } from '../../../shared/resume.js'
import Icon from '../components/Icon.jsx'

const PRESETS = [
  '帮我看看这份简历有哪些可以优化的地方？',
  '我的个人总结写得怎么样？',
  '针对大厂前端岗位，简历还缺哪些关键词？',
]

const SECTIONS = [
  { key: 'summary', label: '个人总结', get: (r) => r.summary || '' },
  { key: 'basics', label: '基本信息', get: (r) => JSON.stringify(Object.fromEntries(Object.entries(r.basics || {}).filter(([key]) => key !== 'avatar')), null, 2) },
  { key: 'experience', label: '工作经历', get: (r) => JSON.stringify(r.experience || [], null, 2) },
  { key: 'projects', label: '项目经历', get: (r) => JSON.stringify(r.projects || [], null, 2) },
  { key: 'education', label: '教育经历', get: (r) => JSON.stringify(r.education || [], null, 2) },
  { key: 'skills', label: '技能', get: (r) => JSON.stringify(r.skills || [], null, 2) },
  { key: 'honors', label: '荣誉奖项', get: (r) => JSON.stringify(r.honors || [], null, 2) },
]

export default function AIChatPage() {
  const [resumes, setResumes] = useState([])
  const [current, setCurrent] = useState('')
  const [resume, setResume] = useState(null)
  const [messages, setMessages] = useState([{ role: 'ai', content: '你好！我是你的 AI 简历顾问。选择一份简历后，可以问我任何优化问题，或在右侧框选某个区域进行定向分析与修改。' }])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  // 框选区域
  const [section, setSection] = useState('summary')
  const [sectionText, setSectionText] = useState('')
  const [instruction, setInstruction] = useState('')
  const [result, setResult] = useState('')
  const [rewriteDraft, setRewriteDraft] = useState('')
  const [analyzing, setAnalyzing] = useState(false)

  // 语音
  const [recording, setRecording] = useState(false)
  const mediaRef = useRef(null)
  const chunksRef = useRef([])

  useEffect(() => {
    api.listResumes().then((list) => {
      setResumes(list)
      if (list[0]) loadResume(list[0].id)
    }).catch(e => setError(e.message))
  }, [])

  const selection = useRef(0)
  function loadResume(id) {
    const ticket = ++selection.current
    setResume(null); setSectionText('')
    setCurrent(id); setResult(''); setRewriteDraft(''); setSection('summary'); setMessages([])
    api.getResume(id).then((r) => {
      if (ticket !== selection.current) return
      setResume(r)
      const s = SECTIONS[0]
      setSectionText(s.get(r))
    }).catch(e => setError(e.message))
  }

  function changeSection(key) {
    setSection(key)
    setResult(''); setRewriteDraft('')
    if (resume) {
      const s = SECTIONS.find((x) => x.key === key)
      setSectionText(s.get(resume))
    }
  }

  async function send(text) {
    const content = (text ?? input).trim()
    if (!content || sending) return
    setInput('')
    const next = [...messages, { role: 'user', content }]
    setMessages(next)
    setSending(true)
    try {
      const r = await api.chat({ messages: next.map(m => ({...m,role:m.role === 'user' ? 'user' : 'assistant'})), resume })
      setMessages([...next, { role: 'ai', content: r.reply }])
    } catch (e) { setError(e.message) } finally { setSending(false) }
  }

  async function analyze() {
    setAnalyzing(true); setRewriteDraft(''); setResult('分析中…'); setError('')
    try {
      const r = await api.analyze({ section, content: sectionText, targetRole: resume?.basics?.title || '' })
      setResult(formatAnalysis(r))
    } catch (e) { setError(e.message) } finally { setAnalyzing(false) }
  }

  async function rewrite() {
    setAnalyzing(true); setRewriteDraft(''); setResult('改写中…'); setError('')
    try {
      const r = await api.rewrite({ section, content: sectionText, instruction, targetRole: resume?.basics?.title || '' })
      const draft = typeof r === 'string' ? r : r.text || ''
      setResult(draft); setRewriteDraft(draft)
    } catch (e) { setError(e.message) } finally { setAnalyzing(false) }
  }

  async function applyRewrite() {
    if (!resume || !rewriteDraft) return
    try {
      let content = section === 'summary' ? rewriteDraft : JSON.parse(rewriteDraft.replace(/^```(?:json)?\s*|\s*```$/g, ''))
      if (section !== 'summary' && (section === 'basics' ? !content || typeof content !== 'object' || Array.isArray(content) : !Array.isArray(content))) throw new Error('区域格式不正确，请保留原字段结构')
      if (!window.confirm('请核实改写内容。确认后会备份原文并应用这个区域。')) return
      const before = {id:'v'+Date.now(),name:'区域改写前备份',createdAt:Date.now(),content:normalizeResume(resume)}
      const updated = await api.updateResume(current,{[section]:section === 'basics' ? {...content, avatar: resume.basics?.avatar || ''} : content,versions:[...(resume.versions || []),before]})
      setResume(updated);setSectionText(SECTIONS.find(s=>s.key===section).get(updated));setRewriteDraft('');setResult('已应用并保存')
    } catch(e) {setError('应用失败：'+e.message)}
  }

  useEffect(() => () => { mediaRef.current?.stream?.getTracks().forEach(track => track.stop()) }, [])

  // 语音输入：录音 → 转写 → 填入输入框
  async function toggleRecord() {
    if (recording) {
      mediaRef.current?.stop()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunksRef.current = []
      const mr = new MediaRecorder(stream)
      mr.ondataavailable = (e) => chunksRef.current.push(e.data)
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setRecording(false)
        setError('')
        if (blob.size > 0) {
          try {
            const r = await api.transcribe(new File([blob], 'voice.webm', { type: 'audio/webm' }))
            setInput((p) => (p ? p + '\n' : '') + r.text)
          } catch (e) { setError(e.message) }
        }
      }
      mr.start()
      mediaRef.current = mr
      setRecording(true)
    } catch (e) {
      setError('无法访问麦克风：' + e.message)
    }
  }

  const presets = PRESETS.filter(Boolean)

  return (
    <div>
      <div className="page-header">
        <h1>AI 对话分析</h1>
        <p>与 AI 顾问对话；右侧可框选简历某个区域进行定向分析与单区域改写。</p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="flex-center gap-8 mb-16">
        <span className="label" style={{ margin: 0 }}>选择简历</span>
        <select disabled={sending || analyzing} className="select" style={{ maxWidth: 280 }} value={current} onChange={(e) => loadResume(e.target.value)}>
          {resumes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      <div className="chat-wrap">
        {/* 对话区 */}
        <div className="card chat-box">
          <div className="chat-presets" style={{ padding: '10px 16px 0' }}>
            {presets.map((p) => <button key={p} onClick={() => send(p)}>{p}</button>)}
          </div>
          <div className="chat-msgs">
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role === 'user' ? 'msg-user' : 'msg-ai'}`}>{m.content}</div>
            ))}
            {sending && <div className="msg msg-ai muted">思考中…</div>}
          </div>
          <div className="chat-input">
            <button className={`rec-btn ${recording ? 'recording' : ''}`} onClick={toggleRecord} title="语音输入">
              {recording ? '■' : <Icon name="mic" size={18} />}
            </button>
            <textarea className="textarea" rows={2} value={input} placeholder="输入你的问题…（Enter 换行）" onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
            <button className="btn btn-primary" onClick={() => send()} disabled={sending || !input.trim()}><Icon name="send" size={16} />发送</button>
          </div>
        </div>

        {/* 框选区域分析/修改 */}
        <div className="card card-pad">
          <div className="section-title mb-8">框选区域定向处理</div>
          <div className="field">
            <label className="label">选择区域</label>
            <select disabled={analyzing || sending} className="select" value={section} onChange={(e) => changeSection(e.target.value)}>
              {SECTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="label">区域内容（可编辑）</label>
            <textarea className="textarea" rows={6} value={sectionText} onChange={(e) => setSectionText(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">修改指令（改写时生效，可选）</label>
            <input className="input" value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="例如：改得更简洁、突出量化结果" />
          </div>
          <div className="flex gap-8 mb-16">
            <button className="btn" onClick={analyze} disabled={analyzing}><Icon name="search" size={16} />分析该区域</button>
            <button className="btn btn-primary" onClick={rewrite} disabled={analyzing}><Icon name="pencil" size={16} />改写该区域</button>
          </div>
          {rewriteDraft && <button className="btn btn-primary mb-16" onClick={applyRewrite} disabled={analyzing || sending}>确认并应用改写</button>}
          {result && <div className="card" style={{ background: '#f8f9fb', padding: 14, whiteSpace: 'pre-wrap', fontSize: 13 }}>{result}</div>}
        </div>
      </div>
    </div>
  )
}

function formatAnalysis(r) {
  const lines = []
  if (r.score != null) lines.push(`【评分】${r.score} 分\n`)
  if (r.strengths?.length) lines.push('【优点】\n' + r.strengths.map((s) => `· ${s}`).join('\n') + '\n')
  if (r.weaknesses?.length) lines.push('【不足】\n' + r.weaknesses.map((s) => `· ${s}`).join('\n') + '\n')
  if (r.suggestions?.length) lines.push('【建议】\n' + r.suggestions.map((s) => `· ${s}`).join('\n'))
  return lines.join('\n') || JSON.stringify(r)
}