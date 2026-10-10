import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import {build} from 'esbuild'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {parseAIData} from '../web/src/utils/aiPresentation.js'
let component
async function render(content) {
 if(!component){const directory=path.resolve('outputs/qa');await fs.mkdir(directory,{recursive:true});const file=path.join(directory,'ai-response-test.mjs');await build({entryPoints:['web/src/components/AIResponse.jsx'],bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/jsx-runtime'],outfile:file});component=(await import(file)).default}
 return renderToStaticMarkup(React.createElement(component,{content}))
}
test('AI 建议以标题、加粗、列表、表格排版，无原始 Markdown 标记',async()=>{
 const html=await render('## 优化建议\n\n**保留真实事实**\n\n- 第一条\n- 第二条\n\n| 项目 | 建议 |\n| --- | --- |\n| 经历 | 简洁 |')
 for(const tag of ['<h2>','<strong>','<ul>','<table>']) assert.ok(html.includes(tag),tag)
 assert.ok(!html.includes('##'));assert.ok(!html.includes('**'));assert.ok(!html.includes('| ---'))
})
test('JSON 与代码围栏显示中文字段，不显示结构符号；保留申请所需原始数据',async()=>{
 const raw='```json\n{"company":"真实公司","bullets":["维护12个组件","修复问题"]}\n```'
 assert.deepEqual(parseAIData(raw),{company:'真实公司',bullets:['维护12个组件','修复问题']})
 const html=await render(raw);assert.match(html,/公司/);assert.match(html,/工作内容/);assert.match(html,/维护12个组件/);assert.ok(!/[{}]/.test(html));assert.ok(!html.includes('```'))
 const mixed=await render('建议如下：\n\n'+raw);assert.match(mixed,/工作内容/);assert.ok(!mixed.includes('```'))
})
test('模型 HTML 和危险链接不执行，字符串和空数组仍可阅读',async()=>{
 const html=await render('<script>alert(1)</script>\n\n[链接](javascript:alert(1))\n\n**有效建议**')
 assert.ok(!html.includes('<script'));assert.ok(!html.includes('javascript:'));assert.match(html,/有效建议/)
 assert.equal(parseAIData('普通建议'),null);assert.deepEqual(parseAIData('[]'),[])
})
