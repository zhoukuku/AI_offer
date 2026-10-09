export default function ChangeReview({ title, before, after, onApply, onClose }) {
  return <div className="modal-mask" onClick={onClose}>
    <div className="modal" role="dialog" aria-modal="true" aria-label="确认 AI 修改" style={{maxWidth:900}} onClick={e=>e.stopPropagation()}>
      <div className="modal-head"><span>{title}</span><button className="icon-btn" aria-label="关闭" onClick={onClose}>×</button></div>
      <div className="modal-body"><p className="muted small">对照原文核实公司、职责、技能与数字；建议不会自动应用。</p>
        <div className="change-review-grid"><div><strong>原文</strong><pre>{before || '暂无内容'}</pre></div><div><strong>AI 建议</strong><pre>{after}</pre></div></div>
      </div>
      <div className="modal-foot"><button className="btn" onClick={onClose}>保留原文</button><button className="btn btn-primary" onClick={onApply}>确认并应用</button></div>
    </div>
  </div>
}
