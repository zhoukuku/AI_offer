import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import config from '../server/src/config.js'
const Database = createRequire(new URL('../server/src/index.js', import.meta.url))('better-sqlite3')
const source = config.db.file ? path.resolve(config.db.file) : fileURLToPath(new URL('../server/data/app.db', import.meta.url))
const destination = process.argv[2]
if (!destination) throw new Error('用法：node scripts/backup-db.mjs /绝对路径/备份.db')
const target = path.resolve(destination)
if (target === source) throw new Error('备份目标不能覆盖运行数据库')
await fs.mkdir(path.dirname(target), {recursive:true})
try { await fs.access(target); throw new Error('目标已存在，请使用新的备份文件名') } catch (e) { if (e.code !== 'ENOENT') throw e }
const db = new Database(source, {readonly:true, fileMustExist:true})
try { await db.backup(target); await fs.chmod(target,0o600) } finally {db.close()}
console.log('数据库备份完成：'+target)
