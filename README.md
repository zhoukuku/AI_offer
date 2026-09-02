# AI 简历工作台 · Resume Workspace

> 一个面向求职者的 AI 简历工作台：在线写简历 → AI 生成 / 优化 / 体检 / 查重 / 中英翻译 / 岗位适配 / 模拟面试 → 一键生成加密投递链接（带阅读追踪）→ 浏览器插件自动填充网申表单。
>
> 用 **vibe coding** 从 0 到 1 完成的全栈作品，无需任何配置即可跑通全部 AI 能力（默认 mock 演示模式）。

---

## ✨ 功能一览

### 简历编辑
- **可视化编辑器**：左侧表单、右侧实时预览，支持多套模板与主题色
- **多版本快照**：同一人针对不同岗位定制多版本内容，互不干扰
- **导入**：支持 PDF / Word 简历解析导入

### AI 能力（16 个端点，覆盖简历全生命周期）
| 能力 | 说明 |
| --- | --- |
| 生成 / 优化 | 一句话生成简历，或基于原文润色提升 |
| 体检 (analyze) | 给简历打分、指出短板 |
| 查重 (duplicate) | 检测简历与 JD 的重复度与匹配盲区 |
| 岗位适配 (match) | 简历 × 目标岗位契合度分析 |
| 中英翻译 (translate) | 中英双语简历互译 |
| 模拟面试 (interview) | 针对简历生成面试题并陪练 |
| 面试复盘 (review) | 上传逐字稿 / 录音，生成复盘报告 |
| 求职信 (coverletter) | 一键生成个性化求职信 |
| 经历扩写 (experience / rewrite) | 把零散经历扩写成专业表述 |
| OCR | 上传 JD 截图直接解析为文本 |
| 语音转写 (transcribe) | 面试录音 → 逐字稿 |
| 智能问答 (chat) | 简历相关的自由问答 |

### 求职闭环
- **投递管理**：记录公司 / 岗位 / 渠道 / 状态 / 截止 / 跟进，进度一目了然
- **面试复盘**：沉淀每次面试的问答与反思
- **加密投递链接**：生成不可猜测的私密链接发给 HR，支持**阅读追踪**与**随时撤销**
- **大厂信息源**：内置 200+ 公司数据，辅助目标选择

### 账号与商业化
- **登录**：手机号 + 短信验证码（mock 可回显） / 账号密码
- **会员体系**：免费档限量 + 会员解锁全部高级 AI 能力（付费墙已实现）
- **管理员后台**：用户管理 + 全局统计看板

### 浏览器插件（网申助手）
- 一键把简历**填充**到当前网申页面表单
- 把当前页面**记录**为一次投递
- 打开工作台做**面试复盘**
- 后端 / 工作台地址可在插件内**配置**

---

## 🧱 技术架构

```
┌─────────────┐     ┌──────────────────────┐     ┌────────────────┐
│   Web (React)│────▶│  Server (Express)     │────▶│  AI Provider    │
│  Vite + RR   │     │  认证/会员/简历/分享   │     │ mock│DeepSeek│…  │
└─────────────┘     │  OCR/ASR/支付/短信    │     └────────────────┘
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │  SQLite (better-sqlite3)│
                    └──────────────────────┘
       浏览器插件(MV3) ──HTTP──▶ Server API
```

| 层 | 技术 |
| --- | --- |
| 前端 | React 18 + Vite + react-router |
| 后端 | Node.js + Express |
| 数据存储 | **SQLite**（better-sqlite3，支持多用户并发、原子事务） |
| AI | OpenAI 兼容接口抽象，默认 mock，可接 DeepSeek / 豆包 / OpenAI / Ollama |
| 插件 | Chrome Manifest V3（content script + service worker） |

---

## 🚀 快速开始

### 环境要求
- Node.js ≥ 18（推荐 20+）
- 无需数据库、无需 API Key 即可体验全部功能

### 安装与启动
```bash
# 1. 安装依赖（根目录 workspaces 同时装 server / web）
npm install

# 2. 一键启动前后端（concurrently）
npm run dev
```
启动后：
- 前端： http://localhost:5173
- 后端 API： http://localhost:8787 （前端已通过 Vite 代理 `/api` 自动转发，无需手动配置）

### 演示管理员账号
启动后自动创建：`admin / admin123`
> 短信验证码默认 mock 模式，注册时验证码会**直接随接口返回**，本地即可完整体验注册 → 使用闭环。

### 生产构建
```bash
npm run build     # 构建前端到 web/dist
npm run start     # 以生产模式启动（后端托管前端静态产物）
```
生产模式下访问 `http://localhost:8787` 即可（前端构建产物由后端直接托管）。

---

## ⚙️ 配置（.env）

复制 `server/.env.example` 为 `server/.env` 按需修改。关键开关：

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `AI_API_KEY` | 空 | 留空 = mock 模式；填入即接真实大模型 |
| `AI_BASE_URL` / `AI_MODEL` | DeepSeek | OpenAI 兼容接口地址与模型 |
| `DB_TYPE` | `sqlite` | 数据存储：`sqlite`（默认） |
| `SMS_PROVIDER` | `mock` | `mock`=验证码回显；`aliyun`/`tencent`=真实短信（需配密钥） |
| `PAYMENT_PROVIDER` | `mock` | `mock`=模拟开通会员；`stripe`/`wechat`=真实支付（需实现） |
| `OCR_PROVIDER` | `mock` | `mock`=内置示例解析；`tencent`/`baidu`=真实 OCR |
| `ASR_PROVIDER` | `mock` | `mock`=示例逐字稿；`whisper`/`funasr`=真实转写 |
| `AUTH_SECRET` | 空 | 生产环境务必设置，否则重启后旧登录态失效 |
| `ADMIN_PHONES` | 空 | 管理员手机号；留空时首个注册用户自动成为管理员 |

---

## 🔌 真实服务接入说明（评委自查要点）

本项目所有外部依赖都做了**可插拔抽象**，默认走 mock 演示实现，评委无需任何账号即可体验全流程：

| 能力 | mock 行为 | 接真实服务的入口 |
| --- | --- | --- |
| 大模型 | 返回结构化示例文本 | `server/src/ai/` 已封装 provider，填 `AI_API_KEY` 即切换 |
| 短信 | 验证码随接口返回 | `server/src/integrations/sms.js`（实现 `sendAliyun` 等） |
| 支付 | 模拟开通会员 | `server/src/integrations/payment.js`（实现 `checkoutStripe` 等） |
| OCR | 内置示例 JD 文本 | `server/src/integrations/ocr.js`（实现 `ocrTencent` 等） |
| ASR | 示例逐字稿 | `server/src/integrations/asr.js`（实现 `transcribeWhisper` 等） |

把对应 `PROVIDER` 环境变量从 `mock` 改为目标服务商，并填好密钥，再补全 `integrations/` 下标注 `TODO` 的函数即可。**未接入时不影响任何演示流程。**

---

## 🧩 浏览器插件使用

1. 打开 Chrome `chrome://extensions`，开启「开发者模式」
2. 点击「加载已解压的扩展程序」，选择本仓库 `extension/` 目录
3. 点击插件图标 → 「⚙️ 连接设置」填入后端地址（默认 `http://localhost:8787`）
4. 在网申页面点击「🪄 填充当前页面表单」即可自动填充

---

## 📁 目录结构

```
resume-workspace/
├── server/                 # Express 后端
│   ├── src/
│   │   ├── index.js        # 路由与接口编排
│   │   ├── auth.js         # 鉴权 / token / 短信验证码
│   │   ├── config.js       # 统一配置（读 .env）
│   │   ├── plan.js         # 会员 / 配额
│   │   ├── store/db.js     # 数据存储层（SQLite）
│   │   ├── ai/             # AI provider 抽象（mock / OpenAI 兼容）
│   │   ├── integrations/   # 短信/支付/OCR/ASR 可插拔实现
│   │   └── data/           # 大厂信息源等静态数据
│   └── .env.example
├── web/                    # React 前端（Vite）
├── extension/              # Chrome 插件（MV3）
└── package.json            # workspaces 根
```

---

## 🏆 作品亮点（参赛叙事）

- **一个非科班也能做出的全栈产品**：从需求到部署全部由 vibe coding 完成，契合「被普通人的 AI 创造力打动」。
- **真正的产品闭环**：写简历 → AI 增强 → 投递 → 复盘 → 插件填充网申，不是玩具 demo。
- **开箱即用的演示体验**：默认 mock 模式，评委零配置即可体验全部 16 个 AI 能力。
- **工程素养在线**：付费墙、配额、数据隔离、权限、分享阅读追踪、原子写入、统一错误处理一应俱全。
- **可插拔架构**：外部依赖（AI / 短信 / 支付 / OCR / ASR）全部抽象为 provider，真实接入只需补 `TODO` 函数。
