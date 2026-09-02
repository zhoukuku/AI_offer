// 服务后台：处理「打开工作台」「记录投递」等动作
const WORKSPACE_URL = 'http://localhost:5173'
const API_URL = 'http://localhost:8787'

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'OPEN_WORKSPACE') {
    chrome.tabs.create({ url: WORKSPACE_URL })
    sendResponse({ ok: true })
  } else if (msg.type === 'SAVE_APPLICATION') {
    saveApplication(msg.data)
      .then((r) => sendResponse({ ok: true, data: r }))
      .catch((e) => sendResponse({ ok: false, error: e.message }))
    return true // 保持异步通道
  }
})

async function saveApplication({ company, position, url }) {
  const tab = await getCurrentTab()
  const res = await fetch(`${API_URL}/api/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company: company || new URL(tab.url).hostname,
      position: position || tab.title,
      url: url || tab.url,
      status: '已投递',
    }),
  })
  if (!res.ok) throw new Error('记录投递失败')
  return res.json()
}

function getCurrentTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs[0]))
  })
}