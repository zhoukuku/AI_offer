export const FIELD_LABELS={score:'评分',overall:'综合评分',strengths:'优点',weaknesses:'不足',suggestions:'改进建议',summary:'个人总结',basics:'基本信息',experience:'工作经历',education:'教育经历',projects:'项目经历',skills:'技能',honors:'荣誉奖项',custom:'补充信息',name:'姓名 / 名称',title:'职位 / 标题',phone:'电话',email:'邮箱',city:'城市',website:'个人网站',company:'公司',role:'职位 / 角色',start:'开始时间',end:'结束时间',bullets:'工作内容',school:'学校',degree:'学历',major:'专业',tech:'技术栈',description:'项目描述',content:'内容',text:'建议内容',reply:'回复',analysis:'分析',reason:'原因',original:'原文',rewritten:'润色结果',optimized:'优化结果',recommendations:'建议',issues:'问题',improvements:'优化建议',keywords:'关键词',missing:'待补充',message:'说明'}
export function parseAIData(value) {
  if(typeof value!=='string') return null
  const text=value.trim().replace(/^```(?:json)?\s*\n?/i,'').replace(/\n?```\s*$/,'').trim()
  if (!/^[\[{]/.test(text)) return null
  try {const parsed=JSON.parse(text);return parsed && typeof parsed==='object'?parsed:null} catch {return null}
}
