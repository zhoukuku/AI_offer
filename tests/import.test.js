import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { startServer,register } from './helpers.js'

test('PDF 与 DOCX 提取真实文本，拒绝损坏文件与未知格式',async()=>{
 const server=await startServer();const user=await register(server.request,18)
 try{
  for(const [extension,email] of [['docx','document@example.com'],['pdf','browser@example.com']]){
   const fd=new FormData();fd.append('file',new Blob([await fs.readFile(new URL(`fixtures/resume.${extension}`,import.meta.url))]),`resume.${extension}`)
   const result=await server.request('/resumes/import',{token:user.token,body:fd});assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.basics.email,email)
  }
  for(const extension of ['exe','pdf']){const fd=new FormData();fd.append('file',new Blob(['invalid']),'bad.'+extension);assert.equal((await server.request('/resumes/import',{token:user.token,body:fd})).status,400)}
  assert.equal((await server.request('/resumes',{token:user.token})).data.length,2)
 }finally{await server.stop()}
})
