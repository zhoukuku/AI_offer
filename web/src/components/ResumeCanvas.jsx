import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Preview } from './Preview.jsx'

import { paginatePreview, PAPER_WIDTH, PAPER_HEIGHT } from './paginate.js'
export default function ResumeCanvas({ resume, template, accent, onStatus }) {
  const viewport = useRef(null)
  const measure = useRef(null)
  const layoutHost = useRef(null)
  const [sheets,setSheets] = useState([])
  const [paginationError,setPaginationError] = useState('')
  const [available, setAvailable] = useState(480)
  const [zoom, setZoom] = useState('fit')
  const [focus, setFocus] = useState(false)
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setAvailable(Math.max(160, entry.contentRect.width - 48)))
    observer.observe(viewport.current)
    return () => observer.disconnect()
  }, [])
  useLayoutEffect(() => {
    let active=true
    const render=()=>{
      if(!active) return
      layoutHost.current.replaceChildren()
      try {const next=paginatePreview(measure.current.firstElementChild,layoutHost.current);setSheets(next);setPaginationError('');onStatus?.({ready:true,pages:next.length})}
      catch(e){setSheets([]);setPaginationError(e.message);onStatus?.({ready:false,error:e.message})}
      layoutHost.current.replaceChildren()
    }
    render()
    document.fonts?.ready.then(render)
    return ()=>{active=false}
  },[resume,template,accent,onStatus])
  useEffect(() => {
    if (!focus) return
    const escape = e => { if (e.key === 'Escape') setFocus(false) }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [focus])
  const scale = zoom === 'fit' ? Math.min(1, available / PAPER_WIDTH) : zoom
  const pages = sheets.length || 1
  const adjust = step => setZoom(Math.max(.3, Math.min(1.5, Math.round((scale + step) * 100) / 100)))
  return <section className={`print-area resume-canvas${focus ? ' canvas-focus' : ''}`} aria-label="简历实时预览">
    <div className="canvas-toolbar no-print">
      <div><strong>实时预览</strong><span className="canvas-meta">A4 · {pages === 1 ? '单页内容' : `${pages} 页`}</span></div>
      <div className="canvas-controls">
        <button className="btn btn-sm btn-ghost" aria-label="缩小预览" onClick={() => adjust(-.1)} disabled={scale <= .3}>−</button>
        <span className="zoom-value">{Math.round(scale * 100)}%</span>
        <button className="btn btn-sm btn-ghost" aria-label="放大预览" onClick={() => adjust(.1)} disabled={scale >= 1.5}>＋</button>
        <button className="btn btn-sm" onClick={() => setZoom('fit')}>适应宽度</button>
        <button className="btn btn-sm" aria-expanded={focus} onClick={() => setFocus(!focus)}>{focus ? '退出专注' : '专注预览'}</button>
      </div>
    </div>
    <div className="canvas-viewport" ref={viewport} tabIndex={0} aria-label="预览滚动区域">
      {paginationError && <p className="error-banner no-print">{paginationError}</p>}
      {sheets.map((html,index)=><div className="paper-page" data-last-page={index===sheets.length-1 ? 'true' : undefined} key={index}>
        <div className="paper-page-label no-print">第 {index+1} / {pages} 页</div>
        <div className="paper-space" style={{width:PAPER_WIDTH*scale,height:PAPER_HEIGHT*scale}}>
          <div className="paper-sheet" style={{transform:`scale(${scale})`}} dangerouslySetInnerHTML={{__html:html}} />
        </div>
      </div>)}
      <div className="pagination-measure no-print" aria-hidden="true" inert="" ref={measure}><Preview resume={resume} template={template} accent={accent} /></div>
      <div className="pagination-measure no-print" aria-hidden="true" inert="" ref={layoutHost} />
    </div>
  </section>
}
