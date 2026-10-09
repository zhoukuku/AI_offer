export const CONTENT_KEYS = ['basics', 'summary', 'experience', 'education', 'projects', 'skills', 'honors', 'custom']
const text = (v) => typeof v === 'string' ? v : Array.isArray(v) ? v.map(text).filter(Boolean).join('\n') : ''
const fields = (obj, keys) => Object.fromEntries(keys.map(k => [k, text(obj?.[k])]))
const rows = (v, keys) => Array.isArray(v) ? v.filter(x => x && typeof x === 'object' && !Array.isArray(x)).map(x => fields(x, keys)) : []
export function normalizeResume(value = {}) {
  return {
    basics: fields(value.basics, ['name', 'title', 'phone', 'email', 'city', 'website', 'avatar']),
    summary: text(value.summary),
    experience: rows(value.experience, ['company', 'role', 'start', 'end', 'city', 'bullets']),
    education: rows(value.education, ['school', 'degree', 'major', 'start', 'end']),
    projects: rows(value.projects, ['name', 'role', 'tech', 'start', 'end', 'description']),
    skills: Array.isArray(value.skills) ? value.skills.map(text).filter(Boolean) : text(value.skills).split(/[,，\n]/).filter(Boolean),
    honors: Array.isArray(value.honors) ? value.honors.map(text).filter(Boolean) : [],
    custom: rows(value.custom, ['title', 'content']),
  }
}
export function resumePatch(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) value = {}
  const normalized = normalizeResume(value)
  const out = Object.fromEntries(CONTENT_KEYS.filter(k => Object.hasOwn(value, k)).map(k => [k, normalized[k]]))
  for (const k of ['name', 'template']) if (typeof value[k] === 'string') out[k] = value[k].slice(0, 120)
  if (typeof value.accent === 'string' && /^#[0-9a-f]{6}$/i.test(value.accent)) out.accent = value.accent
  if (Array.isArray(value.versions)) out.versions = value.versions.slice(-50).map(v => ({ id: text(v.id), name: text(v.name), createdAt: Number(v.createdAt) || Date.now(), content: normalizeResume(v.content) }))
  return out
}
