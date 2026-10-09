// 内容脚本：接收填充指令，根据简历数据智能匹配并填充当前网申表单。
;(function () {
  if (window.__resumeFillerLoaded) return
  window.__resumeFillerLoaded = true

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'FILL_FORM' && msg.resume) {
      const filled = fillForm(msg.resume)
      sendResponse({ filled })
    }
    return true
  })

  function fillForm(resume) {
    const b = resume.basics || {}
    const rule = [
      { keys: ['姓名', 'name', 'username'], value: b.name },
      { keys: ['手机', '电话', 'mobile', 'phone', 'tel'], value: b.phone },
      { keys: ['邮箱', 'email', 'mail'], value: b.email },
      { keys: ['城市', '所在地', 'city'], value: b.city },
      { keys: ['职位', '岗位', '意向', 'title', 'position', 'job'], value: b.title },
      { keys: ['学校', '毕业院校', 'school', 'university', 'college'], value: (resume.education?.[0]?.school) },
      { keys: ['专业', 'major'], value: (resume.education?.[0]?.major) },
      { keys: ['技能', 'skill'], value: (resume.skills || []).join(', ') },
      { keys: ['个人简介', '自我介绍', '个人总结', 'summary', 'profile'], value: resume.summary },
      { keys: ['工作经历', '经验', 'experience'], value: expText(resume) },
    ]

    let filled = 0
    const fields = document.querySelectorAll('input, textarea, select')
    fields.forEach((el) => {
      if (filledEl(el, b, rule)) filled++
    })
    return filled
  }

  function filledEl(el, b, rule) {
    if (el.disabled || el.readOnly || ['hidden','password','file','checkbox','radio','submit','button'].includes(el.type) || !el.getClientRects().length) return false
    const haystack = [el.name, el.id, el.placeholder, el.getAttribute('aria-label'), nearestLabelText(el)]
      .filter(Boolean).join(' ').toLowerCase()
    const matched = rule.find((r) => r.keys.some((k) => haystack.includes(k.toLowerCase())))
    if (!matched || matched.value == null || matched.value === '') return false

    if (el.value) return false
    const tag = el.tagName.toLowerCase()
    if (tag === 'select') {
      const opt = [...el.options].find((o) => o.text.toLowerCase().includes(String(matched.value).toLowerCase()))
      if (opt) { el.value = opt.value; dispatch(el); return true }
      return false
    }
    if (el.value) return false // 不覆盖已有内容
    const setter = Object.getOwnPropertyDescriptor(tag === 'textarea' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')?.set
    if (setter) setter.call(el, String(matched.value))
    else el.value = matched.value
    dispatch(el)
    return true
  }

  function nearestLabelText(el) {
    const id = el.id
    if (!id) return ''
    const label = document.querySelector(`label[for="${CSS.escape(id)}"]`)
    return label ? label.textContent : ''
  }

  function dispatch(el) {
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }

  function expText(resume) {
    const e = resume.experience?.[0]
    if (!e) return ''
    return `${e.company} · ${e.role}\n${(Array.isArray(e.bullets) ? e.bullets : String(e.bullets || '').split('\n')).slice(0, 2).join('\n')}`
  }
})()