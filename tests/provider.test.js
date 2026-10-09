import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { once } from 'node:events'
import { startServer,register } from './helpers.js'

test('真实服务代码：JSON 合约、上下文、错误退款、图片识别与音频 multipart',async()=>{
 let broken=false, unauthorized=false; const requests=[]
 const fake=http.createServer(async(req,res)=>{
  let raw='';for await(const chunk of req)raw+=chunk
  requests.push({url:req.url,raw,headers:req.headers})
  res.setHeader('Content-Type','application/json')
  if(req.url==='/transcribe'){res.end(JSON.stringify({text:'测试录音的真实服务返回'}));return}
  if (unauthorized) { res.statusCode=401; res.end(JSON.stringify({error:'Incorrect API key: fake-test-only'}));return }
  const body=JSON.parse(raw)
  let content='针对历史对话的回答'
  if(Array.isArray(body.messages[0]?.content)) content='截图岗位：React 工程师'
  else if(body.response_format) content=JSON.stringify(broken ? {overall:90} : {overall:80,summary:'服务返回',dimensions:[{key:'completeness',name:'完整度',score:80,tip:'检查内容'}],strengths:[],atsKeywords:[],improvements:[]})
  res.end(JSON.stringify({choices:[{message:{content},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:23,prompt_cache_hit_tokens:40,total_tokens:123}}))
 }).listen(0,'127.0.0.1');await once(fake,'listening');const base='http://127.0.0.1:'+fake.address().port
 const server=await startServer({AI_API_KEY:'fake-test-only',AI_BASE_URL:base,AI_MODEL:'deepseek-flash',AI_RETRIES:'0',OCR_PROVIDER:'openai',OCR_BASE_URL:base,OCR_API_KEY:'fake-ocr-key',ASR_PROVIDER:'whisper',ASR_ENDPOINT:base+'/transcribe',ASR_API_KEY:'fake-asr-key'})
 try {
  const user=await register(server.request,7),token=user.token
  const result=await server.request('/ai/score',{token,body:{resume:{summary:'真实内容'}}});assert.equal(result.status,200);assert.equal(result.headers.get('x-ai-mode'),'live');assert.equal(result.data.overall,80)
  const sent=JSON.parse(requests[0].raw);assert.deepEqual(sent.response_format,{type:'json_object'});assert.deepEqual(sent.thinking,{type:'disabled'});assert.match(sent.messages[0].content,/不得编造/)
  const history=[{role:'user',content:'第一个问题'},{role:'assistant',content:'第一个回答'},{role:'user',content:'继续这个问题'}]
  const chat=await server.request('/ai/chat',{token,body:{messages:history}});assert.equal(chat.status,200);assert.deepEqual(JSON.parse(requests.at(-1).raw).messages.slice(1),history)
  const before=(await server.request('/auth/me',{token})).data.quota.aiRemaining
  broken=true;assert.equal((await server.request('/ai/score',{token,body:{resume:{}}})).status,502);assert.equal((await server.request('/auth/me',{token})).data.quota.aiRemaining,before)
  unauthorized=true;assert.equal((await server.request('/ai/score',{token,body:{resume:{}}})).status,503);assert.ok(!JSON.stringify((await server.request('/health')).data).includes('fake-test-only'));unauthorized=false
  const image=new FormData();image.append('file',new Blob([Buffer.from([137,80,78,71,13,10,26,10,1,2,3])],{type:'image/png'}),'image.png')
  const ocr=await server.request('/ai/ocr',{token,body:image});assert.equal(ocr.status,200);assert.equal(ocr.data.text,'截图岗位：React 工程师');assert.match(JSON.parse(requests.at(-1).raw).messages[0].content[1].image_url.url,/^data:image\/png;base64,/)
  const audio=new FormData();audio.append('file',new Blob(['test audio'],{type:'audio/webm'}),'record.webm')
  const admin=await server.request('/auth/login',{body:{account:'test_admin',password:'admin-password'}})
  const stats=await server.request('/admin/stats',{token:admin.data.token})
  assert.equal(stats.data.cost.calls,4)
  assert.equal(stats.data.cost.input,400)
  assert.equal(stats.data.cost.output,92)
  assert.ok(stats.data.cost.estimatedCny>0)
  assert.equal(stats.data.cost.byUser[0].userId,user.user.id)
  const asr=await server.request('/ai/transcribe',{token,body:audio});assert.equal(asr.status,200);assert.equal(asr.data.text,'测试录音的真实服务返回');assert.match(requests.at(-1).headers['content-type'],/multipart\/form-data/);assert.match(requests.at(-1).raw,/record.webm/)
 }finally {await server.stop();await new Promise(resolve=>fake.close(resolve))}
})
