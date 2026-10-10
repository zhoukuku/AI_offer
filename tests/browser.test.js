import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { startServer, register } from './helpers.js'

const artifacts=new URL('../outputs/qa/',import.meta.url)
test('浏览器：登录 → 导入 → 自动保存 → 诊断 → 分享 → JD → 投递 → 复盘 → 会员', {timeout:60000}, async()=>{
 const server=await startServer(),user=await register(server.request,13)
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || 'chrome',headless:true})
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[]
 page.on('pageerror',error=>errors.push(error.message))
 try {
  await fs.mkdir(artifacts,{recursive:true})
  await page.goto(server.base+'/login')
  await page.locator('.login-card input').nth(0).fill('test_user_13');await page.locator('.login-card input').nth(1).fill('password123')
  await page.locator('form').getByRole('button',{name:'登录',exact:true}).click();await page.waitForURL('**/app')
  await page.locator('input[type=file]').setInputFiles({name:'浏览器简历.txt',mimeType:'text/plain',buffer:Buffer.from('姓名：浏览器测试\n求职意向：前端工程师\n电话：13900000013\n邮箱：browser@example.com\n技能\nReact、TypeScript\n工作经历\n测试公司 前端工程师 2021-2024\n开发后台并维护12个组件')})
  await page.waitForURL('**/resume/*')
  const id=page.url().split('/').at(-1)
  await page.getByPlaceholder('一句话概括你的经验、优势与求职方向…').fill('实际完成 React 项目，并维护 12 个组件。')
  await page.locator('.toolbar-main').getByRole('button',{name:'已保存',exact:true}).waitFor()
  assert.equal((await server.request('/resumes/'+id,{token:user.token})).data.summary,'实际完成 React 项目，并维护 12 个组件。')
  await page.reload();assert.equal(await page.getByPlaceholder('一句话概括你的经验、优势与求职方向…').inputValue(),'实际完成 React 项目，并维护 12 个组件。')
  await context.setOffline(true)
  await page.getByPlaceholder('一句话概括你的经验、优势与求职方向…').fill('断网时的真实草稿，维护 12 个组件。')
  await expect(page.locator('.error-banner')).toContainText('草稿已保留')
  await context.setOffline(false);await page.reload()
  await expect(page.getByPlaceholder('一句话概括你的经验、优势与求职方向…')).toHaveValue('断网时的真实草稿，维护 12 个组件。')
  await page.locator('.toolbar-main').getByRole('button',{name:'已保存',exact:true}).waitFor()
  await page.getByRole('button',{name:'AI 体检'}).click();await page.locator('.score-ring-num').waitFor()
  await page.getByRole('button',{name:'关闭',exact:true}).last().click()
  await page.getByRole('button',{name:'分享投递',exact:true}).click();await page.locator('input[readonly]').waitFor()
  const shareURL=await page.locator('input[readonly]').inputValue()
  const publicPage=await browser.newPage();await publicPage.goto(shareURL);await publicPage.locator('.preview').waitFor();assert.match(await publicPage.locator('.preview').innerText(),/12 个组件/);await publicPage.close()
  await page.getByRole('button',{name:'关闭',exact:true}).last().click()
  await page.emulateMedia({media:'print'});await page.pdf({path:fileURLToPath(new URL('resume.pdf',artifacts)),format:'A4',printBackground:true});await page.emulateMedia({media:'screen'})
  await page.screenshot({path:fileURLToPath(new URL('editor.png',artifacts)),fullPage:true,animations:'disabled'})
  await page.getByRole('link',{name:'岗位适配',exact:true}).click()
  await page.getByPlaceholder('记录投递时填写').fill('浏览器目标公司');await page.getByPlaceholder('粘贴招聘岗位描述（职责 / 要求）…').fill('React TypeScript Python 前端工程师')
  await page.getByRole('button',{name:'开始适配',exact:true}).click();await page.locator('.match-score').waitFor()
  await page.getByRole('button',{name:'已投递，记录进度'}).click();await page.waitForURL('**/applications')
  await page.locator('tbody').getByRole('button',{name:'面试复盘'}).click();await page.waitForURL('**/interviews?application=*')
  await expect(page.getByPlaceholder('如：腾讯', {exact:true})).toHaveValue('浏览器目标公司')
  await page.getByPlaceholder('记录你的回答要点或薄弱环节…').fill('说明了实际项目与个人贡献')
  await page.getByRole('button',{name:'保存并 AI 复盘'}).click()
  await expect(page.getByText('说明了实际项目与个人贡献',{exact:true})).toBeVisible()
  await page.screenshot({path:fileURLToPath(new URL('interviews.png',artifacts)),fullPage:true,animations:'disabled'})
  await page.goto(server.base+'/upgrade');await page.getByRole('button',{name:'模拟开通（不扣款）'}).click();await page.locator('.ok-banner').waitFor();assert.match(await page.locator('.upgrade-quota-value').first().innerText(),/^100$/)
  assert.deepEqual(errors,[])
  assert.ok((await fs.stat(new URL('resume.pdf',artifacts))).size>1000)
 } finally {await browser.close();await server.stop()}
})
