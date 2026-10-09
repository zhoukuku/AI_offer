const DEFAULT_API = 'http://localhost:8787'
const DEFAULT_WORKSPACE = 'http://localhost:5173'
const settings = () => chrome.storage.local.get({apiUrl:DEFAULT_API,workspaceUrl:DEFAULT_WORKSPACE,token:''})
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!['OPEN_WORKSPACE','SAVE_APPLICATION'].includes(msg.type)) return
  ;(async () => {
    const s = await settings()
    if (msg.type === 'OPEN_WORKSPACE') { await chrome.tabs.create({url:s.workspaceUrl + '/interviews'}); return {ok:true} }
    if (!s.token) throw new Error('请先在插件中登录工作台账号')
    const [tab] = await chrome.tabs.query({active:true,currentWindow:true})
    if (!tab?.url || !/^https?:/.test(tab.url)) throw new Error('请在岗位网页上记录投递')
    const {resumeId} = await chrome.storage.local.get('resumeId')
    const response = await fetch(s.apiUrl + '/api/applications',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.token},body:JSON.stringify({company:msg.data?.company || new URL(tab.url).hostname,position:msg.data?.position || tab.title,url:tab.url,resumeId:resumeId || null,status:'已投递',source:'官网'})})
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || '记录失败')
    return {ok:true,data}
  })().then(sendResponse).catch(e => sendResponse({ok:false,error:e.message}))
  return true
})
