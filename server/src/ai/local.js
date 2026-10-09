import { normalizeResume } from '../../../shared/resume.js'

const lines = v => String(v || '').split('\n').map(x => x.trim().replace(/^[•·\-]\s*/, '')).filter(Boolean)
const clean = v => lines(v).map(x => x.replace(/[ \t]+/g, ' ').replace(/。+$/, '')).join('\n')
const allText = resume => JSON.stringify(normalizeResume(resume)).toLowerCase()
const SKILLS = ['React', 'Vue', 'JavaScript', 'TypeScript', 'Node.js', 'Python', 'Java', 'SQL', 'Excel', 'Figma', 'Docker', 'Kubernetes', 'Git', 'Linux', '数据分析', '用户研究', '产品设计', '项目管理', '沟通', '团队协作', '性能优化', '运营', '销售', '市场营销', '财务', '测试', '需求分析']

export function diagnose(value = {}) {
  const r = normalizeResume(value), improvements = []
  const add = (id, type, title, issue, suggestion, index) => improvements.push({ id, section: type, title, issue, suggestion, target: { type, ...(index == null ? {} : { index }) } })
  const required = [r.basics.name, r.basics.title, r.basics.phone || r.basics.email, r.summary, r.experience.length || r.projects.length, r.education.length, r.skills.length]
  const completeness = Math.round(required.filter(Boolean).length / required.length * 100)
  if (!r.summary) add('summary-empty', 'summary', '补充个人总结', '尚未填写个人总结', '写明目标岗位、已掌握的技能和真实经历。')
  else if (r.summary.length > 350) add('summary-long', 'summary', '精简个人总结', '总结超过 350 字', '保留与岗位最相关的能力和成果。')
  let quantified = 0, entries = 0
  r.experience.forEach((e, i) => {
    entries++; if (/\d/.test(e.bullets)) quantified++
    if (!e.bullets) add(`exp-${i}`, 'experience', '补充工作内容', `${e.company || '该段经历'}尚无工作描述`, '根据真实经历补充职责、行动与结果。', i)
    else if (!/\d/.test(e.bullets)) add(`exp-${i}`, 'experience', '补充可核实的结果', '这段工作描述没有数字或规模信息', '如有真实记录，可补充覆盖人数、项目数量或结果；没有数据时描述具体交付物。', i)
  })
  r.projects.forEach((p, i) => {
    entries++; if (/\d/.test(p.description)) quantified++
    if (!p.description) add(`project-${i}`, 'projects', '补充项目内容', `${p.name || '该项目'}尚无描述`, '补充背景、你的职责、交付物与实际结果。', i)
  })
  const quantification = entries ? Math.round(quantified / entries * 100) : 0
  const readability = Math.max(20, 100 - (r.summary.length > 350 ? 20 : 0) - r.experience.filter(e => lines(e.bullets).some(l => l.length > 180)).length * 15)
  const dimensions = [
    { key: 'completeness', name: '内容完整度', score: completeness, tip: '按姓名、意向、联系方式、总结、经历、教育、技能七项检查' },
    { key: 'quantification', name: '结果证据', score: quantification, tip: '检查经历与项目描述是否有数字；数字本身不代表真实性' },
    { key: 'readability', name: '表达可读性', score: readability, tip: '检查总结及经历要点长度' },
  ]
  return { overall: Math.round(completeness * .5 + quantification * .2 + readability * .3), summary: '本地规则检查结果，用于发现内容缺失和表达问题，不代表招聘通过率。', dimensions, improvements, strengths: [r.education.length && '已填写教育经历', r.skills.length && '已填写技能', quantified && '部分经历包含数字证据'].filter(Boolean), atsKeywords: r.skills }
}

export function localResult({ kind, prompt }) {
  let p = {}; try { p = JSON.parse(prompt) } catch { p = { content: prompt } }
  const r = normalizeResume(p.resume)
  switch (kind) {
    case 'generate': return { ...normalizeResume({}), basics: { ...normalizeResume({}).basics, name: p.name || '', title: p.role || '', city: p.city || '' } }
    case 'score': return diagnose(r)
    case 'match': {
      if (!p.jd?.trim() || !p.resume) throw Object.assign(new Error('请先选择简历并填写岗位 JD'), { status: 400 })
      const keywords = SKILLS.filter(k => p.jd.toLowerCase().includes(k.toLowerCase()))
      const corpus = allText(r), covered = keywords.filter(k => corpus.includes(k.toLowerCase())), missing = keywords.filter(k => !covered.includes(k))
      return { score: keywords.length ? Math.round(covered.length / keywords.length * 100) : 0, matchAnalysis: keywords.length ? `本地规则识别到 ${keywords.length} 个岗位关键词，简历已包含 ${covered.length} 个。此分数是关键词覆盖率，不代表录用概率。` : '未识别到词库中的岗位关键词，建议接入大模型进行语义匹配。', keywords: covered, missing, highLights: covered.map(k => `简历已包含 ${k}`), suggestions: missing.map(k => `核实自己是否具备「${k}」能力；只补充真实经历中的证据。`), adaptedResume: r, adaptNote: '本地模式保留原始内容，不自动添加技能或成果。接入大模型后可生成语义适配稿。' }
    }
    case 'optimize': {
      const t = p.target || {}, original = t.type === 'experience' ? r.experience[t.index]?.bullets : t.type === 'projects' ? r.projects[t.index]?.description : r.summary
      return { text: clean(original), note: '本地模式只整理格式，不虚构成果；请依据真实经历补充内容。' }
    }
    case 'rewrite': return { text: clean(p.content), note: '本地模式只整理原文格式。' }
    case 'experience': return { bullets: lines(p.highlight), note: '请先填写真实经历要点；本地模式不编造数字。' }
    case 'analyze': {
      const content = p.content || '', hasNumber = /\d/.test(content)
      return { score: Math.min(100, (content.trim() ? 50 : 0) + (hasNumber ? 25 : 0) + (content.length > 20 ? 25 : 0)), strengths: content ? ['已提供原始内容'] : [], weaknesses: hasNumber ? [] : ['缺少可核实的结果或规模信息'], suggestions: ['检查是否写清行动与结果；只使用可核实的数据。'] }
    }
    case 'coverletter': return { text: `尊敬的${p.company || '招聘'}负责人：\n\n您好！我是${r.basics.name || '候选人'}，希望应聘${p.position || r.basics.title || '贵司岗位'}。\n\n${r.summary || '我希望有机会进一步介绍自己的经历。'}${p.highlights ? '\n我希望重点介绍：' + p.highlights : ''}\n\n${r.skills.length ? '我的技能包括：' + r.skills.join('、') + '。\n\n' : ''}感谢您阅读我的简历，期待进一步沟通。\n\n${r.basics.name}` }
    case 'greet': {
      const role = p.position || r.basics.title || '目标岗位', evidence = p.highlight || r.skills.slice(0, 3).join('、'), base = `您好，我希望应聘${role}${evidence ? '，具备' + evidence : ''}，期待沟通。`
      return { variants: [{style:'concise',label:'简洁开场',hint:'本地规则生成，请核实后发送',text: base.length > 45 ? base.slice(0, 44) + '。' : base}, ...['professional','sincere','technical','career-change'].map(style => ({style,label:{professional:'专业稳重',sincere:'真诚亲和',technical:'技能介绍','career-change':'跨行业求职'}[style],hint:'基于已填写内容生成',text: `${base}${r.summary ? '\n' + r.summary : ''}`.slice(0,140)}))] }
    }
    case 'duplicate': {
      const phrases = ['工作认真负责', '良好的沟通能力', '学习能力强', '团队合作精神'], corpus = allText(r)
      const flags = phrases.filter(x => corpus.includes(x)).map(text => ({ text, suggestion: '改为一个真实场景：你做了什么、交付了什么。' }))
      return {originality: Math.max(0, 100 - flags.length * 15), summary:'本地套话检测，未与外部简历库比对；分数只反映命中词库的情况。',flags}
    }
    case 'general': {
      const last = [...(p.messages || [])].reverse().find(m => m.role === 'user')?.content || ''
      const report = diagnose(r)
      return `本地简历助手（未接入大模型）。你的问题：${last}\n\n${report.summary}\n${report.improvements.map(x => '• ' + x.title + '：' + x.suggestion).join('\n') || '未发现规则覆盖范围内的主要内容问题。'}\n\n需要针对问题的语义分析时，请配置大模型。`
    }
    case 'review': return { score: null, summary: '本地模式不能评估面试表现。已保存原始记录，接入大模型后可重新复盘。', strengths: [], weaknesses: [], suggestions: ['逐题补充实际回答、面试官追问及自己的反思。'] }
    case 'interview': {
      const messages = p.messages || [], count = messages.filter(m => m.role === 'user').length
      const questions = [`请介绍你与「${p.role || '目标岗位'}」相关的真实经历。`, '请说明一个项目中你的具体贡献与交付物。', '遇到困难时，你如何定位问题并验证解决效果？', '请谈谈跨团队协作时如何处理意见分歧。', '你有哪些希望向面试官了解的问题？']
      const last = [...messages].reverse().find(m => m.role === 'user')?.content || ''
      return {reply:count >= questions.length ? '练习结束，请回看回答并记录需要补充的事实证据。' : questions[count], feedback:count ? `本地结构检查：回答 ${last.length} 字${/\d/.test(last) ? '，包含数字' : '，尚无数字信息'}。请检查是否交代背景、行动与结果；本地规则不评判实际面试水平。` : '',score:null,round:Math.min(count+1,questions.length),total:questions.length,done:count>=questions.length}
    }
    case 'translate': throw Object.assign(new Error('翻译需要真实大模型，请配置 AI_API_KEY 后重试；原简历保持不变'), {status:503})
    default: return undefined
  }
}
