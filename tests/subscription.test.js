import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import path from 'node:path'
import { startServer, register } from './helpers.js'
const Database = createRequire(new URL('../server/src/index.js', import.meta.url))('better-sqlite3')
test('会员原子扣次、失败退次、提前续费不重置、跨期恢复额度', async () => {
  const server = await startServer({ PRO_AI_QUOTA: '2', AI_USER_DAILY_QUOTA: '20' })
  const { request } = server
  try {
    const {token,user} = await register(request, 31)
    await request('/pay/checkout', {token,body:{plan:'monthly'}})
    assert.equal((await request('/ai/translate',{token,body:{resume:{},target:'en'}})).status,503)
    assert.equal((await request('/auth/me',{token})).data.quota.aiRemaining,2)
    const results = await Promise.all([1,2,3].map(()=>request('/ai/score',{token,body:{resume:{}}})))
    assert.deepEqual(results.map(r=>r.status).sort(),[200,200,402])
    await request('/pay/checkout',{token,body:{plan:'monthly'}})
    assert.equal((await request('/auth/me',{token})).data.quota.aiRemaining,0)
    const db = new Database(path.join(server.directory,'test.db'))
    const past = Date.now() - 31 * 86400000
    db.prepare("UPDATE users SET data=json_set(data,'$.planStartedAt',?) WHERE id=?").run(past,user.id)
    db.prepare('UPDATE ai_quota_requests SET createdAt=? WHERE userId=?').run(past,user.id)
    db.close()
    assert.equal((await request('/auth/me',{token})).data.quota.aiRemaining,2)
    assert.equal((await request('/ai/score',{token,body:{resume:{}}})).status,200)
    assert.equal((await request('/auth/me',{token})).data.quota.aiRemaining,1)
  } finally { await server.stop() }
})
test('每日额度和输入长度拦截不消耗月度次数', async()=>{
 const server=await startServer({PRO_AI_QUOTA:'5',AI_USER_DAILY_QUOTA:'1'})
 try {
  const {token}=await register(server.request,32)
  await server.request('/pay/checkout',{token,body:{plan:'monthly'}})
  assert.equal((await server.request('/ai/chat',{token,body:{messages:[{role:'user',content:'a'.repeat(33000)}]}})).status,400)
  assert.equal((await server.request('/ai/score',{token,body:{resume:{}}})).status,200)
  assert.equal((await server.request('/ai/score',{token,body:{resume:{}}})).status,429)
  assert.equal((await server.request('/auth/me',{token})).data.quota.aiRemaining,4)
 } finally {await server.stop()}
})
