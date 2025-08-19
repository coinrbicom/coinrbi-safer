import config from '../../config.js'
import chalk from 'chalk'
import moment from '../moment/index.js'
import fs from 'node:fs/promises'
import path from 'node:path'

const colorset = {
  log: 'white',
  info: 'blue',
  warn: 'yellow',
  error: 'red',
  debug: 'magenta',
  success: 'green',
  notice: 'cyan',
  fail: 'redBright'
}

const log = {}

log.debug = async (...args) => {
  const curAt = new Date(), curMt = moment(curAt)
  // console.log(...args)
  const mt = curMt.format('YYYY-MM-DD HH:mm:ss')
  const line = `[${mt}] : ${chalk.magenta(...args)}`
  console.debug(line)
  await log.write(`[${mt}] : ${args.join(' ')}`, true)
}

log.msg = async (message = '', type = 'log', write = true) => {
  const curAt = new Date(), curMt = moment(curAt)
  // console.log(...args)
  const mt = curMt.format('YYYY-MM-DD HH:mm:ss')
  const method = colorset[type] || colorset.log
  const line = `[${mt}] : ${chalk[method](message)}`
  console.log(line)
  if (write) { await log.write(`[${mt}] : ${message}`) }  
}

// 날짜별로 저장하기
log.write = async (line = '', debug = false) => {  
  try {
    const curAt = new Date(), curMt = moment(curAt)
    const logsDir = debug ? `${config.logsDir}-debugs` : config.logsDir
    if (!logsDir) return
    if (!line) return
  
    const message = line.toString().trim()
    if (!message) return
    if (message.length < 1) return
    // logs/년도/월/일.txt
    const logsDirPath = path.join(logsDir, curMt.format('YYYY/MM'))
    const fileName = curMt.format('DD') + '.txt'
    const filePath = path.join(logsDirPath, fileName)
    await fs.mkdir(logsDirPath, { recursive: true })
    await fs.appendFile(filePath, `${line}\n`, 'utf8')
  } catch(e) {
    console.error(`[COINRBI] 로그 기록 중 에러 발생: ${e.message}`)
    console.error(e.stack)
  }
}

export default log