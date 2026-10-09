import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { chromium } from '@playwright/test'
import { fileURLToPath } from 'node:url'

test('插件填表：字符串经历、框架输入事件、保留已有值与敏感字段',async()=>{
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || 'chrome',headless:true})
 try{
  const page=await browser.newPage();await page.setContent('<label for="name">姓名</label><input id="name"><input name="email" value="existing@example.com"><textarea name="experience"></textarea><input name="phone" type="password"><input name="city" type="hidden"><select name="major"><option value="">请选择</option><option value="cs">计算机</option></select>')
  await page.evaluate(()=>{window.chrome={runtime:{onMessage:{addListener(handler){window.fillListener=handler}}}};window.events=[];document.querySelector('#name').addEventListener('input',()=>events.push('input'))})
  await page.addScriptTag({path:fileURLToPath(new URL('../extension/content.js',import.meta.url))})
  const result=await page.evaluate(()=>new Promise(resolve=>fillListener({type:'FILL_FORM',resume:{basics:{name:'测试姓名',phone:'13900000001',email:'new@example.com',city:'上海'},experience:[{company:'真实公司',role:'工程师',bullets:'第一条真实经历\n第二条真实经历\n第三条'}],education:[{major:'计算机'}]}},null,resolve)))
  assert.equal(result.filled,3);assert.equal(await page.locator('#name').inputValue(),'测试姓名');assert.equal(await page.locator('[name=email]').inputValue(),'existing@example.com');assert.match(await page.locator('textarea').inputValue(),/第一条真实经历\n第二条真实经历/);assert.equal(await page.locator('[type=password]').inputValue(),'');assert.equal(await page.locator('select').inputValue(),'cs');assert.deepEqual(await page.evaluate(()=>events),['input'])
  const manifest=JSON.parse(await fs.readFile(new URL('../extension/manifest.json',import.meta.url)));assert.equal(manifest.content_scripts,undefined)
 }finally{await browser.close()}
})
