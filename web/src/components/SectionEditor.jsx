import { FIELD_LABELS,parseAIData } from '../utils/aiPresentation.js'
const FIELDS={basics:['name','title','phone','email','city','website'],experience:['company','role','start','end','city','bullets'],projects:['name','role','tech','start','end','description'],education:['school','degree','major','start','end']}
export default function SectionEditor({section,value,onChange,disabled}) {
  if (section==='summary' || ['skills','honors'].includes(section)) {
    const parsed=parseAIData(value),text=Array.isArray(parsed)?parsed.join('\n'):value
    return <textarea className="textarea" aria-label="区域内容" rows={6} disabled={disabled} value={text} onChange={e=>onChange(section==='summary'?e.target.value:JSON.stringify(e.target.value.split('\n')))}/>
  }
  const parsed=parseAIData(value)
  if(!parsed) return <p className="muted small">请先选择并加载简历。</p>
  const items=section==='basics'?[parsed]:parsed
  if(!Array.isArray(items)) return <p>该区域内容无法编辑，请重新加载简历。</p>
  const update=(index,key,text)=>{const next=structuredClone(parsed);if(section==='basics') next[key]=text;else next[index][key]=text;onChange(JSON.stringify(next))}
  return <div className="section-fields">{items.length?items.map((item,index)=><fieldset className="section-field-item" key={index} disabled={disabled}>{section!=='basics' && <legend>第 {index+1} 条</legend>}{FIELDS[section]?.map(key=><div className="field" key={key}><label className="label" htmlFor={`section-${index}-${key}`}>{FIELD_LABELS[key]}</label>{['bullets','description'].includes(key)?<textarea id={`section-${index}-${key}`} className="textarea" rows={4} value={Array.isArray(item[key])?item[key].join('\n'):item[key]||''} onChange={e=>update(index,key,e.target.value)}/>:<input id={`section-${index}-${key}`} className="input" value={item[key]||''} onChange={e=>update(index,key,e.target.value)}/>}</div>)}</fieldset>):<p className="muted small">这个区域还没有内容，请先在简历编辑器填写。</p>}</div>
}
