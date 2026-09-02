import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getToken } from '../api.js'
import Icon from '../components/Icon.jsx'

// 核心功能卖点
const FEATURES = [
  { icon: 'sparkles', tone: 'linear-gradient(135deg,#6366f1,#8b5cf6)', title: 'AI 一键生成 + 对话优化', desc: '输入一句话即可生成完整简历，像聊天一样逐段打磨措辞，写出你的差异化竞争力。' },
  { icon: 'target', tone: 'linear-gradient(135deg,#0ea5e9,#6366f1)', title: '岗位 JD 匹配 + ATS 诊断', desc: '针对目标岗位自动对比硬技能与关键词，指出简历与 JD 的差距并给补全建议。' },
  { icon: 'search', tone: 'linear-gradient(135deg,#10b981,#0ea5e9)', title: '简历查重 + 原创度评分', desc: '识别模板化套话，输出原创度评分与逐条改写建议，摆脱同质化简历。' },
  { icon: 'image', tone: 'linear-gradient(135deg,#f59e0b,#ef4444)', title: '旧简历智能解析导入', desc: '上传 PDF / Word / 图片旧简历，自动提取字段智能回填，告别手动搬家。' },
  { icon: 'refresh', tone: 'linear-gradient(135deg,#ec4899,#f59e0b)', title: '中英双语一键翻译', desc: '整份简历中英互译，保持原有结构与排版，一键切换求职语言。' },
  { icon: 'send', tone: 'linear-gradient(135deg,#8b5cf6,#ec4899)', title: '加密投递链接 + 阅读追踪', desc: '生成不可猜测的私密投递链接，HR 打开即留痕，投递进展心中有数。' },
  { icon: 'inbox', tone: 'linear-gradient(135deg,#06b6d4,#3b82f6)', title: '投递记录 + 面试复盘', desc: '全流程记录投递状态、笔试面试，沉淀每一次复盘，量化求职进展。' },
  { icon: 'copy', tone: 'linear-gradient(135deg,#84cc16,#10b981)', title: '多版本简历管理', desc: '针对不同岗位维护多份差异化简历，投递时一键切换，云端同步不丢失。' },
]

// 数据背书（社会证明）
const STATS = [
  { v: '50,000+', l: '求职者信任使用' },
  { v: '1,200,000+', l: '简历被 AI 优化' },
  { v: '96%', l: '用户反馈更自信' },
  { v: '32%', l: '平均面试邀约提升' },
]

// 使用流程
const STEPS = [
  { n: '01', icon: 'file', title: '创建 / 导入简历', desc: '从零生成，或上传旧简历一键智能填写。' },
  { n: '02', icon: 'chat', title: 'AI 优化打磨', desc: '查重、翻译、JD 匹配，多管齐下提升质量。' },
  { n: '03', icon: 'send', title: '加密投递 + 追踪', desc: '生成私密链接投递，实时掌握 HR 阅读动态。' },
]

// 定价套餐
const PLANS = [
  {
    key: 'free',
    name: '免费版',
    price: '¥0',
    unit: '永久',
    desc: '注册即可用，送 2 次 AI 免费试用',
    highlight: false,
    cta: '免费注册',
    features: [
      '简历创建与基础编辑',
      '旧简历解析导入',
      '2 次 AI 免费试用',
      '1 份简历 · 基础模板',
    ],
  },
  {
    key: 'monthly',
    name: '月度会员',
    price: '¥29',
    unit: '/月',
    desc: '全功能解锁，随开随用',
    highlight: true,
    cta: '立即开通',
    features: [
      '无限 AI 优化次数',
      '无限份简历与版本',
      '岗位 JD 匹配 + ATS 诊断',
      '加密投递链接 + 阅读追踪',
      '投递记录 + 面试复盘',
      '数据分析看板',
    ],
  },
]

const FAQS = [
  { q: '注册需要付费吗？', a: '不需要。使用账号 + 密码即可注册（手机号用于接收验证码），注册后即可免费使用基础功能，并赠送 2 次 AI 免费试用。' },
  { q: '免费试用次数用完了怎么办？', a: '免费版提供 2 次 AI 免费试用，用完后 AI 高级功能需要开通会员；开通后全部功能无限使用。' },
  { q: '我的简历数据安全吗？', a: '数据按账号隔离存储，仅你本人可见；投递链接采用随机令牌加密，可随时撤销。' },
  { q: '支持哪些简历格式导入？', a: '支持 PDF、Word（.doc/.docx）、TXT 及常见图片格式，上传后自动解析并回填字段。' },
]

export default function Landing() {
  const nav = useNavigate()
  const [faqOpen, setFaqOpen] = useState(0)
  const loggedIn = !!getToken()
  const startUrl = loggedIn ? '/app' : '/login'
  const startLabel = loggedIn ? '进入工作台' : '免费开始'

  return (
    <div className="landing">
      {/* 顶部导航 */}
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-brand">
            <div className="brand-logo">简</div>
            <div>
              <div className="landing-brand-name">AI 简历工作台</div>
              <div className="landing-brand-sub">AI Resume Studio</div>
            </div>
          </div>
          <nav className="landing-links">
            <a href="#features">功能</a>
            <a href="#how">流程</a>
            <a href="#pricing">定价</a>
            <a href="#faq">常见问题</a>
          </nav>
          <div className="landing-nav-actions">
            {loggedIn ? (
              <button className="btn btn-primary" onClick={() => nav('/app')}>进入工作台</button>
            ) : (
              <>
                <Link className="btn btn-ghost" to="/login">登录</Link>
                <Link className="btn btn-primary" to="/login">免费开始</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-inner">
          <div className="landing-hero-text">
            <div className="landing-badge"><Icon name="sparkles" size={14} /> AI 驱动的智能求职工作台</div>
            <h1>让每一份简历<br />都成为 Offer 敲门砖</h1>
            <p className="landing-hero-desc">
              从零生成、AI 逐句优化、岗位适配、查重翻译，到加密投递与阅读追踪——
              一站式 AI 求职工作台，帮你把简历写进 HR 心里。
            </p>
            <div className="landing-hero-actions">
              <Link className="btn btn-primary btn-lg" to={startUrl}>
                {startLabel} <Icon name="arrowLeft" size={16} style={{ transform: 'rotate(180deg)' }} />
              </Link>
              <a className="btn btn-ghost btn-lg" href="#features">了解功能</a>
            </div>
            <div className="landing-hero-points">
              <span><Icon name="check" size={14} /> 账号 + 密码注册</span>
              <span><Icon name="check" size={14} /> 注册送 2 次 AI 免费试用</span>
              <span><Icon name="check" size={14} /> 数据云端同步</span>
            </div>
          </div>

          {/* 产品预览 mock */}
          <div className="landing-preview">
            <div className="landing-preview-bar">
              <span className="lp-dot" /><span className="lp-dot" /><span className="lp-dot" />
              <span className="lp-title">我的简历 · 前端工程师</span>
            </div>
            <div className="lp-body">
              <div className="lp-side">
                <div className="lp-side-item active"><Icon name="file" size={14} /> 基本信息</div>
                <div className="lp-side-item"><Icon name="chat" size={14} /> AI 优化</div>
                <div className="lp-side-item"><Icon name="target" size={14} /> 岗位匹配</div>
                <div className="lp-side-item"><Icon name="send" size={14} /> 投递追踪</div>
              </div>
              <div className="lp-main">
                <div className="lp-avatar" />
                <div className="lp-name">张 · 前端工程师</div>
                <div className="lp-line" /><div className="lp-line short" />
                <div className="lp-section">工作经历</div>
                {[0, 1].map((i) => (
                  <div className="lp-card" key={i}>
                    <div className="lp-line w40" />
                    <div className="lp-line dim" />
                    <div className="lp-line dim" />
                  </div>
                ))}
                <div className="lp-score">
                  <Icon name="search" size={15} /> 原创度 91 分 · 岗位匹配度 87%
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 数据背书 */}
      <section className="landing-stats">
        {STATS.map((s) => (
          <div className="landing-stat" key={s.l}>
            <div className="landing-stat-v">{s.v}</div>
            <div className="landing-stat-l">{s.l}</div>
          </div>
        ))}
      </section>

      {/* 功能卖点 */}
      <section className="landing-section" id="features">
        <div className="landing-section-head">
          <h2>一站式覆盖求职全流程</h2>
          <p>不只是「写简历」，而是从撰写、优化到投递、复盘的全链路工具。</p>
        </div>
        <div className="landing-features">
          {FEATURES.map((f) => (
            <div className="landing-feature" key={f.title}>
              <div className="landing-feature-icon" style={{ background: f.tone }}><Icon name={f.icon} size={20} /></div>
              <div className="landing-feature-title">{f.title}</div>
              <div className="landing-feature-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 使用流程 */}
      <section className="landing-section landing-how" id="how">
        <div className="landing-section-head">
          <h2>三步，轻松拿下 Offer</h2>
          <p>无需学习成本，注册后即可快速上手。</p>
        </div>
        <div className="landing-steps">
          {STEPS.map((s) => (
            <div className="landing-step" key={s.n}>
              <div className="landing-step-n">{s.n}</div>
              <div className="landing-step-icon"><Icon name={s.icon} size={22} /></div>
              <div className="landing-step-title">{s.title}</div>
              <div className="landing-step-desc">{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 定价 */}
      <section className="landing-section" id="pricing">
        <div className="landing-section-head">
          <h2>简单透明的定价</h2>
          <p>先免费体验，觉得好用再升级，随时可取消。</p>
        </div>
        <div className="landing-plans">
          {PLANS.map((p) => (
            <div className={`landing-plan${p.highlight ? ' highlight' : ''}`} key={p.key}>
              {p.highlight && <div className="landing-plan-tag">最受欢迎</div>}
              <div className="landing-plan-name">{p.name}</div>
              <div className="landing-plan-price">
                <b>{p.price}</b>
                <span>{p.unit}</span>
              </div>
              <div className="landing-plan-desc">{p.desc}</div>
              <Link
                className={`btn ${p.highlight ? 'btn-primary' : 'btn-ghost'} btn-block`}
                to={loggedIn ? '/app' : '/login'}
              >
                {p.cta}
              </Link>
              <ul className="landing-plan-features">
                {p.features.map((f) => (
                  <li key={f}><Icon name="check" size={14} /> {f}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* 常见问题 */}
      <section className="landing-section" id="faq">
        <div className="landing-section-head">
          <h2>常见问题</h2>
        </div>
        <div className="landing-faqs">
          {FAQS.map((f, i) => (
            <div className={`landing-faq${faqOpen === i ? ' open' : ''}`} key={f.q} onClick={() => setFaqOpen(faqOpen === i ? -1 : i)}>
              <div className="landing-faq-q">
                <span>{f.q}</span>
                <Icon name="plus" size={16} style={{ transform: faqOpen === i ? 'rotate(45deg)' : 'none', transition: 'transform .2s' }} />
              </div>
              {faqOpen === i && <div className="landing-faq-a">{f.a}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* 底部 CTA */}
      <section className="landing-cta">
        <h2>准备好让简历更出彩了吗？</h2>
        <p>注册即送免费体验，几分钟内生成你的第一份专业简历。</p>
        <Link className="btn btn-light btn-lg" to={startUrl}>
          {startLabel} <Icon name="arrowLeft" size={16} style={{ transform: 'rotate(180deg)' }} />
        </Link>
      </section>

      {/* 页脚 */}
      <footer className="landing-footer">
        <div className="landing-brand">
          <div className="brand-logo">简</div>
          <div className="landing-brand-name">AI 简历工作台</div>
        </div>
        <div className="landing-footer-links">
          <a href="#features">功能</a>
          <a href="#pricing">定价</a>
          <a href="#faq">常见问题</a>
          <Link to="/login">登录 / 注册</Link>
        </div>
        <div className="landing-footer-copy">© {new Date().getFullYear()} AI 简历工作台 · 让每一份简历都更出彩</div>
      </footer>
    </div>
  )
}