import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { api, setToken, setStoredUser } from '../api.js'
import Icon from '../components/Icon.jsx'

export default function Login() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const redirect = params.get('redirect') || '/app'

  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [mockTip, setMockTip] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function validPhone() {
    return /^1\d{10}$/.test(phone.trim())
  }

  function switchMode(m) {
    setMode(m)
    setError('')
    setMockTip('')
  }

  async function sendCode() {
    setError('')
    if (!validPhone()) return setError('请输入正确的手机号')
    setLoading(true)
    try {
      const r = await api.sendCode(phone.trim())
      // 演示模式：后端返回验证码，自动填入并提示
      if (r.mock && r.code) {
        setCode(r.code)
        setMockTip(`演示模式，验证码已自动填入：${r.code}`)
      } else {
        setMockTip('验证码已发送，请注意查收')
      }
      setCountdown(60)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!account.trim()) return setError('请输入账号')
    if (!password) return setError('请输入密码')

    if (mode === 'register') {
      if (password.length < 6) return setError('密码长度需为 6 位及以上')
      if (!validPhone()) return setError('请输入正确的手机号')
      if (!code.trim()) return setError('请输入验证码')
    }

    setLoading(true)
    try {
      const r = mode === 'register'
        ? await api.register({ account: account.trim(), password, phone: phone.trim(), code: code.trim() })
        : await api.login(account.trim(), password)
      setToken(r.token)
      setStoredUser(r.user)
      nav(redirect, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-brand">
        <div className="login-logo">简</div>
        <h1>AI 简历工作台</h1>
        <p>从零生成、AI 对话优化、岗位适配、投递跟踪与面试复盘——让你的每一份简历都更出彩。</p>
        <ul className="login-points">
          <li><Icon name="check" size={15} /> AI 一键生成 + 对话式优化</li>
          <li><Icon name="check" size={15} /> 岗位 JD 匹配与 ATS 关键词诊断</li>
          <li><Icon name="check" size={15} /> 模拟面试 + 投递跟踪 + 面试复盘</li>
          <li><Icon name="check" size={15} /> 多简历版本、云端同步</li>
        </ul>
      </div>

      <div className="login-card">
        <div className="login-tabs">
          <button
            type="button"
            className={`login-tab${mode === 'login' ? ' active' : ''}`}
            onClick={() => switchMode('login')}
          >
            登录
          </button>
          <button
            type="button"
            className={`login-tab${mode === 'register' ? ' active' : ''}`}
            onClick={() => switchMode('register')}
          >
            注册
          </button>
        </div>
        <p className="muted">
          {mode === 'login' ? '使用账号 + 密码登录' : '注册需账号密码，并验证手机号'}
        </p>

        <form onSubmit={submit}>
          <label className="field-label">账号</label>
          <div className="input-wrap">
            <input
              className="input"
              value={account}
              onChange={(e) => setAccount(e.target.value.trim())}
              placeholder="3-20 位字母 / 数字 / 下划线"
              autoFocus
            />
          </div>

          <label className="field-label" style={{ marginTop: 14 }}>密码</label>
          <div className="input-wrap">
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? '设置密码（至少 6 位）' : '请输入密码'}
            />
          </div>

          {mode === 'register' && (
            <>
              <label className="field-label" style={{ marginTop: 14 }}>手机号</label>
              <div className="input-wrap">
                <input
                  className="input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="请输入 11 位手机号"
                  inputMode="numeric"
                />
              </div>

              <label className="field-label" style={{ marginTop: 14 }}>验证码</label>
              <div className="code-row">
                <input
                  className="input"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6 位验证码"
                  inputMode="numeric"
                />
                <button
                  type="button"
                  className="btn btn-ghost code-btn"
                  onClick={sendCode}
                  disabled={countdown > 0 || loading}
                >
                  {countdown > 0 ? `${countdown}s 后重发` : '获取验证码'}
                </button>
              </div>
            </>
          )}

          {mockTip && <div className="login-mock-tip"><Icon name="sparkles" size={14} /> {mockTip}</div>}
          {error && <div className="error-banner" style={{ marginTop: 12 }}>{error}</div>}

          <button className="btn btn-primary btn-block login-submit" type="submit" disabled={loading}>
            {loading ? '请稍候…' : mode === 'login' ? '登录' : '注册'}
          </button>
        </form>

        <div className="login-demo muted small">
          演示管理员账号：admin / admin123
        </div>

        <div className="login-foot muted small">
          登录即代表同意服务条款与隐私政策
        </div>
      </div>
    </div>
  )
}