import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { parseAIData, FIELD_LABELS } from '../utils/aiPresentation.js'

function DataView({value,depth=0}) {
  if (value == null) return null
  if (depth>12) return <p>内容层级过多，请重新生成简洁建议。</p>
  if (typeof value==='string') return <MarkdownText text={value} />
  if (typeof value!=='object') return <span>{typeof value==='boolean' ? value?'是':'否' : String(value)}</span>
  if (Array.isArray(value)) return <ul>{value.map((item,i)=><li key={i}><DataView value={item} depth={depth+1}/></li>)}</ul>
  const entries=Object.entries(value).filter(([k,v])=>k!=='avatar' && v!==null && v!=='')
  if(entries.length===1 && ['text','content','reply'].includes(entries[0][0])) return <DataView value={entries[0][1]} depth={depth+1}/>
  return <dl className="ai-data">{entries.map(([key,item])=><div key={key}><dt>{FIELD_LABELS[key] || key}</dt><dd><DataView value={item} depth={depth+1}/></dd></div>)}</dl>
}
function MarkdownText({text}) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{
    img:()=>null,
    a:({children,href})=><a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
    code:({children,className})=>{const data=parseAIData(String(children));return data!==null ? <DataView value={data}/> : <code className={className}>{children}</code>},
    pre:({children})=><div className="ai-code-block">{children}</div>,
  }}>{text}</ReactMarkdown>
}
export default function AIResponse({content}) {
  const parsed=typeof content==='string'?parseAIData(content):content
  return <div className="ai-response">{parsed!==null && parsed!==undefined ? <DataView value={parsed}/> : <MarkdownText text={String(content||'')}/>}</div>
}
