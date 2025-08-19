import _ from 'lodash'
import moment from '../../services/moment/index.js'
import { macdCosseBy, rsiPatternBy, wrPatternBy } from '../../actions/candle.js'

async function delay(ms) { return new Promise((r) => setTimeout(r, ms)) }

 // live, test 모두 둘다 쓰는 기능
async function chance(slicedCandles = [], side = 'bid', settings = {}) {
  const { basis = 'trade_price', bidConditions, bidBat, askConditions, askBat } = settings

  // 매수의 경우 원단위, 매도의 경우 해당 코인 단위
  const conditions = side === 'bid' ? bidConditions : askConditions
  const candle = slicedCandles[slicedCandles.length - 1]
  const price = candle[basis] || candle.trade_price || candle.opening_price
  const bat = (side === 'bid') ? bidBat : (askBat/price).toFixed(8) * 1
  const idx = slicedCandles.length - 1

  for (let condition of conditions) {
    const { indicator } = condition
    
    // 크로스가 만들어진 상태에서의 교점
    if (indicator === 'MACD') {
      const { cross, rate } = condition
      const sign = macdCosseBy(slicedCandles)
      if (sign === cross) {
        const { min, max } = condition
        const curCandle = slicedCandles[idx]
        const prevCandle = slicedCandles[idx - 1]
        const curMACD = curCandle?.MACD?.MACD
        const prevMACD = prevCandle?.MACD?.MACD
        if (!curMACD || !prevMACD) { return 0 }
        const val = (curMACD - prevMACD) / prevMACD
        if (val >= min && val <= max) { return bat * rate }
      }
    }

    if (indicator === 'RSI') {
      const { pattern, rate } = condition
      const sign = rsiPatternBy(slicedCandles)
      if (sign === pattern) {
        const { min, max } = condition
        const val = slicedCandles[idx].RSI
        if (val >= min && val <= max) { return bat * rate }
      }
    }

    if (indicator === 'WR') {
      const { pattern, rate } = condition
      const sign = wrPatternBy(slicedCandles)
      if (sign === pattern) {
        const { min, max } = condition
        const val = slicedCandles[idx].WR
        if (val >= min && val <= max) { return bat * rate }
      }
    }
  }

  return 0
}

function CandleSpool () {
  this.candles = {}
  this.maxSize = 10

  this.setup = function(maxSize = 10) {
    this.maxSize = maxSize
  }

  this.getCandles = (market) => {
    return this.candles[market] || []
  }

  this.append = function(market, candle) {
    if (!this.candles[market]) { this.candles[market] = [] }
    this.candles[market].push(candle)
    if (this.candles[market].length > this.maxSize) {
      this.candles[market].shift() // remove the oldest candle
    }
    // timestamp로 시간순 정렬
    this.candles[market].sort((a, b) => a.timestamp - b.timestamp)
  }

  this.clear = function() {
    this.candles = {}
  }

  this.getAllMarkets = () => {
    return Object.keys(this.candles)
  }

  this.getAllCandles = () => {
    return Object.values(this.candles).flat()
  }

  return this
}

// live에서만 사용
/*
1) 감시가격 : 종가(trade_price) 또는 시가(openning_price)를 반드시 지정해주세요.
2) 인터벌 : 1 ~ 주봉까지 지원하며, 인터벌 값에 따라서 매매를 진행하게 됩니다.

시가 + 인터벌 15분이라면 매매시간은 58분 ~ 03분까지 진행됩니다.
종가 + 인터벌 15분이라면 매매시간은 12분 ~ 16분 사이로 진행 됩니다.

인터벌 :  '1', '3', '5', '10', '15', '30', '60', '240', 'days', 'weeks'
베이시스 : 'trade_price', 'opening_price'
*/
async function timed(settings = {}) {
  const basis = settings.basis || 'trade_price'
  const interval = settings.interval || '1'
  const curAt = new Date(), curMt = moment(curAt)

  // 인터벌이 분봉이라면 제한없음
  if (interval === '1' || interval === '3') { return true }

  // 인터벌이 5분봉이라면 현재 분이 5분봉으로 떨어지는 시점의 -1, 0, 1분차여야 함.
  if (['5', '10', '15', '30'].includes(interval)) {
    const rest = curMt.minute() % interval
    const allowMins = [0, 1,  4]
    if (allowMins.includes(rest)) { return true }
    return false
  }

  // 인터벌이 60분봉이라면 현재 시각이 58분 ~ 03분 사이여야 함.
  if (interval === '60') {
    if (curMt.minute() >= 58 || curMt.minute() <= 3) { return true }
    return false
  }

  // 인터벌이 240분봉이라면 현재 시각이 58분 ~ 03분 사이이면서 4시간텀 간격이 반영되어야 함.
  if (interval === '240') {
    // 베이시스가 시가라면
    if (basis === 'opening_price') {
      if (curMt.minute() <= 3) {
        if (curMt.hour() % 4 === 0) { return true }
      }
      return false
    }
    // 베이시스가 종가라면
    if (curMt.minute() >= 57) {
      if (curMt.hour() % 4 === 3) { return true }
    }
    return false
  }

  // 인터벌이 일봉이라면 현재 시각이 08시 ~ 10시 사이여야 함.
  if (interval === 'days') {
    // 베이시스가 시가라면
    if (basis === 'opening_price') {
      if (curMt.hour() >= 9 && curMt.hour() <= 10) { return true }
    }
    // 베이시스가 종가라면
    if (curMt.hour() >= 8 && curMt.hour() <= 9) { return true }
    return false
  }

  // 인터벌이 주봉이라면 현재 시각이 08시 ~ 10시 사이여야 함.
  if (interval === 'weeks') {
    // 베이시스가 시가라면
    if (basis === 'opening_price') {
      if (curMt.hour() >= 9 && curMt.hour() <= 10) { return true }
    }
    // 베이시스가 종가라면
    if (curMt.hour() >= 8 && curMt.hour() <= 9) { return true }
    return false
  }
}

export { delay, chance, timed, CandleSpool }

export default { delay, chance, CandleSpool }
