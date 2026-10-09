import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {startServer,register} from './helpers.js'
const Database=createRequire(new URL('../server/src/index.js',import.meta.url))('better-sqlite3')
test('订单权限、模拟收入隔离、金额校验及幂等结算',async()=>{
 const server=await startServer()
 try {
  const a=await register(server.request,41),b=await register(server.request,42)
  const purchase=await server.request('/pay/checkout',{token:a.token,body:{plan:'monthly',amount:1}})
  assert.equal(purchase.status,200)
  const orders=(await server.request('/pay/orders',{token:a.token})).data
  assert.equal(orders.length,1);assert.equal(orders[0].amount,2900);assert.equal(orders[0].provider,'mock');assert.equal(orders[0].status,'paid')
  assert.equal((await server.request('/pay/orders/'+orders[0].id,{token:b.token})).status,404)
  assert.deepEqual((await server.request('/pay/orders',{token:b.token})).data,[])
  const admin=await server.request('/auth/login',{body:{account:'test_admin',password:'admin-password'}})
  const stats=(await server.request('/admin/stats',{token:admin.data.token})).data
  assert.equal(stats.cost.revenueCny,0);assert.equal(stats.cost.paidOrders,0)
  const script=`import assert from 'node:assert/strict'; import store from './src/store/db.js'; const id=${JSON.stringify(orders[0].id)},userId=${JSON.stringify(a.user.id)}; const before=store.findUserById(userId).planExpiresAt; assert.throws(()=>store.settleOrder(id,{amount:1})); store.settleOrder(id,{amount:2900,providerOrderId:'repeat'}); assert.equal(store.findUserById(userId).planExpiresAt,before); console.log('ok')`
  const child=spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:new URL('../server/',import.meta.url),env:{...process.env,DB_FILE:path.join(server.directory,'test.db')},encoding:'utf8'})
  assert.equal(child.status,0,child.stderr)
 }finally{await server.stop()}
})
test('真实 AI 环境中基础文本导入不调用模型也不扣次',async()=>{
 const server=await startServer({AI_API_KEY:'isolated-test-key',AI_BASE_URL:'http://127.0.0.1:1',FREE_AI_QUOTA:'2',AI_RETRIES:'0'})
 try {
  const user=await register(server.request,43)
  const form=new FormData();form.append('file',new Blob(['张三\n邮箱：sample@example.com\n工作经历：负责公司前端页面开发']),'resume.txt')
  const result=await server.request('/resumes/import',{token:user.token,body:form})
  assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.headers.get('x-ai-mode'),'local')
  assert.equal(result.data.basics.email,'sample@example.com')
  assert.equal((await server.request('/auth/me',{token:user.token})).data.quota.aiRemaining,2)
  const backup=path.join(server.directory,'backup.db')
  const child=spawnSync(process.execPath,['scripts/backup-db.mjs',backup],{cwd:new URL('../',import.meta.url),env:{...process.env,DB_FILE:path.join(server.directory,'test.db')},encoding:'utf8'})
  assert.equal(child.status,0,child.stderr)
  const db=new Database(backup,{readonly:true});assert.equal(db.pragma('integrity_check',{simple:true}),'ok');assert.equal(db.prepare('SELECT count(*) n FROM resumes').get().n,1);db.close()
 }finally{await server.stop()}
})
