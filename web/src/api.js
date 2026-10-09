// 前端 API 客户端：统一封装 fetch，代理到后端 /api，并自动携带登录态
const BASE = '/api'
const TOKEN_KEY = 'rw_token'
const USER_KEY = 'rw_user'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(t) {
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY)
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY)) || null
  } catch {
    return null
  }
}

export function setStoredUser(u) {
  u ? localStorage.setItem(USER_KEY, JSON.stringify(u)) : localStorage.removeItem(USER_KEY)
  window.dispatchEvent(new Event('rw-user-updated'))
}

export function logout() {
  setToken(null)
  setStoredUser(null)
}

async function request(path, opts = {}) {
  const isForm = opts.body instanceof FormData
  const headers = {}
  if (opts.body && !isForm) headers['Content-Type'] = 'application/json'
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || 'GET',
    headers,
    body: isForm ? opts.body : opts.body ? JSON.stringify(opts.body) : undefined,
  })

  // 登录态失效：清除本地凭证并广播事件（由 Layout 跳回登录页）
  if (res.status === 401) {
    logout()
    window.dispatchEvent(new Event('rw-unauthorized'))
  }

  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    const err = new Error(e.error || `请求失败 (${res.status})`)
    err.status = res.status
    err.code = e.code
    // 402 表示付费墙拦截：需要升级会员
    if (res.status === 402 || e.upgrade) { err.upgrade = true; window.dispatchEvent(new CustomEvent('rw-upgrade-required', { detail: err.message })) }
    throw err
  }
  const data = await res.json()
  if (path === '/auth/me') setStoredUser(data)
  if (path.startsWith('/ai/') || (opts.method && /^(\/resumes|\/pay)/.test(path))) {
    api.me().catch(() => {})
  }
  return data
}

export const api = {
  health: () => request('/health'),

  // 认证
  sendCode: (phone) => request('/auth/send-code', { method: 'POST', body: { phone } }),
  register: (data) => request('/auth/register', { method: 'POST', body: data }),
  login: (account, password) => request('/auth/login', { method: 'POST', body: { account, password } }),
  me: () => request('/auth/me'),
  updateMe: (data) => request('/auth/me', { method: 'PUT', body: data }),

  // 会员 / 订阅
  payPlans: () => request('/pay/plans'),
  checkout: (plan) => request('/pay/checkout', { method: 'POST', body: { plan } }),

  // 管理员
  adminStats: () => request('/admin/stats'),
  adminUsers: () => request('/admin/users'),
  adminUpdateUser: (id, patch) => request(`/admin/users/${id}`, { method: 'PUT', body: patch }),

  // 简历
  listResumes: () => request('/resumes'),
  createResume: (name, content = {}) => request('/resumes', { method: 'POST', body: { ...content, name } }),
  getResume: (id) => request(`/resumes/${id}`),
  updateResume: (id, patch) => request(`/resumes/${id}`, { method: 'PUT', body: patch }),
  deleteResume: (id) => request(`/resumes/${id}`, { method: 'DELETE' }),
  importResume: (file) => { const fd = new FormData(); fd.append('file', file); return request('/resumes/import', { method: 'POST', body: fd }) },
  createShare: (id) => request(`/resumes/${id}/share`, { method: 'POST' }),
  getShare: (id) => request(`/resumes/${id}/share`),
  revokeShare: (id) => request(`/resumes/${id}/share`, { method: 'DELETE' }),
  fetchShare: (token) => request(`/share/${token}`),

  // AI
  generate: (data) => request('/ai/generate', { method: 'POST', body: data }),
  experience: (data) => request('/ai/experience', { method: 'POST', body: data }),
  analyze: (data) => request('/ai/analyze', { method: 'POST', body: data }),
  rewrite: (data) => request('/ai/rewrite', { method: 'POST', body: data }),
  chat: (data) => request('/ai/chat', { method: 'POST', body: data }),
  match: (data) => request('/ai/match', { method: 'POST', body: data }),
  review: (data) => request('/ai/review', { method: 'POST', body: data }),
  questions: (data) => request('/ai/questions', { method: 'POST', body: data }),
  score: (data) => request('/ai/score', { method: 'POST', body: data }),
  optimize: (data) => request('/ai/optimize', { method: 'POST', body: data }),
  translate: (data) => request('/ai/translate', { method: 'POST', body: data }),
  duplicate: (data) => request('/ai/duplicate', { method: 'POST', body: data }),
  interview: (data) => request('/ai/interview', { method: 'POST', body: data }),
  coverletter: (data) => request('/ai/coverletter', { method: 'POST', body: data }),
  greet: (data) => request('/ai/greet', { method: 'POST', body: data }),
  ocr: (file) => { const fd = new FormData(); fd.append('file', file); return request('/ai/ocr', { method: 'POST', body: fd }) },
  transcribe: (file) => { const fd = new FormData(); fd.append('file', file); return request('/ai/transcribe', { method: 'POST', body: fd }) },

  // 大厂信息
  companies: (params = {}) => { const q = new URLSearchParams(params).toString(); return request(`/companies${q ? '?' + q : ''}`) },
  industries: () => request('/companies/industries'),

  // 投递记录
  listApplications: () => request('/applications'),
  addApplication: (data) => request('/applications', { method: 'POST', body: data }),
  updateApplication: (id, patch) => request(`/applications/${id}`, { method: 'PUT', body: patch }),
  deleteApplication: (id) => request(`/applications/${id}`, { method: 'DELETE' }),

  // 面试复盘
  listInterviews: () => request('/interviews'),
  addInterview: (data) => request('/interviews', { method: 'POST', body: data }),
  deleteInterview: (id) => request(`/interviews/${id}`, { method: 'DELETE' }),
  updateInterview: (id, patch) => request(`/interviews/${id}`, { method: 'PUT', body: patch }),
}