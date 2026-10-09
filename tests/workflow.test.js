import { test } from 'node:test'
import assert from 'node:assert/strict'
import { startServer,register } from './helpers.js'
import { diagnose } from '../server/src/ai/local.js'
import { validateResult } from '../server/src/ai/contracts.js'

const resume={basics:{name:'张测试',title:'前端工程师',phone:'13900000011',email:'test@example.com',city:'上海'},summary:'负责真实业务开发',experience:[{company:'测试公司',role:'前端工程师',start:'2021-01',end:'2024-12',bullets:['开发 React 后台','维护 12 个组件']}],education:[{school:'测试大学',degree:'本科',major:'计算机'}],projects:[],skills:['React','TypeScript'],honors:[]}

test('注册、导入、编辑、诊断、适配、版本、分享、投递、面试与会员完整流程',async()=>{
 const server=await startServer();const {request}=server
 try {
  assert.equal((await request('/health')).data.mode,'local')
  assert.equal((await request('/auth/register',{body:{account:'bypass',password:'password',phone:'13900000099',code:'123456'}})).status,400)
  const user=await register(request,1), token=user.token
  const form=new FormData();form.append('file',new Blob(['姓名：张测试\n求职意向：前端工程师\n电话：13900000011\n邮箱：test@example.com\n技能\nReact、TypeScript\n工作经历\n测试公司 前端工程师 2021-2024\n开发后台并维护12个组件'],{type:'text/plain'}),'测试简历.txt')
  const imported=await request('/resumes/import',{body:form,token});assert.equal(imported.status,200);assert.match(imported.data.basics.email,/test@example.com/)
  const id=imported.data.id
  const updated=await request('/resumes/'+id,{token,method:'PUT',body:resume});assert.equal(updated.status,200);assert.equal(typeof updated.data.experience[0].bullets,'string')
  const scored=await request('/ai/score',{token,body:{resume:updated.data}});assert.equal(scored.status,200);assert.equal(scored.headers.get('x-ai-mode'),'local');assert.ok(scored.data.dimensions.length)
  const match=await request('/ai/match',{token,body:{resume:updated.data,jd:'React TypeScript Python 前端工程师'}});assert.equal(match.status,200);assert.deepEqual(match.data.missing,['Python']);assert.equal(match.data.adaptedResume.experience[0].company,'测试公司');assert.ok(!match.data.adaptedResume.skills.includes('Python'))
  const optimized=await request('/ai/optimize',{token,body:{resume:updated.data,target:{type:'experience',index:0}}});assert.equal(optimized.status,200);assert.ok(!optimized.data.text.includes('40%'))
  const snapshot={id:'v1',name:'初版',createdAt:Date.now(),content:updated.data}
  await request('/resumes/'+id,{token,method:'PUT',body:{versions:[snapshot],summary:'定制版'}})
  assert.equal((await request('/resumes/'+id,{token})).data.versions[0].content.summary,resume.summary)
  const share=await request('/resumes/'+id+'/share',{token,body:{}});const view=await request('/share/'+share.data.token);assert.equal(view.status,200);assert.equal(view.data.viewCount,1);assert.equal(view.data.resume.userId,undefined)
  assert.equal((await request('/resumes/'+id+'/share',{token,method:'DELETE'})).status,200);assert.equal((await request('/share/'+share.data.token)).status,404)
  const app=await request('/applications',{token,body:{company:'目标公司',position:'前端',resumeId:id,jd:'React'}});assert.equal(app.status,200);assert.equal(app.data.resumeId,id)
  await request('/applications/'+app.data.id,{token,method:'PUT',body:{status:'面试'}})
  const interview=await request('/interviews',{token,body:{company:'目标公司',position:'前端',applicationId:app.data.id,questions:'自我介绍',notes:'回答记录'}});assert.equal(interview.status,200)
  const review=await request('/ai/review',{token,body:interview.data});assert.equal(review.status,200)
  await request('/interviews/'+interview.data.id,{token,method:'PUT',body:{review:review.data}})
  assert.equal((await request('/interviews',{token})).data[0].applicationId,app.data.id)
  const before=(await request('/auth/me',{token})).data.quota.aiRemaining
  assert.equal((await request('/ai/ocr',{token,body:{}})).status,400)
  assert.equal((await request('/ai/translate',{token,body:{resume,target:'en'}})).status,503)
  assert.equal((await request('/auth/me',{token})).data.quota.aiRemaining,before)
  for(const kind of ['coverletter','greet','duplicate','questions','interview','analyze','rewrite','chat','generate','experience']) {const response=await request('/ai/'+kind,{token,body:{resume,company:'目标公司',position:'前端',role:'前端',jd:'React',section:'summary',content:'真实经历',messages:[{role:'user',content:'如何改进？'}]}});assert.equal(response.status,200,kind)}
  const paid=await request('/pay/checkout',{token,body:{plan:'monthly'}});assert.equal(paid.status,200);assert.equal(paid.data.user.quota.effective,'pro')
  assert.equal((await request('/auth/me',{token})).data.quota.aiRemaining,100)
  await request('/resumes/'+id,{token,method:'DELETE'});assert.equal((await request('/resumes/'+id,{token})).status,404)
 }finally{await server.stop()}
})

test('用户隔离、ID 防覆盖、归属保护、并发名额与失败配额退款',async()=>{
 const server=await startServer({FREE_AI_QUOTA:'2',FREE_MAX_RESUMES:'1'});const {request}=server
 try {
  const a=await register(request,2),b=await register(request,3)
  const created=await Promise.all([1,2].map(()=>request('/resumes',{token:a.token,body:{name:'并发简历',...resume}})));assert.deepEqual(created.map(x=>x.status).sort(),[200,402])
  const id=created.find(x=>x.status===200).data.id
  assert.equal((await request('/resumes/'+id,{token:b.token})).status,404)
  await request('/resumes/'+id,{token:a.token,method:'PUT',body:{id:'tampered',userId:b.user.id,summary:'可修改'}})
  const own=await request('/resumes/'+id,{token:a.token});assert.equal(own.data.id,id);assert.equal(own.data.userId,a.user.id)
  const one=await request('/interviews',{token:a.token,body:{company:'公司',id:'collision'}})
  const two=await request('/interviews',{token:b.token,body:{company:'公司',id:one.data.id}});assert.notEqual(two.data.id,one.data.id);assert.equal((await request('/interviews',{token:a.token})).data.length,1)
  assert.equal((await request('/interviews/'+one.data.id,{token:b.token,method:'PUT',body:{notes:'越权'}})).status,404)
  assert.equal((await request('/applications',{token:b.token,body:{company:'公司',resumeId:id}})).status,400)
  assert.equal((await request('/resumes')).status,401)
  const responses=await Promise.all([1,2,3].map(()=>request('/ai/score',{token:a.token,body:{resume}})));assert.deepEqual(responses.map(x=>x.status).sort(),[200,200,402]);assert.equal((await request('/auth/me',{token:a.token})).data.quota.aiRemaining,0)
  const before=(await request('/auth/me',{token:b.token})).data.quota.aiRemaining
  const fd=new FormData();fd.append('file',new Blob(['not an image']),'fake.png');assert.equal((await request('/ai/ocr',{token:b.token,body:fd})).status,503)
  assert.equal((await request('/auth/me',{token:b.token})).data.quota.aiRemaining,before)
 }finally{await server.stop()}
})

test('本地诊断随实际内容变化，模型输出缺字段时拒绝应用',()=>{
 assert.ok(diagnose(resume).overall>diagnose({}).overall)
 assert.throws(()=>validateResult('score',{overall:80}),/格式/)
 assert.throws(()=>validateResult('match',{raw:'broken'}),/格式/)
 assert.equal(validateResult('optimize',{text:'原文'}).text,'原文')
})

test('生产模式不创建演示账号，不开放模拟短信与付费',async()=>{
 const server=await startServer({DEMO_MODE:'false',NODE_ENV:'production'});const {request}=server
 try{assert.equal((await request('/health')).data.demo,false);assert.equal((await request('/auth/login',{body:{account:'test_admin',password:'admin-password'}})).status,400);assert.equal((await request('/auth/send-code',{body:{phone:'13900000088'}})).status,502)}finally{await server.stop()}
})
