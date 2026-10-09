import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { once } from 'node:events'
export async function startServer(overrides = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(),'ai-offer-test-'))
  const socket = net.createServer().listen(0,'127.0.0.1'); await once(socket,'listening'); const port=socket.address().port; await new Promise(resolve=>socket.close(resolve))
  const child=spawn(process.execPath,['src/index.js'],{cwd:new URL('../server/',import.meta.url),env:{...process.env,PORT:String(port),DB_FILE:path.join(directory,'test.db'),AI_API_KEY:'',AUTH_SECRET:'isolated-test-secret',DEMO_MODE:'true',SMS_PROVIDER:'mock',PAYMENT_PROVIDER:'mock',OCR_PROVIDER:'mock',ASR_PROVIDER:'mock',FREE_AI_QUOTA:'20',FREE_MAX_RESUMES:'3',DEMO_ACCOUNT:'test_admin',DEMO_PASSWORD:'admin-password',DEMO_PHONE:'13800000001',...overrides},stdio:['ignore','pipe','pipe']})
  let logs='';child.stdout.on('data',x=>logs+=x);child.stderr.on('data',x=>logs+=x)
  const base=`http://127.0.0.1:${port}`
  const request=async(route,{body,token,method}={})=>{const form=body instanceof FormData;const response=await fetch(base+'/api'+route,{method:method || (body?'POST':'GET'),headers:{...(!form&&body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:form?body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json(),headers:response.headers}}
  for(let i=0;i<100;i++) {try {await request('/health');return {base,request,child,directory,async stop(){const done=once(child,'exit');child.kill();await done;await fs.rm(directory,{recursive:true,force:true})}}}catch{} if(child.exitCode!==null||child.signalCode)throw new Error(logs || 'Server exited');await new Promise(r=>setTimeout(r,50))}
  child.kill();throw new Error(logs || 'Server failed to start')
}
export async function register(request, suffix) {
  const phone='139000000'+String(suffix).padStart(2,'0')
  const sent=await request('/auth/send-code',{body:{phone}})
  const result=await request('/auth/register',{body:{account:'test_user_'+suffix,password:'password123',phone,code:sent.data.code}})
  if(result.status!==200)throw new Error(JSON.stringify(result))
  return result.data
}
