import config from '../../config.js'

import log from '../../services/log/index.js'
import moment from '../../services/moment/index.js'
import _ from 'lodash'

import settings from './settings.js'

import { delay, chance, timed, CandleSpool } from './utils.js'

//  😃매수/매도 실행 기능
async function execute (scope = [], app = {}, settings = {}) {
  const { store, actions } = app
  const { basis = 'trade_price' } = settings

  const candle = scope[scope.length - 1]
  const candleAt = moment(candle.candle_date_time_utc)
  const market = candle.market

  // log.msg(`[${moment(candle.timestamp).format('YYYY-MM-DD HH:mm:ss')}] ${market} : ${candle[basis].toLocaleString()} 원`, 'info')
  await store.update()

  // 👛원화지갑정보, 현재 마켓 지갑정보 가져오기
  const krwWallet = store.wallet.find(w => w.currency === 'KRW')
  const marketWallet = store.wallet.find(w => w.currency === market.split('-')[1])

  // 매수/매도 시간에 대한 대응
  const time = timed(settings)
  if (time) { log.msg(`[${candleAt.format('YYYY-MM-DD HH:mm:ss')}] ${market} : 감시가 ${candle[basis].toLocaleString()} 원 매수/매도 체크중...`, 'info') }

  // 💰매수 : settings.bidConditions 기반
  if (krwWallet && krwWallet.balance > 0 && time) {
    const bat = await chance(scope, 'bid',  settings)
    if (bat) { await actions.order.bidByKrw(store, market, bat, candle[basis], candleAt) }
  }

  // 💰매도 : settings.askConditions 기반
  if (marketWallet && marketWallet.balance > 0) {
    const bat = await chance(scope, 'ask', settings)
    if (bat) { await actions.order.askByCoinVolume(store, market, bat, candle[basis], candleAt) }
  }

  // 매수/매도 텀 기능
  if (!config.backtest && settings.term) { await delay(settings.term * 60 * 1000) } // 설정된 시간만큼 대기
}

// 🔥매수/매도 전략
// config.strategies = [{}] 를 활용, 조건에 맞는 매매(순매매, 역매매)를 지정해두면 그에 따라서 진행하는 개념
// 원화를 모두 쓰면 모니터링모드로 관찰, 매도만 진행
async function play(app = {}) {
  try {
    const curAt = new Date(), curMt = moment(curAt)
    const mode = config.backtest ? 'test' : 'live'

    log.msg(`📊 ${config.backtest ? '[백테스트]' : '[실매매]'} default-v1 전략 실행중... 🚩(${curMt.format('YYYY-MM-DD HH:mm:ss')})`, 'info')

    const { store, actions } = app
    
    await store.update()

    let walletState = await actions.wallet.prettyWallet(store)
    if (walletState) { walletState.split('\n').forEach(line => log.msg(line, 'notice')) }    

    let totalAssets = await actions.wallet.getTotalAssets(store)
    log.msg(`👛 최종 자산: ${totalAssets.toLocaleString('ko-KR', { maximumFractionDigits: 0, minimumFractionDigits: 0 })} 원`, 'info')
    log.msg(``)


    const { basis = 'trade_price', candleCount, scopeCandleCount, interval, indicatorOptions } = settings

    //  💹 Market Scope
    const markets = store.markets.filter(({ market }) => {
      if (config.backtest && config.backtest.markets.length && !config.backtest.markets.includes(market)) { return false }
      if (!config.currencies.includes(market.split('-')[0])) return false
      if (config.dangerousMarkets.includes(market)) return false
      return true
    })
    // log.msg(`[OK] ${markets.length}종 마켓 필터링 완료`, 'info')

    if (markets.length === 0) {
      // log.msg(`[ERROR] 필터링된 마켓이 없습니다. 설정을 확인해주세요.`, 'error')
      return
    }

    // 🔥 Back Test 모드
    if (mode === 'test') {
      let timeline = {}
      for (let key in markets) {
        const { market } = markets[key]
        markets.candles = await actions.candle.getCandles(market, interval, candleCount, indicatorOptions, basis, true)
        await delay(161)
        for (let candle of markets.candles) {
          if (!timeline[candle.timestamp]) { timeline[candle.timestamp] = [] }
          timeline[candle.timestamp].push(candle)
        }
      }

      log.msg(`[OK] 백테스트 캔들 총 ${markets.length}종 업데이트 및 다운로드 완료`, 'info')

      // timeline key값으로 정렬.
      const time = Object.keys(timeline).sort((a, b) => parseInt(a) - parseInt(b))

      // @ 시간순으로 순회하면서 execute 함수를 실행 : 실행된 타임라인의 캔들까지만 열람가능하게
      const spool = new CandleSpool()
      spool.setup(scopeCandleCount)

      for (let timestamp of time) {        
        const candles = timeline[timestamp] // 해당시간에 찍힌 캔들
        if (!candles || candles.length === 0) { continue }
        const inMarkets = candles.map(c => c.market)
        for (let market of inMarkets) {
          const candle = candles.find(c => c.market === market)
          spool.append(market, candle)
          const scope = spool.getCandles(market)
          if (scope.length >= scopeCandleCount) {
            await execute(scope, app, settings)
          }
        }
      }
    }

    //  😃 라이브 모드
    if (mode === 'live') {
      log.msg(`🔥 ${markets.length} 매수/매도를 탐색중입니다. (매수를 하거나 매도가 되면, 화면에 표현됩니다.)`, 'info')
      log.msg(``)
      for (let { market } of markets) {
        const candles = await actions.candle.getCandles(market, interval, candleCount, indicatorOptions, true)
        const scope = candles.slice(-scopeCandleCount)
        if (scope.length >= scopeCandleCount) {
          await execute(scope, app, settings)
        }
      }
    }
    
    walletState = await actions.wallet.prettyWallet(store)
    if (walletState) { walletState.split('\n').forEach(line => log.msg(line, 'notice')) }

    totalAssets = await actions.wallet.getTotalAssets(store)
    log.msg(`👛 최종 자산: ${totalAssets.toLocaleString('ko-KR', { maximumFractionDigits: 0, minimumFractionDigits: 0 })} 원`, 'info')
    log.msg(``)

  } catch(e) {
    log.msg(`[COINRBI] 에러 발생: ${e.message}`, 'error')
    log.msg(`${e.stack}`, 'debug')
  }
}

// 🍀 전략 메인 로직
async function main (app = {}) {
  try {
    // 🔥해당 주요 로직 플레이
    await play(app)
  } catch(e) {
    log.msg(`[COINRBI] main-default-v1 에러 발생: ${e.message}`, 'error')
    log.msg(`${e.stack}`, 'debug')
  }
}

export default { main }
