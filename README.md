# AI Offer · AI 简历工作台

面向求职者的简历编辑与求职记录工具：导入真实简历 → 编辑与内容诊断 → 对照岗位 JD → 核实并保存适配版本 → PDF / 私密链接 → 投递记录 → 面试练习与复盘。

## 运行

需要 Node.js 22+、npm。首次安装：

```bash
npm ci
cp server/.env.example server/.env
npm run dev
```

前端 `http://localhost:5173`，API `http://localhost:8787`。开发模式代理 `/api`。配置文件始终读取 `server/.env`，与启动目录无关。

演示环境可使用 `admin / admin123`；普通注册需要先获取验证码，开发环境会明确回显验证码。固定万能验证码已移除。

```bash
npm run build
npm start
```

构建后，后端同时托管前端，访问 `http://localhost:8787` 即可。端口被占用时请修改 `PORT`，开发前端代理也需相应修改 `web/vite.config.js`。

## 能力与边界

| 功能 | 当前实现 |
| --- | --- |
| 编辑与预览 | 9 套模板、主题色、自动保存、浏览器草稿恢复 |
| 导入 | TXT / MD / 文本 PDF / DOCX；图片需要视觉接口，扫描 PDF 暂不支持 |
| 版本管理 | 手动快照；生成、优化、区域改写、岗位适配时备份原文 |
| 本地诊断 | 依据实际内容检查完整度、数字证据和段落长度；非招聘通过率预测 |
| 本地岗位匹配 | 词库关键词覆盖率；不自动补充未知技能或虚构经历 |
| 真实 AI | DeepSeek / OpenAI 兼容 Chat Completions，JSON 字段校验、超时和重试、多轮对话 |
| 翻译与语义优化 | 需要真实模型；未配置时不会返回虚构译文或成果 |
| OCR | OpenAI 兼容视觉接口；可复用 DeepSeek Flash 的密钥 |
| 转写 | 兼容 Whisper / FunASR 的 HTTP 服务，需要配置完整接口地址 |
| PDF | 点击「导出 PDF」打开浏览器打印，选择“保存为 PDF”，建议关闭页眉页脚 |
| 私密分享 | 128 位随机令牌、阅读次数与撤销；持链接者可访问，不是内容加密 |
| 投递与面试 | 关联简历、岗位 JD、状态、截止/跟进日期；投递可跳转并预填面试复盘 |
| 会员 | 演示开通可验证权益；真实支付与订单回调尚未接入 |
| 短信 | 演示验证码；真实短信供应商尚未接入 |

普通用户默认可保留 3 份简历、5 次成功 AI 请求；月度会员 29 元 / 30 天，包含 100 次 AI 调用，每天最多 20 次。额度按开通时间每 30 天重置，未用次数不累计；提前续费只延长有效期，不提前补充本期额度。管理员不受个人次数限制。失败请求退回次数，真实 AI 导入消耗一次额度；一次点击可能触发多次请求（例如一键优化），按实际成功请求计次。所有用户共用服务端 DeepSeek 密钥，浏览器不会收到密钥。配置项：FREE_AI_QUOTA、PRO_AI_QUOTA、AI_USER_DAILY_QUOTA；还有平台级 AI_DAILY_LIMIT 与任务输出长度上限。生产支付、订单与回调仍需接入后才能收费。

## DeepSeek 配置

在 `server/.env` 填入 `AI_API_KEY`，重启服务。默认使用 `deepseek-flash`、OpenAI 兼容接口和非思考模式；模型可以通过 `AI_MODEL` 修改。

- [官方模型与能力](https://api-docs.deepseek.com/quick_start/pricing/)
- [Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/)
- [JSON 输出](https://api-docs.deepseek.com/guides/json_mode/)
- [图片输入](https://api-docs.deepseek.com/guides/vision/)

填入密钥后，截图识别可复用同一密钥。语音转写仍需 `ASR_ENDPOINT` 等单独配置。`.env`、数据库、依赖目录与 QA 产物不提交到 GitHub。模型异常返回错误，保留原文，不用示例内容冒充成功。

## 浏览器网申助手

在 Chrome 扩展管理页开启开发者模式，加载 `extension/`。在插件设置 API 与工作台地址，用工作台账号登录，然后选择简历。

- 每次填充前拉取最新简历，不保存简历正文到插件存储。
- 仅点击填充时注入脚本，不在全部网页常驻。
- 跳过隐藏、密码、文件、只读及已有值字段；填充后请核实再提交。
- 表单匹配是通用规则，不保证覆盖 iframe、Shadow DOM、多段动态网申等页面。
- 插件 token 单独保存在本地扩展存储，修改 API 地址会清除插件登录。

## 验证

```bash
npm run build
npm test
```

测试使用临时数据库与服务端口，不写入个人业务数据库；模型、OCR、ASR 的协议测试使用本地测试服务器，不调用付费 API。浏览器测试默认使用已安装的 Google Chrome，可通过 `PLAYWRIGHT_CHANNEL` 切换已安装的浏览器通道。

覆盖：注册验证、导入与编辑、权限隔离、字段保护、并发配额、失败退款、模型结构校验、历史对话、OCR 与音频协议、分享撤销、投递面试关联、演示会员状态，以及浏览器操作和打印 PDF。

## 生产部署限制

设置 `NODE_ENV=production`、`DEMO_MODE=false` 和固定 `AUTH_SECRET`。生产不会创建演示管理员，管理员须通过 `ADMIN_PHONES` 明确指定。未接入真实短信前，生产环境无法完成手机号注册；可先在受控开发环境创建账号，再关闭演示模式。真实支付尚未实现，生产不可模拟开通。

SQLite 适合当前单机规模；模型每日计数目前在进程内，重启会重置。正式商业上线还需完成真实短信/支付、订单幂等与回调验签、数据库备份、监控和部署配置。

产品对标与本轮改进记录见 [docs/product-review.md](docs/product-review.md)。
