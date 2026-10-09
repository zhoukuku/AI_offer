// 范文库：跨行业高质量简历示例（参考超级简历的"范例"思路）
// 每份示例都是一份可直接克隆的完整 resume 对象，结构同编辑器：
//   basics / summary / experience(bullets 为字符串，\n 分隔) / education / projects / skills(数组) / honors(数组)
// 另含展示用元信息：industry（行业）、tags（标签）、template / accent（推荐模板与主题色）

export const EXAMPLE_INDUSTRIES = ['全部', '互联网', '人工智能', '产品', '市场运营', '财务']

export const EXAMPLES = [
  {
    id: 'ex-fe',
    title: '高级前端开发工程师',
    industry: '互联网',
    tags: ['React', '性能优化', '3 年+'],
    template: 'modern',
    accent: '#4f46e5',
    resume: {
      basics: { name: '陈一鸣', title: '高级前端开发工程师', phone: '138-0011-2233', email: 'chenym@example.com', city: '深圳', website: 'github.com/chenym' },
      summary: '5 年前端开发经验，专注于中大型 Web 应用的架构设计与性能优化。主导过日均千万级请求的核心业务重构，擅长 React 技术栈、工程化体系建设与跨团队协作，累计带来 40%+ 的交付效率提升。',
      experience: [
        {
          company: '深圳某头部电商科技有限公司', role: '高级前端工程师', start: '2022-03', end: '至今', city: '深圳',
          bullets: '负责核心交易链路前端的架构设计与性能治理，首屏加载时间从 3.2s 降至 1.1s，转化率提升 12%\n主导组件库与工程化体系建设，推动 30+ 业务线复用，团队交付效率提升 45%\n搭建前端监控与自动化测试体系，线上故障率下降 68%，获年度技术之星',
        },
        {
          company: '广州某互联网公司', role: '前端开发工程师', start: '2019-07', end: '2022-02', city: '广州',
          bullets: '从 0 到 1 参与低代码搭建平台研发，支撑内部 12 条业务线快速搭建运营页，交付周期缩短 50%\n负责可视化拖拽引擎核心模块，复杂页面搭建耗时从 2 天降至 2 小时',
        },
      ],
      education: [
        { school: '华南理工大学', degree: '本科', major: '软件工程', start: '2015', end: '2019' },
      ],
      projects: [
        { name: '企业级低代码平台', role: '核心开发', tech: 'React / TypeScript / Node.js', start: '2020-03', end: '2021-12', description: '搭建可视化拖拽搭建系统，支撑多业务线运营页快速产出，平均交付周期缩短 50%。' },
      ],
      skills: ['JavaScript / TypeScript', 'React / Vue', 'Node.js', 'Webpack / Vite', '性能优化', '工程化', '微前端'],
      honors: ['公司年度技术之星', '前端编程竞赛一等奖'],
    },
  },

  {
    id: 'ex-agent',
    title: 'Agent 算法工程师',
    industry: '人工智能',
    tags: ['LLM', 'Agent', 'Python'],
    template: 'timeline',
    accent: '#8b5cf6',
    resume: {
      basics: { name: '林知遥', title: 'Agent 算法工程师', phone: '139-2244-6677', email: 'linzy@example.com', city: '北京', website: '' },
      summary: '4 年算法研发经验，专注大语言模型应用与智能体（Agent）系统设计。主导过多轮对话、工具调用与规划推理链路的落地，擅长把复杂业务抽象为可编排的 Agent 工作流，相关系统服务日均调用超百万次。',
      experience: [
        {
          company: '北京某 AI 科技公司', role: 'Agent 算法工程师', start: '2023-04', end: '至今', city: '北京',
          bullets: '设计并实现多 Agent 协作框架，支撑客服/营销场景自动化，人工介入率下降 55%\n构建工具调用与规划（Planning）模块，任务一次成功率从 62% 提升至 89%\n搭建评测与回归体系，Agent 输出稳定性显著提升， badcase 下降 47%',
        },
        {
          company: '上海某大模型创业公司', role: '算法工程师', start: '2021-06', end: '2023-03', city: '上海',
          bullets: '参与 LLM 微调与 RAG 检索链路建设，问答准确率提升 23 个百分点\n负责 Prompt 工程与few-shot 样本筛选，核心场景效果达到人工水平',
        },
      ],
      education: [
        { school: '上海交通大学', degree: '硕士', major: '计算机科学与技术', start: '2018', end: '2021' },
      ],
      projects: [
        { name: '智能体编排平台', role: '算法负责人', tech: 'Python / LangGraph / LlamaIndex', start: '2023-06', end: '2024-02', description: '面向业务人员的 Agent 编排平台，支持可视化流程编排与工具接入，已服务 8 个内部团队。' },
      ],
      skills: ['Python', 'LangGraph', 'LlamaIndex', 'LLM 微调', 'RAG', 'Prompt 工程', 'Agent 设计'],
      honors: ['顶会论文 1 篇', '公司技术创新奖'],
    },
  },

  {
    id: 'ex-pm',
    title: 'B 端产品经理',
    industry: '产品',
    tags: ['B端', '0-1', '数据驱动'],
    template: 'elegant',
    accent: '#2563eb',
    resume: {
      basics: { name: '苏晚晴', title: '高级产品经理（B 端）', phone: '137-5566-8899', email: 'suwq@example.com', city: '杭州', website: '' },
      summary: '6 年 B 端产品经验，擅长从 0 到 1 搭建企业级 SaaS 产品与数据驱动的需求管理。主导过营收过亿的 CRM 产品线，善于在复杂业务场景中平衡用户价值与商业目标。',
      experience: [
        {
          company: '杭州某 SaaS 企业', role: '高级产品经理', start: '2021-09', end: '至今', city: '杭州',
          bullets: '负责 CRM 核心模块从 0 到 1，上线一年付费客户超 1200 家，年营收破 8000 万\n建立需求优先级模型与数据看板，需求平均交付周期从 21 天缩短至 11 天\n推动跨部门（研发/销售/客户成功）协作机制，客户续费率提升至 92%',
        },
        {
          company: '南京某互联网公司', role: '产品经理', start: '2018-07', end: '2021-08', city: '南京',
          bullets: '负责后台管理系统重构，操作效率提升 40%，用户投诉下降 60%\n通过用户访谈与漏斗分析识别 3 个关键流失点并落地优化，转化率提升 18%',
        },
      ],
      education: [
        { school: '浙江大学', degree: '本科', major: '信息管理与信息系统', start: '2014', end: '2018' },
      ],
      projects: [
        { name: '企业 CRM 产品', role: '产品负责人', tech: 'Axure / SQL / Figma', start: '2021-10', end: '2022-12', description: '面向中小企的销售管理 SaaS，覆盖线索-商机-合同全流程，上线首年营收破 8000 万。' },
      ],
      skills: ['需求分析', '原型设计', '数据分析', 'SQL', '用户研究', '项目管理', 'Axure / Figma'],
      honors: ['公司年度最佳产品经理', '行业产品创新奖'],
    },
  },

  {
    id: 'ex-ops',
    title: '新媒体运营专家',
    industry: '市场运营',
    tags: ['内容运营', '涨粉', '直播'],
    template: 'bold',
    accent: '#e11d48',
    resume: {
      basics: { name: '夏小满', title: '新媒体运营专家', phone: '136-7788-0011', email: 'xiaxm@example.com', city: '成都', website: 'douyin.com/xiaxia' },
      summary: '5 年新媒体与内容运营经验，擅长短视频账号从 0 到 1 搭建与直播增长。操盘过多个百万级粉丝账号，精通选题策划、内容分发与私域转化全链路。',
      experience: [
        {
          company: '成都某文化传媒公司', role: '新媒体运营专家', start: '2022-02', end: '至今', city: '成都',
          bullets: '从 0 到 1 搭建品牌抖音账号，8 个月粉丝破 120 万，单条最高播放 2600 万\n策划并操盘 30+ 场直播，场均 GMV 提升 35%，私域沉淀用户超 15 万\n搭建内容数据看板与选题库，爆款率从 8% 提升至 22%',
        },
        {
          company: '武汉某电商公司', role: '内容运营', start: '2019-05', end: '2022-01', city: '武汉',
          bullets: '负责公众号与小红书矩阵运营，总粉丝从 5 万增长至 45 万\n通过图文+短视频组合打法，电商引流转化率提升 28%',
        },
      ],
      education: [
        { school: '武汉大学', degree: '本科', major: '传播学', start: '2015', end: '2019' },
      ],
      projects: [
        { name: '品牌抖音账号孵化', role: '项目负责人', tech: '剪映 / 飞瓜数据 / 巨量引擎', start: '2022-03', end: '2022-10', description: '3 人小团队操盘，8 个月粉丝破 120 万，建立可复用的选题-拍摄-投流 SOP。' },
      ],
      skills: ['短视频策划', '直播运营', '数据分析', '私域转化', '剪映', '飞瓜数据', '文案'],
      honors: ['平台年度优质创作者', '公司增长之星'],
    },
  },

  {
    id: 'ex-fin',
    title: '财务分析师',
    industry: '财务',
    tags: ['财务分析', 'FP&A', 'Excel'],
    template: 'classic',
    accent: '#059669',
    resume: {
      basics: { name: '周慕白', title: '财务分析师', phone: '135-9900-1122', email: 'zhoumb@example.com', city: '上海', website: '' },
      summary: '4 年财务分析与预算管理经验，擅长经营分析、成本管控与自动化报表。主导过事业部级预算编制与月度经营复盘，通过数据洞察推动多项成本优化落地。',
      experience: [
        {
          company: '上海某制造业集团', role: '财务分析师', start: '2022-04', end: '至今', city: '上海',
          bullets: '负责事业部月度经营分析，识别并推动 3 项成本优化，年化节约 680 万元\n搭建自动化财务看板，报表编制工时从 3 天降至 0.5 天，准确率 100%\n牵头年度预算编制，偏差率控制在 3% 以内，获财务总监嘉奖',
        },
        {
          company: '苏州某上市公司', role: '会计专员', start: '2020-07', end: '2022-03', city: '苏州',
          bullets: '负责费用审核与账务处理，月均处理凭证 800+ 笔，差错率为 0\n优化报销流程，平均审批周期从 5 天缩短至 2 天',
        },
      ],
      education: [
        { school: '上海财经大学', degree: '本科', major: '会计学', start: '2016', end: '2020' },
      ],
      projects: [
        { name: '经营分析看板建设', role: '项目负责人', tech: 'Excel / Power BI / SQL', start: '2022-06', end: '2022-12', description: '整合多系统财务数据，搭建自助式经营分析看板，支撑管理层实时决策。' },
      ],
      skills: ['财务分析', '预算管理', '成本管控', 'Excel 高级', 'Power BI', 'SQL', 'CPA（在考）'],
      honors: ['公司年度优秀员工', '财务技能竞赛二等奖'],
    },
  },
]
