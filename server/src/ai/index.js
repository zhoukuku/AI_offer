import config from '../config.js'
import { openaiChat } from './providers/openai.js'
import { mockChat } from './providers/mock.js'

// 是否运行在 mock 演示模式（未配置 API Key）
export const isMock = !config.ai.apiKey

/**
 * 统一的大模型调用入口。
 * @param {object} opts
 * @param {string} opts.system   系统提示词
 * @param {string} opts.prompt   用户输入
 * @param {string} opts.kind     任务类型标记（供 mock 生成对应内容，真实模型忽略）
 * @param {boolean} opts.json    是否要求返回 JSON（真实模型会提示输出 JSON，mock 返回对象）
 * @returns {Promise<string|object>}
 */
export async function chat({ system, prompt, kind = 'general', json = false } = {}) {
  if (isMock) {
    return mockChat({ system, prompt, kind, json })
  }
  return openaiChat({ system, prompt, json, model: config.ai.model })
}