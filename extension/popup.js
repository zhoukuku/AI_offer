const API_URL = 'http://localhost:8787'
const $ = (id) => document.getElementById(id)

let resumes = []
let currentId = null

function setMsg(text, ok = true) {
  const m = $('msg')
  m.textContent = text
  m.className = 'msg ' + (ok ? 'ok' : 'err')
}

async function loadResumes() {
  try {
    const res = await fetch(`${API_URL}/api/resumes`)
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
    setMsg('无法连接后端，请确认工作台已启动（http://localhost:8787）', false)
  }
}

$('resume').addEventListener('change', (e) => {
  currentId = e.target.value
  chrome.storage.local.set({ resumeId: currentId })
})

$('fill').addEventListener('click', async () => {
  if (!currentId) return setMsg('请先选择简历', false)
  try {
    const res = await fetch(`${API_URL}/api/resumes/${currentId}`)
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

loadResumes()