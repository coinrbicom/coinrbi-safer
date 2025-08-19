import config from '../config.js'
import * as indicators from 'technicalindicators'

import _ from 'lodash'
import upbit from '../services/upbit/index.js'
import cache from '../services/cache/index.js'
import log from '../services/log/index.js'
import moment from '../services/moment/index.js'
/*
{
    market: 'KRW-BTC',
    candle_date_time_utc: '2025-05-27T00:00:00',
    candle_date_time_kst: '2025-05-27T09:00:00',
    opening_price: 152197000,
    high_price: 152350000,
    low_price: 150001000,
    trade_price: 151265000,
    timestamp: 1748318399876,
    candle_acc_trade_price: 68540587746.67452,
    candle_acc_trade_volume: 454.01805041,
    unit: 240,
    MACD: {
      MACD: 206406.14903980494,
      signal: 219080.97125458324,
      histogram: -12674.822214778309
    },
    RSI: 52.11,
    WR: -0
  }
*/
export function macdCandles(candles = [], options = {}) {
  const pk = options.basis || 'trade_price'
  const macdOptions = {
    fastPeriod: options.fastPeriod || 12,
    slowPeriod: options.slowPeriod || 26,
    signalPeriod: options.signalPeriod || 9,
    values: candles.map(candle => candle[pk])
  }
  
  // MACD 계산
  const macdValues = indicators.MACD.calculate(macdOptions)

  // MACD 값이 없는 경우 null로 채우기
  const macdLength = candles.length
  const macdResult = Array(macdLength).fill(null)
  
  // MACD 값이 있는 인덱스에 값을 채우기
  macdValues.forEach((value, index) => {
    macdResult[index + macdOptions.slowPeriod - 1] = value
  })

  return macdResult
}

export function rsiCandles(candles = [], options = {}) {
  const pk = options.basis || 'trade_price'
  const rsiOptions = {
    period: options.period || 14,
    values: candles.map(candle => candle[pk])
  }

  // RSI 값이 없는 경우 null로 채우기
  const rsiValues = indicators.RSI.calculate(rsiOptions)
  const rsiLength = candles.length
  const rsiResult = Array(rsiLength).fill(null)

  // RSI 값이 있는 인덱스에 값을 채우기
  rsiValues.forEach((value, index) => {
    rsiResult[index + rsiOptions.period - 1] = value
  })
  return rsiResult  
}

export function wrCandles(candles = [], options = {}) {
  const pk = options.basis || 'trade_price'
  const wrOptions = {
    period: options.period || 14,
    high: candles.map(candle => candle.high),
    low: candles.map(candle => candle.low),
    close: candles.map(candle => candle[pk])
  }
  const wrValues = indicators.WilliamsR.calculate(wrOptions)
  // WR 값이 없는 경우 null로 채우기
  const wrLength = candles.length
  const wrResult = Array(wrLength).fill(null)
  // WR 값이 있는 인덱스에 값을 채우기
  wrValues.forEach((value, index) => {
    wrResult[index + wrOptions.period - 1] = value
  })
  return wrResult
}

// 특정캔들이 MACD 크로스가 되었는지 : 가장 최근 2개의 패턴을 체크 (뒤1,2) 최소 2개 필요
// return golden, death none
export function macdCosseBy(candles = []) {
  const scope = candles.slice(-2)
  if (scope.length < 2) return 'none'
  const last = scope[scope.length - 1]
  const prev = scope[scope.length - 2]
  if (last.MACD === null || prev.MACD === null) return 'none'
  const lastMACD = last.MACD.MACD
  const prevMACD = prev.MACD.MACD
  if (lastMACD > prevMACD && last.MACD.signal < prev.MACD.signal) return 'golden'
  if (lastMACD < prevMACD && last.MACD.signal > prev.MACD.signal) return 'death'
  return 'none'
}

function patternBy(candles = [], indicator, period = 5) {
  const scope = candles.slice(-period)
  const values = scope.map(candle => candle[indicator]).filter(value => value !== null)
  if (values.length < period) return 'none'

  const lastValues = values.slice(-period)
  const isWPattern = lastValues[0] < lastValues[1] && lastValues[1] > lastValues[2] && lastValues[2] < lastValues[3] && lastValues[3] > lastValues[4]
  const isMPattern = lastValues[0] > lastValues[1] && lastValues[1] < lastValues[2] && lastValues[2] > lastValues[3] && lastValues[3] < lastValues[4]

  if (isWPattern) return 'W'
  if (isMPattern) return 'M'
  return 'none'
}

// RSI W, M 패턴 체크 최소 5개 필요
export function rsiPatternBy(candles = []) { return patternBy(candles, 'RSI', 5) }

// WR 패턴 체크 최소 5개 필요
export function wrPatternBy(candles = []) { return patternBy(candles, 'WR', 5) }

// 캔들에 MACD, RSI, WR 값을 붙여서 내보내주기
// { ...candle, MACD, RSI, WR }
// 지표에 값이 없으면 candles의 길이만큼 맞추어서 내보내주기 null 넣기
export function withIndicates(originalCandles = [], basis = 'trade_price', indicatorOptions = {}) {

  const macds = macdCandles(originalCandles, indicatorOptions.MACD || { basis })
  const rsis = rsiCandles(originalCandles, indicatorOptions.RSI || { basis })
  const wrs = wrCandles(originalCandles, indicatorOptions.WR || { basis })

  const candles = originalCandles.map((candle, index) => {
    return {
      ...candle,
      MACD: macds[index] !== undefined ? macds[index] : null,
      RSI: rsis[index] !== undefined ? rsis[index] : null,
      WR: wrs[index] !== undefined ? wrs[index] : null
    }
  })

  // console.log(candles)

  return candles
}

// 캔들을 가져오기
export async function getCandles(market, interval = '240', count = 200, indicatorOptions = {}, basis = 'trade_price', useCache = true) {
  const minutes = ['1', '3', '5', '10', '15', '30', '60', '120', '240']
  const unit = minutes.includes(interval) ? 'minutes' : (interval === 'days' ? 'days' : (interval === 'weeks' ? 'weeks' : 'months'))
  
  // @ 캐시를 사용가능한 순간 && 조건
  // 2. 캐시된 블록이 요청한 count만큼 있거나 많다면
  // 3. 캐시된 블록의 가장 마지막 캔들의 데이터가 10분 이내라면
  // 1. 첫번쨰 블록을 받았을 때, 해당 블록에 캔들이 캐시에도 저장된게 있었다면
  const cacheCandles = useCache ? await cache.getCandleCachesByMarket(market, interval, count) : []
  const lastCacheCandle = useCache && cacheCandles.length > 0 ? cacheCandles[cacheCandles.length - 1] : null
  const enabledCache = useCache
    && cacheCandles.length >= count
    && lastCacheCandle
    && moment(lastCacheCandle.candle_date_time_utc).diff(moment.utc(), 'minutes') <= 10
  const cacheFirstBlockCandles = enabledCache ? cacheCandles.slice(-200) : []
  const fetchedCandlesInCFC = (fetchedCandles = []) => fetchedCandles.some((fc) => cacheFirstBlockCandles.some((cfc) => cfc.candle_date_time_utc === fc.candle_date_time_utc))

  let originCandles = []
  const pages = Math.ceil(count / 200)
  let lastCandleTime = null

  for (let i = 0; i < pages; i++) {
    let fetchedCandles = [], cachedCandles = []
    if (unit.includes('minutes')) {
      fetchedCandles = await upbit.getMinCandles(market, interval, 200, lastCandleTime)
    } else if (unit === 'days') {
      fetchedCandles = await upbit.getDayCandles(market, 200, lastCandleTime)
    } else if (unit === 'weeks') {
      fetchedCandles = await upbit.getWeekCandles(market, 200, lastCandleTime)
    } else if (unit === 'months') {
      fetchedCandles = await upbit.getMonthCandles(market, 200, lastCandleTime)
    }
    if (fetchedCandles.length === 0) { break }

    // 캐시를 사용가능하고 첫번쨰 블록을 받은 상태, 캐시된 캔들이 있다면, 캐시된 캔들을 가져와서 합치기
    if (i === 0 && enabledCache && fetchedCandlesInCFC(fetchedCandles)) {
      cachedCandles = cacheCandles.slice(0, count)
      originCandles = _.uniqBy([...fetchedCandles, ...cachedCandles], 'candle_date_time_utc')
      break
    }

    originCandles = [...fetchedCandles, ...originCandles]
    lastCandleTime = new Date(fetchedCandles[fetchedCandles.length - 1].candle_date_time_utc)
  }

  // 캔들을 시간순으로 정렬
  originCandles.sort((a, b) => new Date(a.candle_date_time_utc) - new Date(b.candle_date_time_utc))

  // 캐시에 저장하기
  if (useCache) { await cache.saveCandleCachesByCandles(market, interval, originCandles) }

  const candles = withIndicates(originCandles, basis, indicatorOptions)
  return candles.slice(-count)
}

export default { withIndicates, getCandles, macdCosseBy, rsiPatternBy, wrPatternBy }
