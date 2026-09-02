const $ = (id) => document.getElementById(id)

let resumes = []
let currentId = null
let settings = { apiUrl: 'http://localhost:8787', workspaceUrl: 'http://localhost:5173' }

function setMsg(text, ok = true) {
  const m = $('msg')
  m.textContent = text
  m.className = 'msg ' + (ok ? 'ok' : 'err')
}

// 当前使用的后端地址（来自配置，缺省回退本地开发地址）
function apiUrl() {
  return settings.apiUrl || 'http://localhost:8787'
}

async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      { apiUrl: 'http://localhost:8787', workspaceUrl: 'http://localhost:5173' },
      (s) => {
        settings = s
        if ($('apiUrl')) $('apiUrl').value = s.apiUrl
        if ($('workspaceUrl')) $('workspaceUrl').value = s.workspaceUrl
        resolve(s)
      }
    )
  })
}

async function loadResumes() {
  try {
    const res = await fetch(`${apiUrl()}/api/resumes`)
    resumes = await res.json()
    const sel = $('resume')
    sel.innerHTML = ''
    resumes.forEach((r) => {
      const opt = document.createElement('option')
      opt.value = r.id
      opt.textContent = r.name
      sel.appendChild(opt)
    })
    chrome.storage.local.get('resumeId', ({ resumeId }) => {
      if (resumeId && resumes.some((r) => r.id === resumeId)) {
        currentId = resumeId
        sel.value = resumeId
      } else if (resumes[0]) {
        currentId = resumes[0].id
      }
    })
  } catch (e) {
    setMsg('无法连接后端（' + apiUrl() + '），请确认工作台已启动并在上方配置正确地址', false)
  }
}

$('resume').addEventListener('change', (e) => {
  currentId = e.target.value
  chrome.storage.local.set({ resumeId: currentId })
})

$('fill').addEventListener('click', async () => {
  if (!currentId) return setMsg('请先选择简历', false)
  try {
    const res = await fetch(`${apiUrl()}/api/resumes/${currentId}`)
    const resume = await res.json()
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'FILL_FORM', resume }, (resp) => {
        if (chrome.runtime.lastError) setMsg('当前页面不支持填充（非网申页或需刷新后重试）', false)
        else setMsg(resp?.filled > 0 ? `已填充 ${resp.filled} 个字段` : '未识别到可填充字段', resp?.filled > 0)
      })
    })
  } catch (e) { setMsg('获取简历失败：' + e.message, false) }
})

$('record').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'SAVE_APPLICATION', data: {} }, (resp) => {
    if (resp?.ok) setMsg('已记录本次投递 ✓')
    else setMsg('记录失败：' + (resp?.error || '未知错误'), false)
  })
})

$('open').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'OPEN_WORKSPACE' })
})

// 保存后端 / 工作台地址配置
if ($('saveSettings')) {
  $('saveSettings').addEventListener('click', () => {
    settings.apiUrl = ($('apiUrl').value || '').trim() || 'http://localhost:8787'
    settings.workspaceUrl = ($('workspaceUrl').value || '').trim() || 'http://localhost:5173'
    chrome.storage.local.set(settings, () => {
      setMsg('设置已保存 ✓')
      loadResumes()
    })
  })
}

;(async () => {
  await loadSettings()
  loadResumes()
})()
