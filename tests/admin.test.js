import { test } from 'node:test'
import assert from 'node:assert/strict'
import {startServer,register} from './helpers.js'
test('运营日志记录真实操作、筛选分页、权限隔离与敏感内容不落日志',async()=>{
 const server=await startServer()
 try {
  const a=await register(server.request,41),b=await register(server.request,42)
  const admin=await server.request('/auth/login',{body:{account:'test_admin',password:'admin-password'}})
  const token=admin.data.token
  const r=await server.request('/resumes',{token:a.token,body:{name:'日志测试',summary:'PRIVATE_RESUME_BODY'}})
  await server.request('/resumes/'+r.data.id,{token:a.token,method:'PUT',body:{summary:'PRIVATE_UPDATED_BODY'}})
  await server.request('/ai/score',{token:a.token,body:{resume:{}}})
  assert.equal((await server.request('/admin/logs',{token:b.token})).status,403)
  const logs=await server.request('/admin/logs?category=resume&userId='+a.user.id,{token})
  assert.equal(logs.status,200);assert.equal(logs.data.total,2)
  assert.ok(logs.data.rows.every(row=>row.userId===a.user.id&&row.category==='resume'&&row.resourceId))
  assert.equal(JSON.stringify(logs.data).includes('PRIVATE_'),false)
  assert.equal(JSON.stringify(logs.data).includes('password123'),false)
  const stats=await server.request('/admin/stats',{token})
  assert.equal(stats.data.customers,2);assert.equal(stats.data.todayAI,1);assert.equal(stats.data.trend.length,7)
  assert.equal((await server.request('/admin/logs?page=2&category=resume',{token})).data.rows.length,0)
 } finally {await server.stop()}
})
