import dotenv from 'dotenv/config'

import pkg from '../package.json' with { type: 'json' }
import moment from './services/moment/index.js'
import cache from './services/cache/index.js'
import log from './services/log/index.js'

import config from './config.js'

import candleActions from './actions/candle.js'
import marketActions from './actions/market.js'
import orderActions from './actions/order.js'
import walletActions from './actions/wallet.js'

const app = {}

app.config = config

app.actions = {
  candle: candleActions,
  market: marketActions,
  wallet: walletActions,
  order: orderActions
}

app.store = {
  orders: [], // 백테스트에서 사용되는 orders 기록
  markets: [], // 현재 시장의 정책
  tickers: [], // 현재 시장의 가격
  wallet: [], // 지갑 정보 (보유한 마켓 + 티커 + 매수평단 보유중)
  initialize: async function() {
    this.markets = await app.actions.market.getMarkets()
    this.tickers = await app.actions.market.getTickersByCurrency(config.currencies)
    this.wallet = await app.actions.wallet.getWallet(this)
    // this.wallet = await cache.getWalletCaches() // 월렛정보 데이터 불러오기
    // this.orders = await cache.getAllOrderCaches() // 주문내역 데이터를 불러오기

  },
  update: async function () {
    this.markets = await app.actions.market.getMarkets()
    this.tickers = await app.actions.market.getTickersByCurrencies(config.currencies)
    this.wallet = await app.actions.wallet.getWallet(this)
  }
}

app.delay = async function(ms) { return new Promise(r => setTimeout(r, ms)) }

// 앱 작동 기능
app.run = async function() {
  const { config } = this
  const that = this
  try {
    const curAt = new Date(), curMt = moment(curAt)

    // 매수, 매도 전략 실행하기
    let loop = 1
    while(loop) {
      const strategies = config.strategies
      
      for (const s of strategies) {
        const strategy = await import(`./strategies/${s}/index.js`)
          .then(m => m.default).catch((e) => {
            console.log(e.message)
            console.log(e.stack)
            return ({ main: null, test: null })
          })
        if (strategy.main) { await strategy.main(that) }
      }

      if (config.backtest) { loop = false }
      await app.delay(config.interval)
    }
  } catch(e) {
    log.msg(`[COINRBI] 에러 발생: ${e.message}`, 'error')
    log.msg(`${e.stack}`, 'debug')
    await app.delay(config.errorInterval)
    return app.run()
  }
}

// 앱 기동
function main() {
  const curAt = new Date(), curMt = moment(curAt)

  log.msg(`[COINRBI] ${pkg.name} ${pkg.version}`, 'info')
  log.msg(`본 프로그램은 코인알비아이에서 만들었으며, 사용에 대한 모든 책임은 사용자에게 있습니다.`, 'debug')
  log.msg(`사용권을 확인하시려면,  README.md 파일을 확인해주세요.`)
  log.msg(`공식 웹사이트 : https://coinrbi.com`)
  log.msg(`제작자 : COINRBI(코알, coinrbicom@gmail.com)`)
  log.msg(`가급적 최신업데이트를 다운로드 받아 실행해주세요.`)
  log.msg(`문의사항은 coinrbicom@gmail.com 이메일만 접수 받습니다.`)
  log.msg(`Copyrigyht © 2025 COINRBI(코인알비아이). All rights reserved.`)

  // 작동모드 설명
  if (config.backtest) {
    log.msg(`[COINRBI] 백테스트 모드로 작동합니다. 설정된 금액(${config.backtest.balance.toLocaleString()}원)을 기준으로 작동합니다.`, 'info')
    log.msg(`[COINRBI] 백테스트 모드에서 사용되는 마켓: ${config.backtest.markets.join(', ')}`, 'info')
  } else {
    // config.accessKey, config.secretKey 설정해달라고 요청
    if (!config.accessKey || !config.secretKey) {
      log.msg(`[COINRBI] 에러 발생: accessKey, secretKey를 설정해주세요.`, 'error')
      log.msg(`[COINRBI] config.js 파일에서 accessKey, secretKey를 설정해주시거나, .env 파일에 명시해주세요.`, 'error')
      return
    }
  }

  log.msg(``)

  app.run()
}

main()