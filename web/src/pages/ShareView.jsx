import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api.js'
import { Preview } from '../components/Preview.jsx'

// 公开分享页：HR 无需登录即可查看简历（每次打开后台上报一次阅读）
export default function ShareView() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.fetchShare(token).then(setData).catch((e) => setError(e.message))
  }, [token])

  if (error) {
    return (
      <div className="share-page">
        <div className="share-error">{error}</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="share-page">
        <div className="loading">加载中…</div>
      </div>
    )
  }

  return (
    <div className="share-page">
      <div className="share-topbar">
        <div className="brand-logo">简</div>
        <div>
          <div className="share-title">{data.resume.name}</div>
          <div className="share-sub">简历工作台 · 在线简历</div>
        </div>
      </div>
      <div className="share-body">
        <Preview resume={data.resume} template={data.resume.template || 'single'} accent={data.resume.accent || '#4f46e5'} />
      </div>
      <div className="share-foot">由 简历工作台 · AI Resume Studio 生成</div>
    </div>
  )
}