import _ from 'lodash'
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

export { delay, chance, CandleSpool }

export default { delay, chance, CandleSpool }
