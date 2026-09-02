// 服务后台：处理「打开工作台」「记录投递」等动作
// 后端 / 工作台地址可配置：在 popup 中设置后存入 chrome.storage.local，默认本地开发地址。
const DEFAULT_API = 'http://localhost:8787'
const DEFAULT_WORKSPACE = 'http://localhost:5173'

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      { apiUrl: DEFAULT_API, workspaceUrl: DEFAULT_WORKSPACE },
      (s) => resolve(s)
    )
  })
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'OPEN_WORKSPACE') {
    getSettings().then((s) => {
      chrome.tabs.create({ url: s.workspaceUrl })
      sendResponse({ ok: true })
    })
    return true // 保持异步通道
  } else if (msg.type === 'SAVE_APPLICATION') {
    saveApplication(msg.data)
      .then((r) => sendResponse({ ok: true, data: r }))
      .catch((e) => sendResponse({ ok: false, error: e.message }))
    return true
  }
})

async function saveApplication({ company, position, url }) {
  const { apiUrl } = await getSettings()
  const tab = await getCurrentTab()
  const res = await fetch(`${apiUrl}/api/applications`, {
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
