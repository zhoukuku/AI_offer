// 简历模板配置：每套模板由「结构特征(traits)」驱动，而非仅换色。
// traits 说明：
//   layout  版式骨架:  single(单栏) | double(主+右辅) | sidebar(全彩左侧栏) | timeline(时间线)
//   header  页眉样式:  left(左对齐) | center(居中) | banner(彩色横幅) | plate(深色铭牌) | split(姓名左/联系右)
//   title   节标题:    underline(下划线) | leftbar(左竖条) | pill(胶囊底色) | rule(大写+细分隔线) | plain(仅加粗)
//   skills  技能展示:  tags(胶囊标签) | inline(·分隔行内) | list(竖排圆点) | grid(两列网格)
//   item    条目样式:  standard(标题行+要点) | timeline(日期列+竖线圆点)
//   font    字体族:    sans | serif(衬线，金融/咨询风)
//   dense   信息密度:  true 时缩小行距/字号（双栏等高密度版式）
export const TEMPLATES = [
  {
    key: 'single', label: '经典单栏', desc: 'ATS 友好 · 通用投递首选',
    layout: 'single', header: 'left', title: 'underline', skills: 'tags', item: 'standard', font: 'sans',
  },
  {
    key: 'classic', label: '经典商务', desc: '衬线字体 · 金融/咨询/外企',
    layout: 'single', header: 'center', title: 'rule', skills: 'inline', item: 'standard', font: 'serif',
  },
  {
    key: 'double', label: '双栏分边', desc: '主辅分区 · 信息密度高',
    layout: 'double', header: 'left', title: 'leftbar', skills: 'list', item: 'standard', font: 'sans', dense: true,
  },
  {
    key: 'sidebar', label: '全彩侧栏', desc: '视觉名片 · 市场/设计/运营',
    layout: 'sidebar', header: 'left', title: 'underline', skills: 'list', item: 'standard', font: 'sans',
  },
  {
    key: 'modern', label: '现代横幅', desc: '彩色头版 · 互联网风格',
    layout: 'single', header: 'banner', title: 'leftbar', skills: 'tags', item: 'standard', font: 'sans',
  },
  {
    key: 'bold', label: '商务铭牌', desc: '深色铭牌 · 资深/管理层',
    layout: 'single', header: 'plate', title: 'underline', skills: 'grid', item: 'standard', font: 'sans',
  },
  {
    key: 'elegant', label: '优雅居中', desc: '对称留白 · 职能/文艺岗',
    layout: 'single', header: 'center', title: 'pill', skills: 'tags', item: 'standard', font: 'sans',
  },
  {
    key: 'minimal', label: '极简主义', desc: '去装饰 · 内容至上',
    layout: 'single', header: 'split', title: 'rule', skills: 'inline', item: 'standard', font: 'sans',
  },
  {
    key: 'timeline', label: '时间线', desc: '成长轨迹 · 校招/进阶路线',
    layout: 'timeline', header: 'left', title: 'leftbar', skills: 'tags', item: 'timeline', font: 'sans',
  },
]

export const TEMPLATE_MAP = Object.fromEntries(TEMPLATES.map((t) => [t.key, t]))

// 未知/旧 key 兜底为 single
export function getTemplate(key) {
  return TEMPLATE_MAP[key] || TEMPLATE_MAP.single
}
