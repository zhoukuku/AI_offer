import { normalizeResume } from '../../../shared/resume.js'
export const SCHEMAS = {
  generate: 'basics{name,title,phone,email,city,website,avatar}, summary:string, experience:[{company,role,start,end,city,bullets:string}], education:[{school,degree,major,start,end}], projects:[{name,role,tech,start,end,description}], skills:string[], honors:string[], custom:[{title,content}]',
  'parse-resume': 'basics{name,title,phone,email,city,website,avatar}, summary:string, experience:[{company,role,start,end,city,bullets:string}], education:[{school,degree,major,start,end}], projects:[{name,role,tech,start,end,description}], skills:string[], honors:string[], custom:[{title,content}]',
  translate: '保持输入简历正文结构与类型，bullets 必须是换行分隔字符串',
  score: 'overall:number(0-100), summary:string, dimensions:[{key,name,score:number,tip}], strengths:string[], atsKeywords:string[], improvements:[{id,section,title,issue,suggestion,target:{type:summary|experience|projects,index?:number}}]',
  match: 'score:number(0-100), matchAnalysis:string, keywords:string[], missing:string[], highLights:string[], suggestions:string[], adaptedResume:完整简历正文, adaptNote:string',
  experience:'bullets:string[]', analyze:'score:number, strengths:string[], weaknesses:string[], suggestions:string[]',
  optimize:'text:string',rewrite:'text:string',coverletter:'text:string',
  duplicate:'originality:number, summary:string, flags:[{text,suggestion}]',
  questions:'categories:[{name,icon,items:string[]}]',
  interview:'reply:string, feedback:string, score:number|null, round:number, total:number, done:boolean',
  review:'score:number, summary:string, strengths:string[], weaknesses:string[], suggestions:string[]',
  greet:'variants:[{style:concise|professional|sincere|technical|career-change,label,hint,text}]',
}
export function validateResult(kind, result) {
  const fail = () => { throw Object.assign(new Error('模型返回格式不完整，请重试；未修改原简历'), {status:502}) }
  if (!result || typeof result !== 'object' || Array.isArray(result) || result.raw) fail()
  const required = {generate:['basics','experience','education','projects','skills'], 'parse-resume':['basics','experience','education','projects','skills'],translate:['basics','experience','education','projects','skills'],score:['overall','summary','dimensions','strengths','atsKeywords','improvements'],match:['score','matchAnalysis','keywords','missing','highLights','suggestions','adaptedResume','adaptNote'],experience:['bullets'],analyze:['score','strengths','weaknesses','suggestions'],optimize:['text'],rewrite:['text'],coverletter:['text'],duplicate:['originality','summary','flags'],questions:['categories'],interview:['reply','round','total','done'],review:['score','summary','strengths','weaknesses','suggestions'],greet:['variants']}[kind] || []
  for (const key of required) if (result[key] == null) fail()
  for (const key of ['experience','education','projects','skills','dimensions','strengths','atsKeywords','improvements','keywords','missing','highLights','suggestions','bullets','weaknesses','flags','categories','variants']) if (required.includes(key) && !Array.isArray(result[key])) fail()
  for (const key of ['skills','strengths','atsKeywords','keywords','missing','highLights','suggestions','bullets','weaknesses']) if (required.includes(key) && result[key].some(v => typeof v !== 'string')) fail()
  if (required.includes('basics') && (!result.basics || typeof result.basics !== 'object' || Array.isArray(result.basics))) fail()
  for (const key of ['experience','education','projects']) if (required.includes(key) && result[key].some(v => !v || typeof v !== 'object' || Array.isArray(v))) fail()
  for (const key of ['score','overall','originality','round','total']) if (required.includes(key) && (typeof result[key] !== 'number' || !Number.isFinite(result[key]))) fail()
  for (const key of ['score','overall','originality']) if (required.includes(key) && (result[key] < 0 || result[key] > 100)) fail()
  for (const key of ['text','summary','matchAnalysis','adaptNote','reply']) if (required.includes(key) && typeof result[key] !== 'string') fail()
  if (['generate','parse-resume','translate'].includes(kind)) return normalizeResume(result)
  if (kind === 'match') {
    if (!result.adaptedResume?.basics) fail()
    result.adaptedResume = normalizeResume(result.adaptedResume)
  }
  if (kind === 'score') {
    if (result.dimensions.some(d => !d || typeof d.score !== 'number' || typeof d.name !== 'string') || result.improvements.some(i => !i?.id || !['summary','experience','projects'].includes(i.target?.type) || (i.target.type !== 'summary' && (!Number.isInteger(i.target.index) || i.target.index < 0)))) fail()
  }
  if (kind === 'questions' && result.categories.some(c => !c?.name || !Array.isArray(c.items) || c.items.some(i => typeof i !== 'string'))) fail()
  if (kind === 'greet') {
    if (!result.variants.length) fail()
    if (result.variants.some(v => typeof v?.text !== 'string' || typeof v?.style !== 'string')) fail()
    result.variants = result.variants.map(v => ({...v, text:v.text.slice(0,v.style === 'concise' ? 45 : 140)}))
  }
  return result
}
