import { useEffect, useRef, useState } from 'react'
import { Preview } from './Preview.jsx'

// Fixed paper dimensions keep line wrapping stable while only the viewport zooms.
const PAPER_WIDTH = 794
const PAPER_HEIGHT = 1123
export default function ResumeCanvas({ resume, template, accent }) {
  const viewport = useRef(null)
  const paper = useRef(null)
  const [available, setAvailable] = useState(480)
  const [height, setHeight] = useState(PAPER_HEIGHT)
  const [zoom, setZoom] = useState('fit')
  const [focus, setFocus] = useState(false)
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setAvailable(Math.max(160, entry.contentRect.width - 48)))
    observer.observe(viewport.current)
    const paperObserver = new ResizeObserver(([entry]) => setHeight(entry.contentRect.height))
    paperObserver.observe(paper.current)
    return () => { observer.disconnect(); paperObserver.disconnect() }
  }, [])
  useEffect(() => {
    if (!focus) return
    const escape = e => { if (e.key === 'Escape') setFocus(false) }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [focus])
  const scale = zoom === 'fit' ? Math.min(1, available / PAPER_WIDTH) : zoom
  const pages = Math.max(1, Math.ceil(height / PAPER_HEIGHT))
  const adjust = step => setZoom(Math.max(.3, Math.min(1.5, Math.round((scale + step) * 100) / 100)))
  return <section className={`print-area resume-canvas${focus ? ' canvas-focus' : ''}`} aria-label="简历实时预览">
    <div className="canvas-toolbar no-print">
      <div><strong>实时预览</strong><span className="canvas-meta">A4 · {pages === 1 ? '单页内容' : `约 ${pages} 页`}</span></div>
      <div className="canvas-controls">
        <button className="btn btn-sm btn-ghost" aria-label="缩小预览" onClick={() => adjust(-.1)} disabled={scale <= .3}>−</button>
        <span className="zoom-value">{Math.round(scale * 100)}%</span>
        <button className="btn btn-sm btn-ghost" aria-label="放大预览" onClick={() => adjust(.1)} disabled={scale >= 1.5}>＋</button>
        <button className="btn btn-sm" onClick={() => setZoom('fit')}>适应宽度</button>
        <button className="btn btn-sm" aria-expanded={focus} onClick={() => setFocus(!focus)}>{focus ? '退出专注' : '专注预览'}</button>
      </div>
    </div>
    <div className="canvas-viewport" ref={viewport} tabIndex={0} aria-label="预览滚动区域">
      <div className="paper-space" style={{ width: PAPER_WIDTH * scale, height: height * scale }}>
        <div className="paper-sheet" ref={paper} style={{ transform: `scale(${scale})` }}>
          <Preview resume={resume} template={template} accent={accent} />
        </div>
      </div>
    </div>
    <div className="canvas-foot no-print">实时同步编辑内容 · PDF 导出时自动分页{pages > 1 ? '，建议精简内容；最终页数以导出为准' : ''}</div>
  </section>
}
