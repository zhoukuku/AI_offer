import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Editor from './pages/Editor.jsx'
import AIChatPage from './pages/AIChatPage.jsx'
import JobMatch from './pages/JobMatch.jsx'
import Companies from './pages/Companies.jsx'
import Applications from './pages/Applications.jsx'
import Interviews from './pages/Interviews.jsx'
import CoverLetter from './pages/CoverLetter.jsx'
import Greeting from './pages/Greeting.jsx'
import Login from './pages/Login.jsx'
import Landing from './pages/Landing.jsx'
import Upgrade from './pages/Upgrade.jsx'
import Admin from './pages/Admin.jsx'
import ShareView from './pages/ShareView.jsx'
import Examples from './pages/Examples.jsx'
import { getToken, getStoredUser } from './api.js'

// 登录守卫：未登录跳转登录页
function RequireAuth({ children }) {
  const loc = useLocation()
  if (!getToken()) return <Navigate to={`/login?redirect=${encodeURIComponent(loc.pathname)}`} replace />
  return children
}

// 管理员守卫：非管理员返回工作台
function RequireAdmin({ children }) {
  const user = getStoredUser()
  if (user?.role !== 'admin') return <Navigate to="/app" replace />
  return children
}

// 已登录访问公开页（落地页/登录页）时直接进工作台
function PublicOnly({ children }) {
  if (getToken()) return <Navigate to="/app" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicOnly><Landing /></PublicOnly>} />
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/share/:token" element={<ShareView />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route path="/app" element={<Dashboard />} />
        <Route path="/resume/:id" element={<Editor />} />
        <Route path="/ai" element={<AIChatPage />} />
        <Route path="/match" element={<JobMatch />} />
        <Route path="/companies" element={<Companies />} />
        <Route path="/applications" element={<Applications />} />
        <Route path="/interviews" element={<Interviews />} />
        <Route path="/cover" element={<CoverLetter />} />
        <Route path="/greet" element={<Greeting />} />
        <Route path="/examples" element={<Examples />} />
        <Route path="/upgrade" element={<Upgrade />} />
        <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}