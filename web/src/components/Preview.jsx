import React from 'react'
import { getTemplate } from '../templates.js'

// ===== 联系方式小图标（内联 SVG，打印安全） =====
const ICONS = {
  pin: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>,
  phone: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.13.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.45c.9.34 1.84.57 2.8.7a2 2 0 0 1 1.7 2.05z"/></svg>,
  mail: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>,
  link: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>,
}

function contactList(b) {
  return [
    b.city && { icon: 'pin', value: b.city },
    b.phone && { icon: 'phone', value: b.phone },
    b.email && { icon: 'mail', value: b.email },
    b.website && { icon: 'link', value: b.website },
  ].filter(Boolean)
}

// ===== 节标题 =====
function Section({ traits, title, children }) {
  return (
    <section className="pv-section">
      <div className={`pv-h pv-h--${traits.title}`}><span>{title}</span></div>
      {children}
    </section>
  )
}

// ===== 条目（工作/项目/教育共用头部） =====
function ItemHead({ left, date }) {
  return (
    <div className="pv-item-head">
      <b>{left}</b>
      {date && <span className="pv-date">{date}</span>}
    </div>
  )
}

function Bullets({ traits, bullets }) {
  if (!bullets.length) return null
  return <ul className={`pv-ul pv-ul--${traits.font}`}>{bullets.map((l, j) => <li key={j}>{l}</li>)}</ul>
}

// ===== 技能展示变体 =====
function SkillsBlock({ traits, skills }) {
  if (!skills.length) return null
  const v = traits.skills
  if (v === 'inline') return <div className="pv-skills-inline">{skills.join(' · ')}</div>
  if (v === 'list') return <ul className="pv-skills-list">{skills.map((s, i) => <li key={i}>{s}</li>)}</ul>
  if (v === 'grid') return <div className="pv-skills-grid">{skills.map((s, i) => <span key={i}>{s}</span>)}</div>
  return <div className="pv-skills">{skills.map((s, i) => <span className="pv-skill" key={i}>{s}</span>)}</div>
}

export function Preview({ resume, template = 'single', accent = '#4f46e5' }) {
  const t = getTemplate(template)
  const traits = t
  const b = resume.basics || {}
  const helper = (v) => Array.isArray(v) ? v.filter(Boolean) : v ? String(v).split('\n').map((s) => s.trim()).filter(Boolean) : []
  const contacts = contactList(b)
  const dateOf = (e) => [e.start, e.end].filter(Boolean).join(' – ')

  // ---- 内容区块 ----
  const summary = resume.summary ? (
    <Section traits={traits} title="个人总结"><p className="pv-summary">{resume.summary}</p></Section>
  ) : null

  const expItem = (e, i) => {
    const head = <ItemHead left={<>{e.company || '公司'}{e.role ? <span className="pv-role"> · {e.role}</span> : ''}</>} date={dateOf(e)} />
    const bullets = helper(e.bullets)
    if (traits.item === 'timeline') {
      return (
        <div className="pv-item pv-item--timeline" key={i}>
          <div className="pv-tl-date">{[e.start, e.end].filter(Boolean).map((d, k) => <div key={k}>{d}</div>)}</div>
          <div className="pv-tl-body">
            <div className="pv-item-head"><b>{e.company || '公司'}{e.role ? <span className="pv-role"> · {e.role}</span> : ''}</b></div>
            {e.city && <div className="pv-item-sub">{e.city}</div>}
            <Bullets traits={traits} bullets={bullets} />
          </div>
        </div>
      )
    }
    return (
      <div className="pv-item" key={i}>
        {head}
        {e.city && <div className="pv-item-sub">{e.city}</div>}
        <Bullets traits={traits} bullets={bullets} />
      </div>
    )
  }

  const experience = (resume.experience || []).length > 0 ? (
    <Section traits={traits} title="工作经历">{resume.experience.map(expItem)}</Section>
  ) : null

  const projects = (resume.projects || []).length > 0 ? (
    <Section traits={traits} title="项目经历">
      {resume.projects.map((p, i) => (
        traits.item === 'timeline' ? (
          <div className="pv-item pv-item--timeline" key={i}>
            <div className="pv-tl-date">{[p.start, p.end].filter(Boolean).map((d, k) => <div key={k}>{d}</div>)}</div>
            <div className="pv-tl-body">
              <div className="pv-item-head"><b>{p.name || '项目'}{p.role ? <span className="pv-role"> · {p.role}</span> : ''}</b></div>
              {p.tech && <div className="pv-item-sub">{p.tech}</div>}
              {p.description && <Bullets traits={traits} bullets={helper(p.description)} />}
            </div>
          </div>
        ) : (
          <div className="pv-item" key={i}>
            <ItemHead left={<>{p.name || '项目'}{p.role ? <span className="pv-role"> · {p.role}</span> : ''}</>} date={dateOf(p)} />
            {p.tech && <div className="pv-item-sub">{p.tech}</div>}
            {p.description && <Bullets traits={traits} bullets={helper(p.description)} />}
          </div>
        )
      ))}
    </Section>
  ) : null

  const skills = (resume.skills || []).length > 0 ? (
    <Section traits={traits} title="技能特长"><SkillsBlock traits={traits} skills={resume.skills} /></Section>
  ) : null

  const education = (resume.education || []).length > 0 ? (
    <Section traits={traits} title="教育经历">
      {resume.education.map((e, i) => (
        <div className="pv-item" key={i}>
          <ItemHead left={<>{e.school || '学校'}</>} date={dateOf(e)} />
          <div className="pv-item-sub">{[e.degree, e.major].filter(Boolean).join(' · ')}</div>
        </div>
      ))}
    </Section>
  ) : null

  const honors = (resume.honors || []).length > 0 ? (
    <Section traits={traits} title="荣誉奖项">
      <ul className="pv-ul">{resume.honors.map((h, i) => <li key={i}>{h}</li>)}</ul>
    </Section>
  ) : null

  const contactBlock = (mode) => (
    <div className={`pv-contact pv-contact--${mode}`}>
      {contacts.map((c, i) => (
        <span className="pv-contact-item" key={i}><i className="pv-ico">{ICONS[c.icon]}</i>{c.value}</span>
      ))}
    </div>
  )

  // ---- 页眉变体 ----
  const nameEl = <h1 className="pv-name">{b.name || '你的姓名'}</h1>
  const titleEl = b.title ? <div className="pv-title">{b.title}</div> : null
  const avatarEl = b.avatar ? <div className="pv-avatar"><img src={b.avatar} alt="" /></div> : null

  let header
  switch (traits.header) {
    case 'banner':
      header = <div className="pv-banner">{avatarEl}<div>{nameEl}{titleEl}{contacts.length > 0 && contactBlock('banner')}</div></div>
      break
    case 'plate':
      header = <div className="pv-plate"><div className="pv-plate-left">{nameEl}{titleEl}</div>{contacts.length > 0 && contactBlock('plate')}</div>
      break
    case 'center':
      header = <div className="pv-head-center">{avatarEl}{nameEl}{titleEl}{contacts.length > 0 && contactBlock('center')}</div>
      break
    case 'split':
      header = (
        <div className="pv-head-split">
          <div>{nameEl}{titleEl}</div>
          {contacts.length > 0 && contactBlock('stack')}
        </div>
      )
      break
    default: // left
      header = <div className="pv-head">{nameEl}{titleEl}{contacts.length > 0 && contactBlock('row')}</div>
  }

  // ---- 版式骨架 ----
  const mainCol = <>{summary}{experience}{projects}</>
  const asideCol = <>{skills}{education}{honors}</>

  let body
  if (traits.layout === 'sidebar') {
    body = (
      <div className="pv-cols">
        <aside className="pv-side">
          {avatarEl}
          <div className="pv-side-name">{b.name || '你的姓名'}</div>
          {b.title && <div className="pv-side-title">{b.title}</div>}
          {contacts.length > 0 && (
            <section className="pv-section">
              <div className="pv-h pv-h--side"><span>联系方式</span></div>
              <div className="pv-contact pv-contact--side">
                {contacts.map((c, i) => <span className="pv-contact-item" key={i}><i className="pv-ico">{ICONS[c.icon]}</i>{c.value}</span>)}
              </div>
            </section>
          )}
          {skills}{education}{honors}
        </aside>
        <div className="pv-side-main">{mainCol}</div>
      </div>
    )
  } else if (traits.layout === 'double') {
    body = (
      <>
        {header}
        <div className="pv-main">
          <div className="pv-main-left">{mainCol}</div>
          <div className="pv-aside">{asideCol}</div>
        </div>
      </>
    )
  } else {
    body = <>{header}{mainCol}{asideCol}</>
  }

  const rootClass = [
    'preview',
    `tpl-${t.key}`,
    `pv-font-${traits.font}`,
    traits.dense ? 'pv-dense' : '',
    traits.layout === 'sidebar' ? 'pv-layout-sidebar' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={rootClass} style={{ '--resume-accent': accent }}>
      {body}
    </div>
  )
}
