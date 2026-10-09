const $ = id => document.getElementById(id)
let settings = {}, currentId = ''
const defaults = {apiUrl:'http://localhost:8787',workspaceUrl:'http://localhost:5173',token:''}
function setMsg(text,ok=true) { $('msg').textContent=text; $('msg').className='msg '+(ok?'ok':'err') }
async function request(path, body) {
  const response = await fetch(settings.apiUrl + '/api' + path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(settings.token?{Authorization:'Bearer '+settings.token}:{})},...(body?{body:JSON.stringify(body)}:{})})
  const data = await response.json()
  if (!response.ok) {
    if (response.status===401) { settings.token=''; await chrome.storage.local.remove('token'); $('auth').hidden=false }
    throw new Error(data.error || '请求失败')
  }
  return data
}
async function loadResumes() {
  $('auth').hidden=!!settings.token
  $('resume').replaceChildren(); currentId=''
  if (!settings.token) return setMsg('请登录，与工作台共用账号',false)
  try {
    const list=await request('/resumes')
    const {resumeId}=await chrome.storage.local.get('resumeId')
    list.forEach(r => { const option=document.createElement('option');option.value=r.id;option.textContent=r.name;$('resume').appendChild(option) })
    currentId=list.some(r => r.id===resumeId)?resumeId:list[0]?.id || ''
    $('resume').value=currentId
    await chrome.storage.local.set({resumeId:currentId})
    setMsg(list.length?'简历已同步，可填充当前页面':'暂无简历，请在工作台创建',!!list.length)
  } catch(e) {setMsg(e.message,false)}
}
$('login').addEventListener('click',async () => {
  try { const result=await request('/auth/login',{account:$('account').value.trim(),password:$('password').value});settings.token=result.token;await chrome.storage.local.set({token:result.token});$('password').value='';await loadResumes() } catch(e){setMsg(e.message,false)}
})
$('logout').addEventListener('click',async()=>{settings.token='';await chrome.storage.local.remove(['token','resumeId']);await loadResumes()})
$('resume').addEventListener('change',async e => {currentId=e.target.value;await chrome.storage.local.set({resumeId:currentId})})
$('fill').addEventListener('click',async () => {
  if(!currentId)return setMsg('请先选择简历',false)
  try {
    const resume=await request('/resumes/'+currentId), [tab]=await chrome.tabs.query({active:true,currentWindow:true})
    await chrome.scripting.executeScript({target:{tabId:tab.id},files:['content.js']})
    const result=await chrome.tabs.sendMessage(tab.id,{type:'FILL_FORM',resume})
    setMsg(result?.filled?`已填充 ${result.filled} 个字段，请核对后提交`:'未识别到空白字段',!!result?.filled)
  } catch(e){setMsg('填充失败：'+e.message,false)}
})
$('record').addEventListener('click',()=>chrome.runtime.sendMessage({type:'SAVE_APPLICATION',data:{}},result=>setMsg(result?.ok?'投递已记录，请到工作台核实公司与岗位':result?.error || '记录失败',!!result?.ok)))
$('open').addEventListener('click',()=>chrome.runtime.sendMessage({type:'OPEN_WORKSPACE'}))
$('saveSettings').addEventListener('click',async () => {
  try {
    const api=new URL($('apiUrl').value),workspace=new URL($('workspaceUrl').value)
    if (![api,workspace].every(u => ['http:','https:'].includes(u.protocol) && !u.username && !u.password)) throw new Error('请输入 HTTP / HTTPS 地址')
    if (api.origin!==settings.apiUrl) settings.token=''
    settings.apiUrl=api.origin;settings.workspaceUrl=workspace.origin
    await chrome.storage.local.set(settings);await loadResumes()
  } catch(e){setMsg(e.message,false)}
})
;(async()=>{settings=await chrome.storage.local.get(defaults);$('apiUrl').value=settings.apiUrl;$('workspaceUrl').value=settings.workspaceUrl;await loadResumes()})()
