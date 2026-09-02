// 无 API Key 时的演示模式实现。
// 针对不同任务类型（kind）返回结构化的示例内容，保证全流程无需真实大模型也可跑通。

function tryParse(input) {
  if (typeof input !== 'string') return null
  try {
    return JSON.parse(input)
  } catch {
    return null
  }
}

// 从提示词里抽取基础信息（姓名 / 岗位 / 行业），增强 mock 的"定制感"
function guessBasics(prompt) {
  const parsed = tryParse(prompt)
  if (parsed) return parsed
  const base = {}
  const matches = (re) => {
    const m = String(prompt).match(re)
    return m ? m[1].trim() : ''
  }
  base.name = matches(/姓名[:：]\s*([^\n，,]+)/) || '示例用户'
  base.role = matches(/岗位|职位|目标岗位[:：]\s*([^\n，,]+)/) || '前端开发工程师'
  base.industry = matches(/行业[:：]\s*([^\n，,]+)/) || '互联网'
  base.years = matches(/年限|经验[:：]\s*([^\n，,]+)/) || '3 年'
  return base
}

function buildResume(basics) {
  const role = basics.role || '前端开发工程师'
  const name = basics.name || '示例用户'
  const years = basics.years || '3 年'
  const city = basics.city || '北京'
  return {
    basics: {
      name,
      title: role,
      phone: basics.phone || '138-0000-0000',
      email: basics.email || 'example@email.com',
      city,
      website: basics.website || '',
      avatar: '',
    },
    summary: `${years}${role}经验，专注于${basics.industry || '互联网'}方向，具备扎实的工程基础与良好的跨团队协作能力，擅长将业务需求转化为高质量技术方案，关注性能与用户体验。`,
    experience: [
      {
        company: '字节跳动',
        role,
        start: '2022-07',
        end: '至今',
        city,
        bullets: [
          `负责核心业务模块的${role.includes('前端') ? '前端架构' : '功能开发'}，覆盖日均千万级请求，页面性能提升 40%`,
          '主导技术重构与组件库建设，推动团队协作效率提升，代码复用率提高 60%',
          '与产品、设计、后端紧密配合，按期交付多个重点项目，获团队季度之星',
        ],
      },
      {
        company: '某互联网创业公司',
        role: role.includes('前端') ? '前端开发工程师' : role,
        start: '2020-07',
        end: '2022-06',
        city: '上海',
        bullets: [
          '从 0 到 1 参与核心产品研发，覆盖需求评审、方案设计、开发上线全流程',
          '搭建自动化测试与监控体系，线上故障率下降 70%',
        ],
      },
    ],
    education: [
      {
        school: '示例大学',
        degree: '本科',
        major: '计算机科学与技术',
        start: '2016',
        end: '2020',
      },
    ],
    projects: [
      {
        name: '企业级低代码平台',
        role: '核心开发',
        tech: 'React / TypeScript / Node.js',
        start: '2023-03',
        end: '2023-12',
        description: '搭建可视化拖拽搭建系统，支撑内部多个业务线快速搭建运营页面，平均交付周期缩短 50%。',
      },
    ],
    skills: role.includes('前端')
      ? ['JavaScript / TypeScript', 'React / Vue', 'Node.js', '工程化与性能优化']
      : ['需求分析', '系统设计', '跨团队协作', '数据分析'],
    honors: ['校级优秀毕业生', '某某编程竞赛一等奖'],
  }
}

// 从 JD 文本中提取目标岗位与高频关键词，用于 mock 的"转行适配"演示
function extractJd(jdText) {
  const jd = String(jdText || '')
  const roleMatch =
    jd.match(/【职位】\s*([^\n（(]+)/) ||
    jd.match(/(?:职位|岗位|title)\s*[:：]\s*([^\n，,]+)/)
  const role = roleMatch ? roleMatch[1].trim() : ''
  const POOL = [
    'TypeScript', 'JavaScript', 'React', 'Vue', 'Node.js', 'Java', 'Python', 'Go',
    '小程序', '微前端', '跨端', '性能优化', '工程化', '组件库', '自动化测试',
    '监控', '高并发', '微服务', '数据库', 'Redis', '算法', '机器学习', '深度学习',
    '数据分析', 'SQL', '产品', '运营', '项目管理', '供应链', '金融', '医疗', '电商',
  ]
  const keywords = POOL.filter((k) => jd.toLowerCase().includes(k.toLowerCase()))
  return { role, keywords }
}

// 生成一份"对标 JD"的适配简历（演示跨行转行：原经历映射为可迁移能力、术语替换为 JD 关键词）
function buildAdaptedResume(jd, srcResume) {
  const src = srcResume || {}
  const b = src.basics || {}
  const srcRole = b.title || '原岗位'
  const jdInfo = extractJd(jd)
  const role = jdInfo.role || srcRole
  const kws = jdInfo.keywords.length ? jdInfo.keywords : ['可迁移能力', '跨团队协作', '问题拆解']
  const topKws = kws.slice(0, 4)
  const allSkills = [...new Set([...kws, ...(src.skills || [])])].slice(0, 8)

  const summary = `拥有多年跨行业实战经验，现正转向「${role}」方向。具备可迁移的通用能力（${topKws.join('、')}），并已系统补齐目标岗位所需技能，擅长将过往方法论快速复制到新赛道，以结果导向推动目标达成。`

  const experience = (src.experience || []).map((e) => ({
    ...e,
    bullets: [
      `（跨行迁移）在原岗位主导复杂项目从 0 到 1 交付，沉淀出与「${role}」高度可迁移的目标拆解、方案设计与落地执行能力`,
      `将原业务积累的「${topKws[0] || '核心能力'}」方法论迁移到新岗位，形成可复用的通用解决方案，快速创造价值`,
    ].join('\n'),
  }))

  return {
    basics: { ...b, title: role },
    summary,
    experience,
    education: src.education || [],
    projects: src.projects || [],
    skills: allSkills,
    honors: src.honors || [],
  }
}

// ===== 旧简历导入：演示模式（无大模型）下用启发式规则从真实文本中抽取字段 =====
const CITY_POOL = ['北京', '上海', '广州', '深圳', '杭州', '南京', '成都', '武汉', '西安', '苏州', '天津', '重庆', '长沙', '郑州', '青岛', '大连', '宁波', '厦门', '福州', '合肥', '济南', '昆明', '沈阳', '哈尔滨', '石家庄', '南昌', '贵阳', '兰州', '无锡', '佛山', '东莞', '珠海', '常州', '温州', '太原', '南宁', '海口']

const SKILL_POOL = [
  'JavaScript', 'TypeScript', 'React', 'Vue', 'Node.js', 'Java', 'Python', 'Go', 'C++', 'C#', 'PHP', 'Swift', 'Kotlin',
  'HTML', 'CSS', 'SQL', 'MySQL', 'Redis', 'MongoDB', '小程序', '微前端', '微服务', 'Docker', 'Kubernetes',
  '数据分析', 'Excel', 'PPT', 'Photoshop', 'Figma', '视频剪辑', '新媒体运营', '文案策划', '项目管理', '供应链', '财务', '会计', '法务', '销售', '客服',
]

const RESERVED_LINES = new Set(['个人简介', '个人总结', '自我介绍', '自我评价', '工作经历', '工作经验', '实习经历', '项目经历', '项目经验', '教育背景', '教育经历', '专业技能', '掌握技能', '荣誉奖项', '荣誉奖励', '获奖情况', '证书荣誉', '求职意向', '基本信息', '联系方式', '个人技能', '兴趣爱好', '主修课程', '语言能力'])

// 按「分区标题」抽取某段内容：从命中标签的标题行之后开始，直到遇到下一个区块标题为止
function pickSection(lines, labelRe) {
  const start = lines.findIndex((l) => labelRe.test(l) && l.length <= 30)
  if (start < 0) return []
  const HEADER_RE = /^(教育|学历|校园|学习经历|毕业院校|专业技能|技术能力|技能|专长|技术栈|荣誉|奖项|证书|获奖|工作经历|工作经验|实习经历|工作背景|项目经历|项目经验|自我评价|个人简介|自我介绍|个人总结|关于我|求职意向|意向岗位|应聘岗位|目标岗位|期望职位|期望岗位|联系方式|基本信息|语言能力|兴趣爱好|主修课程|掌握)/
  const out = []
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i]
    if (HEADER_RE.test(l) && l.length <= 30) break
    out.push(l)
  }
  return out
}

// 从文本中抽取表单字段（尽力而为，缺失留空）
function parseResumeText(text) {
  const src = String(text || '').replace(/\r\n?/g, '\n')
  const lines = src.split('\n').map((s) => s.trim()).filter(Boolean)

  const basics = { name: '', title: '', phone: '', email: '', city: '', website: '', avatar: '' }

  // 电话
  const phoneLine = lines.find((l) => /(电话|手机|联系方式|电话号|tel|phone|mobile)/i.test(l)) || ''
  const phoneMatch = (phoneLine + '\n' + src).match(/1[3-9]\d[\s-]?\d{4}[\s-]?\d{4}/)
  if (phoneMatch) basics.phone = phoneMatch[0].replace(/[\s-]/g, '').slice(0, 11)

  // 邮箱
  const emailMatch = src.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)
  if (emailMatch) basics.email = emailMatch[0]

  // 姓名：标签优先；否则取首个符合「2-4 个汉字」且非标题的短行
  const nameLabel = lines.find((l) => /^(姓名|名字|Name)\s*[:：]?\s*\S/.test(l))
  if (nameLabel) basics.name = nameLabel.replace(/^(姓名|名字|Name)\s*[:：]?\s*/, '').replace(/[\s（）()].*$/, '').trim().slice(0, 8)
  if (!basics.name) basics.name = lines.find((l) => /^[\u4e00-\u9fa5]{2,4}$/.test(l) && !RESERVED_LINES.has(l)) || ''

  // 求职意向 / 岗位
  const titleLabel = lines.find((l) => /(求职意向|意向岗位|应聘岗位|目标岗位|期望职位|期望岗位|职位|岗位)\s*[:：]?\s*\S/.test(l))
  if (titleLabel) basics.title = titleLabel.replace(/^(求职意向|意向岗位|应聘岗位|目标岗位|期望职位|期望岗位|职位|岗位)\s*[:：]?\s*/, '').split(/[（(]/)[0].trim().slice(0, 24)

  // 城市
  const cityLabel = lines.find((l) => /(城市|所在地|现居|居住地|地址|地点)\s*[:：]?\s*\S/.test(l)) || ''
  const cityMatch = (cityLabel + ' ' + lines.slice(0, 6).join(' ')).match(new RegExp(CITY_POOL.join('|')))
  if (cityMatch) basics.city = cityMatch[0]

  // 网站
  const webMatch = src.match(/https?:\/\/[^\s，,；;]+/)
  if (webMatch) basics.website = webMatch[0]

  // 教育
  const education = pickSection(lines, /教育|学历|校园|学习经历|毕业院校/).map((l) => {
    const years = l.match(/((?:19|20)\d{2}(?:[.\-/年月]\d{1,2})?)\s*[-~—至到]\s*(((?:19|20)\d{2})(?:[.\-/年月]\d{1,2})?|至今|今)/)
    return {
      school: (l.match(/[\u4e00-\u9fa5]{2,}(?:大学|学院|学校|研究院)/) || [])[0] || '',
      degree: (l.match(/(博士|硕士|研究生|本科|学士|大专|专科|高中|中专)/) || [])[0] || '',
      major: (l.match(/(?:专业|主修)\s*[:：]?\s*([^\s，,|/]+)/) || [])[1] || '',
      start: (l.match(/((?:19|20)\d{2})/) || [])[1] || '',
      end: years ? (years[2] === '今' ? '至今' : years[2]) : '',
    }
  }).filter((e) => e.school || e.degree || e.major)

  // 技能
  let skills = []
  pickSection(lines, /技能|专长|技术栈/).forEach((l) => {
    l.split(/[，,、|;；/]+/).forEach((s) => {
      s = s.replace(/^[•·\-*\d.\s、]+/, '').trim()
      if (s.length > 1 && s.length < 40) skills.push(s)
    })
  })
  if (!skills.length) skills = SKILL_POOL.filter((k) => src.toLowerCase().includes(k.toLowerCase()))
  skills = [...new Set(skills)].slice(0, 10)

  // 荣誉
  const honors = pickSection(lines, /荣誉|奖项|证书|获奖/).map((l) => l.replace(/^[•·\-*\d.\s、]+/, '').trim()).filter((s) => s.length > 1 && s.length < 60).slice(0, 8)

  // 个人简介
  const summary = (pickSection(lines, /自我评价|个人简介|自我介绍|个人总结|关于我/)[0] || '').slice(0, 300)

  // 工作经历
  const experience = pickSection(lines, /工作经历|工作经验|实习经历|工作背景/).map((l) => {
    const years = l.match(/((?:19|20)\d{2}(?:[.\-/年月]\d{1,2})?)\s*[-~—至到]\s*(((?:19|20)\d{2})(?:[.\-/年月]\d{1,2})?|至今|今)/)
    return {
      company: (l.match(/([\u4e00-\u9fa5A-Za-z0-9]{2,}(?:公司|集团|科技|网络|银行|医院|学校|研究院|厂|所))/))?.[1] || '',
      role: (l.match(/(工程师|经理|主管|专员|顾问|设计师|运营|产品|开发|分析师|负责人|总监|架构师|实习生|教师|医生|护士)/))?.[1] || '',
      start: (l.match(/((?:19|20)\d{2})/) || [])[1] || '',
      end: years ? (years[2] === '今' ? '至今' : years[2]) : '',
      city: '',
      bullets: '',
    }
  }).filter((e) => e.company || e.role)

  // 项目
  const projects = pickSection(lines, /项目经历|项目经验/).map((l) => ({
    name: l.replace(/^[•·\-*\d.\s、]+/, '').slice(0, 50),
    role: '', tech: '', start: '', end: '', description: '',
  })).filter((p) => p.name).slice(0, 5)

  return {
    basics: { ...basics, name: basics.name || '未识别姓名' },
    summary,
    experience,
    education,
    projects,
    skills,
    honors,
  }
}

export async function mockChat({ system, prompt, kind = 'general', json = false } = {}) {
  const basics = guessBasics(prompt)

  switch (kind) {
    // 从零生成完整简历
    case 'generate': {
      const resume = buildResume(basics)
      return json ? resume : JSON.stringify(resume)
    }

    // 生成某段经历的 bullet 要点
    case 'experience': {
      const role = basics.role || '开发工程师'
      const bullets = [
        `负责${basics.industry || '业务'}核心功能的设计与实现，独立完成从需求拆解到上线的全流程，用户满意度显著提升`,
        `通过架构优化与性能治理，接口响应时间降低 35%，系统稳定性提升至 99.9%`,
        `抽象通用能力沉淀为内部组件/工具，帮助团队降低重复开发成本约 40%`,
        `跨团队推动项目落地，输出清晰的技术文档与复盘，保障交付质量`,
      ]
      const obj = { bullets }
      return json ? obj : bullets.map((b) => `• ${b}`).join('\n')
    }

    // 单区域分析
    case 'analyze': {
      const obj = {
        score: 82,
        strengths: [
          '内容结构清晰，要点突出，符合 STAR 法则',
          '量化结果充分，能直观体现个人贡献',
        ],
        weaknesses: [
          '部分描述偏通用，缺少与目标岗位的针对性',
          '动作动词可更加多样化，避免重复',
        ],
        suggestions: [
          '为每条经历补充"动作 + 结果 + 量化指标"的完整链条',
          '针对目标岗位 JD 中的关键词，调整描述用词以提升匹配度',
        ],
      }
      return json ? obj : JSON.stringify(obj)
    }

    // 单区域改写
    case 'rewrite': {
      const obj = {
        text: `负责${basics.industry || '业务'}核心模块的设计与研发，通过性能优化将关键路径耗时降低 35%，并推动组件化改造使团队交付效率提升 40%，保障业务高质量按期上线。`,
      }
      return json ? obj : obj.text
    }

    // 岗位适配 / 跨行转行：结合粘贴的 JD 生成一份对标 JD 的简历
    case 'match': {
      let parsed = {}
      try { parsed = JSON.parse(prompt) } catch { /* ignore */ }
      const jd = typeof parsed.jd === 'string' ? parsed.jd : ''
      const srcResume = parsed.resume || buildResume(basics)
      const jdInfo = extractJd(jd)
      const role = jdInfo.role || basics.role || '前端开发工程师'
      const score = 78
      const obj = {
        score,
        matchAnalysis: `你的简历与「${role}」岗位当前匹配度约 ${score}%，已通过可迁移能力映射完成跨行适配改写。`,
        keywords: jdInfo.keywords.length ? jdInfo.keywords.slice(0, 5) : ['可迁移能力', '跨团队协作', '问题拆解'],
        missing: jdInfo.keywords.length ? ['目标岗位年限要求', '目标行业项目经验'] : ['目标行业关键词', '岗位所需技能'],
        highLights: ['多年一线实战经验', '可迁移能力突出', '学习与适应能力强'],
        suggestions: [
          `将简历语言统一替换为「${role}」行业的通行术语`,
          '把原行业成果改写成目标岗位可类比的能力与结果',
          '在 summary / skills 中显式嵌入 JD 高频关键词',
        ],
        adaptedResume: buildAdaptedResume(jd, srcResume),
        adaptNote: `已将原「${srcResume?.basics?.title || basics.role || '行业'}」经历映射为可迁移能力，重写了个人总结与工作经历，并把技能对齐到「${role}」JD 关键词。`,
      }
      return json ? obj : JSON.stringify(obj)
    }

    // 模拟面试题库（含分类，便于前端分组展示）
    case 'questions': {
      const role = basics.role || '前端开发工程师'
      const categories = [
        {
          name: '自我介绍',
          icon: 'user',
          items: [
            `请做 1 分钟自我介绍，重点说明与「${role}」岗位最匹配的两段经历`,
            '用三个关键词概括你的核心竞争力，并各举一个例子',
          ],
        },
        {
          name: '项目深挖',
          icon: 'rocket',
          items: [
            '介绍一个你最有成就感的项目，遇到的最大技术难点是什么？如何解决？',
            '如果让你重新做一次上家公司最失败的项目，你会怎么改进？',
            '讲讲你在项目中做过的一个有争议的技术决策，最终结果如何？',
          ],
        },
        {
          name: '技术能力',
          icon: 'code',
          items: [
            `列举「${role}」岗位的三个核心技术栈，并谈谈你对其中一个的深入理解`,
            '你如何做性能优化 / 保障系统稳定性？举一个真实案例',
            '说说你最近在技术上踩过的一个坑，以及复盘后的沉淀',
          ],
        },
        {
          name: '行为面试',
          icon: 'chat',
          items: [
            '你如何平衡业务需求与技术债务？举例说明',
            '讲一次你与同事意见严重分歧、最终如何推进的经历',
            '为什么选择我们公司 / 这个岗位？未来 3 年的职业规划是什么？',
          ],
        },
        {
          name: '反问环节',
          icon: 'help',
          items: [
            '关于团队构成、技术方向、培养体系，你最想了解哪三个方面？',
          ],
        },
      ]
      const questions = categories.flatMap((c) => c.items)
      return json ? { questions, categories } : questions.map((q, i) => `${i + 1}. ${q}`).join('\n')
    }

    // 面试复盘
    case 'review': {
      const obj = {
        score: 75,
        summary: '整体表现中等偏上，技术知识结构较完整，但在项目深挖与表达逻辑上仍有提升空间。',
        strengths: ['基础扎实，关键技术点回答到位', '项目经历真实，有量化成果'],
        improvements: [
          '对项目细节的准备不足，被追问时表达不够深入',
          '部分问题回答偏啰嗦，缺少结构化（结论先行）',
          '对岗位所需的领域知识（如微前端/性能优化）准备不充分',
        ],
        suggestions: [
          '用 STAR 法则重新梳理每个项目的"背景-动作-结果"',
          '针对目标岗位 JD，提前准备高频技术问题的标准答案',
          '多做 mock interview，练习 1 分钟精炼表达',
        ],
      }
      return json ? obj : JSON.stringify(obj)
    }

    // 通用对话 / 语音文本总结
    case 'transcribe': {
      return '（演示模式）Q：请介绍一下你在组件化改造中遇到的最大挑战以及如何解决的？\nA：最大的挑战是存量页面迁移成本高、改动风险大……（此处为模拟转写文本，接入真实 ASR 后将返回实际语音内容）'
    }

    // 简历智能体检：整体评分 + 分维度 + 改进清单
    case 'score': {
      const role = basics.role || '前端开发工程师'
      const obj = {
        overall: 73,
        summary: `你的简历整体完成度良好，但「量化表达」与「ATS 关键词」两个维度偏弱——这会直接影响大厂初筛与 HR 快速抓取关键信息。`,
        dimensions: [
          { key: 'completeness', name: '内容完整度', score: 78, tip: '基本信息、经历、教育、技能齐全' },
          { key: 'quantification', name: '量化表达', score: 62, tip: '缺少可量化的业务结果（数字 / 百分比）' },
          { key: 'keywords', name: '关键词匹配', score: 68, tip: '未覆盖目标岗位的高频技能词' },
          { key: 'readability', name: '可读性', score: 84, tip: '结构清晰、要点分明，排版友好' },
          { key: 'ats', name: 'ATS 友好度', score: 70, tip: '存在个别复杂排版可能影响机器解析' },
        ],
        strengths: ['基础信息与经历结构完整', '项目描述具备 STAR 雏形', '技能板块分类清晰'],
        atsKeywords: ['TypeScript', '性能优化', 'React', '工程化', 'Node.js'],
        improvements: [
          {
            id: 'sum-1',
            section: 'summary',
            title: '个人总结缺乏针对性',
            issue: '总结偏通用，没有突出与目标岗位最匹配的 2~3 个能力标签。',
            suggestion: '改为「年限 + 核心方向 + 2 个关键成果 + 求职目标」的结构。',
            target: { type: 'summary' },
          },
          {
            id: 'exp-0',
            section: 'experience',
            title: '首段经历量化不足',
            issue: '工作内容缺少数字，说服力偏弱。',
            suggestion: '为第 1 段经历补充可量化的结果（如性能提升 X%、覆盖用户 Y）。',
            target: { type: 'experience', index: 0 },
          },
          {
            id: 'proj-0',
            section: 'projects',
            title: '项目描述缺少成果',
            issue: '项目仅描述职责，未说明最终影响。',
            suggestion: '补充项目上线后的业务 / 技术成果。',
            target: { type: 'projects', index: 0 },
          },
        ],
      }
      return json ? obj : JSON.stringify(obj)
    }

    // 一键优化：针对某个片段返回改写后的文本（前端可直接回填）
    case 'optimize': {
      let parsed = {}
      try { parsed = JSON.parse(prompt) } catch { /* ignore */ }
      const target = parsed.target || {}
      const role = basics.role || '前端开发工程师'
      let text = ''
      if (target.type === 'experience') {
        text = [
          `负责核心业务模块的设计与研发，覆盖日均百万级请求，通过性能优化将关键路径耗时降低 40%`,
          '主导组件化改造与工程化建设，团队交付效率提升 50%，代码复用率提高 60%',
          '跨团队推进重点项目落地，按期高质量交付，获季度之星',
        ].join('\n')
      } else if (target.type === 'projects') {
        text = `从 0 到 1 参与核心系统建设，覆盖需求评审、架构设计、开发上线全流程；上线后核心指标提升 30%，并为团队沉淀可复用的组件与文档，交付周期缩短 50%。`
      } else {
        text = `${basics.years || '3 年'}${role}经验，深耕${basics.industry || '互联网'}方向，在性能优化、工程化与跨团队协作上有扎实积累；多次主导从 0 到 1 的核心项目，累计带来 40% 以上的效率提升，期待在更大舞台持续创造价值。`
      }
      return json ? { text } : text
    }

    // AI 模拟面试对话：面试官逐题追问 + 即时反馈
    case 'interview': {
      let parsed = {}
      try { parsed = JSON.parse(prompt) } catch { /* ignore */ }
      const role = parsed.role || '前端开发工程师'
      const messages = Array.isArray(parsed.messages) ? parsed.messages : []
      const userCount = messages.filter((m) => m.role === 'user').length
      const Q = [
        `你好，我是本场模拟面试官。请先做一个 1 分钟自我介绍，重点说明与「${role}」最匹配的两段经历。`,
        '不错。请讲一个你最有成就感的项目：背景、你的角色、遇到的最大技术难点，以及你是如何解决的？',
        `接下来考察技术能力：针对「${role}」岗位，请谈一谈你最熟悉的 2 个核心技术点及其典型应用场景。`,
        '那换一个角度：讲一次你和同事在技术方案上意见严重分歧的经历，你当时是怎么处理的？',
        '最后，关于我们团队、业务方向或培养体系，你有什么想了解的？',
      ]
      const lastUser = [...messages].reverse().find((m) => m.role === 'user')
      const nextIdx = Math.min(userCount, Q.length - 1)
      const done = userCount >= Q.length
      const feedback = lastUser
        ? `点评：回答要点清晰、结构完整，但缺少可量化的业务结果。建议用 STAR 法则精简表达，并补充具体数字增强说服力。`
        : ''
      const score = lastUser ? Math.min(95, 70 + ((userCount * 7) % 22)) : null
      return {
        reply: done
          ? '本次模拟面试到此结束。整体来看，你的技术基础扎实、表达能力良好，建议在「量化结果」和「结构化表达」上继续打磨。感谢参与，祝你面试顺利！'
          : Q[nextIdx],
        feedback,
        score,
        round: Math.min(userCount + 1, Q.length),
        total: Q.length,
        done,
      }
    }

    // 求职信 / 自荐信
    case 'coverletter': {
      let parsed = {}
      try { parsed = JSON.parse(prompt) } catch { /* ignore */ }
      const rb = parsed.resume?.basics || {}
      const role = rb.title || basics.role || '前端开发工程师'
      const name = rb.name || basics.name || '示例用户'
      const company = parsed.company || '贵公司'
      const position = parsed.position || rb.title || '前端开发工程师'
      const highlights = typeof parsed.highlights === 'string' && parsed.highlights.trim()
      const ability = highlights
        ? `在「${highlights}」等方面积累了扎实经验，累计带来 40% 以上的效率提升。`
        : '在性能优化、工程化建设与跨团队协作方面积累了扎实经验，累计带来 40% 以上的效率提升。'
      const text = [
        '尊敬的招聘负责人：',
        '',
        `您好！我是${name}，一名拥有${basics.years || '3 年'}经验的${role}。看到「${company}」正在招聘「${position}」，我非常期待有机会加入贵团队。`,
        '',
        `在过往经历中，我主导过多个从 0 到 1 的核心项目，${ability}我始终相信技术应当服务于业务与用户体验，并乐于将复杂问题转化为高质量、可落地的方案。`,
        '',
        `「${company}」在业界的口碑与业务方向深深吸引着我，我相信自己的经验与热情能够为团队创造价值。期待与您进一步沟通，感谢您的宝贵时间！`,
        '',
        '此致',
        '敬礼',
        '',
        name,
      ].join('\n')
      return json ? { text } : text
    }

    // 中英双语互译：返回与输入同结构、翻译后的简历
    case 'translate': {
      let parsed = {}
      try { parsed = JSON.parse(prompt) } catch { /* ignore */ }
      const makeEn = (cv) => ({
        basics: {
          name: cv.basics?.name || 'Your Name',
          title: cv.basics?.title || 'Frontend Engineer',
          phone: cv.basics?.phone || '',
          email: cv.basics?.email || '',
          city: cv.basics?.city || '',
          website: cv.basics?.website || '',
          avatar: cv.basics?.avatar || '',
        },
        summary: 'Frontend engineer with rich experience in building scalable web platforms, focusing on performance optimization, engineering efficiency and cross-team collaboration, with a strong record of delivering quantitative business results.',
        experience: (cv.experience || []).map((e) => ({
          company: e.company, role: e.role, start: e.start, end: e.end, city: e.city,
          bullets: typeof e.bullets === 'string'
            ? e.bullets.split('\n').map((l) => (l.includes('40%') ? 'Improved first-screen load time by 40% through performance optimization' : l.includes('50%') ? 'Built a reusable component library, boosting team delivery efficiency by 50%' : l)).join('\n')
            : (e.bullets || []).join('\n'),
        })),
        education: (cv.education || []).map((e) => ({ ...e, degree: e.degree === '本科' ? 'Bachelor' : e.degree === '硕士' ? 'Master' : e.degree })),
        projects: (cv.projects || []).map((p) => ({ ...p, description: (p.description || 'Built the system from scratch, covering the full delivery cycle and improving key metrics by 30%.') })),
        skills: (cv.skills || []).map((s) => s),
        honors: (cv.honors || []).map((s) => s),
      })
      // 演示模式统一返回英文译文（真实模型将按 target 中英双向翻译）
      const result = makeEn(parsed.resume || {})
      return json ? result : JSON.stringify(result)
    }

    // 简历查重：模板化套话检测 + 原创度评分
    case 'duplicate': {
      const obj = {
        originality: 81,
        summary: '简历原创度整体较高，但仍有几处常见的模板化套话，建议替换为更具个人辨识度的表达。',
        flags: [
          { text: '具备扎实的工程基础与良好的跨团队协作能力', suggestion: '改为具体能力描述，如“主导 3 个跨团队项目，协调 10+ 人协作落地”' },
          { text: '将业务需求转化为高质量技术方案', suggestion: '补充量化结果，如“方案落地后交付周期缩短 40%”' },
          { text: '关注性能与用户体验', suggestion: '给出可验证数据，如“首屏耗时降低 35%”' },
        ],
      }
      return json ? obj : JSON.stringify(obj)
    }

    // 旧简历解析导入：无大模型时用启发式规则从真实文本中抽取字段
    case 'parse-resume': {
      let parsed = {}
      try { parsed = JSON.parse(prompt) } catch { /* ignore */ }
      const text = typeof parsed.text === 'string' ? parsed.text : String(prompt || '')
      const obj = parseResumeText(text)
      return json ? obj : JSON.stringify(obj)
    }

    default: {
      if (json) {
        return { message: '（演示模式）此能力返回结构化示例数据，接入真实大模型后可获得个性化结果。' }
      }
      return '（演示模式）这是一段示例回复。配置 AI_API_KEY 后将调用真实大模型，返回针对你输入内容的个性化结果。'
    }
  }
}