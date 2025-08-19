/*
  @ 업비트 API 서비스 연동
  레퍼런스 : https://docs.upbit.com/kr
  작성일 : 2025-08-13
  작성자 : 코인알비아이 (COINRBI) 🙆‍♂️
  설명 : 업비트 API를 사용하여 마켓 정보, 지갑 정보, 주문 내역 등을 가져오는 기능을 구현합니다.
  주의사항 : API 키와 시크릿 키는 config.js 파일에 저장되어 있어야 하며, 보안에 유의해야 합니다.
*/
import config from '../../config.js'
import _ from 'lodash'
import moment from '../moment/index.js'
import crypto from 'crypto'
import querystring from 'querystring'
import { v4 as uuidv4 } from 'uuid'
import jwt from 'jsonwebtoken'

const upbit = { apiUrl: config.apiUrl }

upbit.delay = async (ms) => new Promise(r => setTimeout(r, ms))

// 업비트 전용 fetch 구성
upbit.fetch = async function () {
  const args = Array.from(arguments)
  let type = 'general'
  if (args[0].includes('/v1/orders') && (args[1].method === 'POST')) { type = 'postOrder' }
  if (args[0].includes('/v1/orders') && (args[1].method === 'DELETE')) { type = 'cancelOrder' }
  // console.log(args[0])
  const enabled = await upbit.isEnabledRequest(type)
  if (!enabled) { await upbit.waitForRemainingTime(type) }
  await upbit.delay(100)
  return fetch(...args)
}

/*
  @ 요청 제한량 정의
  레퍼런스 : https://docs.upbit.com/kr/docs/user-request-guide
  1) 일반 요청 : 30회/초
  2) 주문 요청 : 8회/초 (계정 단위, 매수 매도 통합)
  3) 주문 일괄 취소요청 : 1회/2초 (계정 단위)
  요청량이 많이 발생하게 되면 제한이 걸림으로 해당 요청 시간에 맞게 요청해야 함으로 리미트 설정이 필요한 구간에 대해서 아래 설정을 배치해야함.
  헤더에 잔여 요청량 Remaining-Req: group=default; min=1800; sec=29 값이 전달됨
*/
upbit.limits = {
  general: { rate: 30, period: 1000 },
  postOrder: { rate: 8, period: 1000 },
  cancelOrder: { rate: 1, period: 2000 }
}

// @ 각각의 API 요청의 마지막 시간을 기록하고 현재까지 몇개를 했는지 체크하기
// 각각 해당 초에 실행했던 횟수와 마지막 작업 기록(실패시 기록하지 않음), 초당 요청량을 다음 퍼리우드에 초기화 해준다
// 예) 1~8까지 기록되었다가 다음 초에 0으로 초기화
upbit.lastRequestTime = {
  general: 0, generalAt: null,
  postOrder: 0, postOrderAt: null,
  cancelOrder: 0, cancelOrderAt: null
}

// 요청량 + 퍼리어드 기준과 현재 사용했던 양 기준으로 남은 양을 기준으로 딜레이시간을 주어야할지 간격을 정해주기
// 초당 요청량을 다음 퍼리우드에 초기화 해준다
// upbit.delay 함수 사용
upbit.requestDelay = async function (type = 'general') {
  const now = Date.now()
  const limit = upbit.limits[type] || upbit.limits.general
  const lastTime = upbit.lastRequestTime[type + 'At'] || 0
  const elapsed = now - lastTime

  // 요청량이 초과되었는지 확인
  if (upbit.lastRequestTime[type] >= limit.rate) {
    // 초과된 경우 딜레이 시간 계산
    const delayTime = limit.period - elapsed
    if (delayTime > 0) {
      console.log(`요청 제한 초과, ${type} 요청을 ${delayTime}ms 동안 대기합니다.`)
      await upbit.delay(delayTime)
    }
    // 요청량 초기화
    upbit.lastRequestTime[type] = 0
    upbit.lastRequestTime[type + 'At'] = now + limit.period
  } else {
    // 요청량 증가
    upbit.lastRequestTime[type] += 1
    upbit.lastRequestTime[type + 'At'] = now
  }
  console.log(`현재 ${type} 요청량: ${upbit.lastRequestTime[type]} / ${limit.rate}`)
  return upbit.lastRequestTime[type]
}

// @ 요청제한량과 현재 사용한 양을 기준으로 얼마나 딜레이를 주어야할지 체크하는 기능
// type : 인증토큰(api.authroization)을 사용하지 않으면 general, 주문하기의 경우 postOrder, 주문취소의 경우 cancelOrder
upbit.isEnabledRequest = function (type = 'general') {
  const limit = upbit.limits[type] || upbit.limits.general
  const currentCount = upbit.lastRequestTime[type] || 0
  const lastTime = upbit.lastRequestTime[type + 'At'] || 0
  const now = Date.now()
  
  // 현재 요청량이 제한을 초과했는지 확인
  if (currentCount >= limit.rate) {
    // 마지막 요청 시간과 현재 시간의 차이를 계산
    const elapsed = now - lastTime
    // 제한 기간이 지난 경우 요청 가능
    if (elapsed >= limit.period) {
      return true
    } else {
      return false // 아직 제한 기간이 남아있음
    }
  }
  return true // 요청량이 제한을 초과하지 않음
}

// @ 남은 잔량시간을 가져오기
upbit.getElapsedTime = function (type = 'general') {
  const limit = upbit.limits[type] || upbit.limits.general
  const lastTime = upbit.lastRequestTime[type + 'At'] || 0
  const now = Date.now()
  
  // 마지막 요청 시간과 현재 시간의 차이를 계산
  const elapsed = now - lastTime
  
  // 제한 기간이 지난 경우 잔여 시간은 0
  if (elapsed >= limit.period) {
    return 0
  }
  
  // 남은 시간 계산
  return limit.period - elapsed
}

// @ 남은 잔량시간 만큼 대기
upbit.waitForRemainingTime = async function (type = 'general') {
  const remainingTime = upbit.getElapsedTime(type)
  if (remainingTime > 0) {
    console.log(`남은 요청 대기 시간: ${remainingTime}ms`)
    await upbit.delay(remainingTime)
  }
}

upbit.queryHash = (query = {}) => {
  const hasArrayKey = Object.keys(query).some(key => key.includes('[]'))
  const hasArrayValue = Object.values(query).some(value => Array.isArray(value))
  if (hasArrayValue || hasArrayKey) {
    let queryString = ''
    queryString = Object.keys(query)
      .map(key => {
        const value = query[key]
        if (Array.isArray(value)) {
          return value.map(v => `${key}=${v}`).join('&')
        } else {
          return `${key}=${value}`
        }
      })
      .join('&')
    // console.log(`Query String: ${queryString}`)
    const hash = crypto.createHash('sha512')
    return hash.update(queryString, 'utf-8').digest('hex')
  }
  const hash = crypto.createHash('sha512')
  return hash.update(querystring.encode(query), 'utf-8').digest('hex')
}

/*
  @ 업비트 인증방식
  레퍼런스 : https://docs.upbit.com/kr/docs/create-authorization-request
  업비트 API는 JWT(JSON Web Token)를 사용하여 인증을 처리합니다.
  인증 토큰에 현재 요청이 파라메터를 지녔느냐 안지녔느냐 차이가 있으며,
  인증 토큰 없이 요청하는 경우가 있습니다.
*/
upbit.authorization = (headers = {}, query = {}) => {
  const { accessKey, secretKey } = config
  const nonce = uuidv4()
  let payload = { access_key: accessKey, nonce }
  
  // states[] uuids[] 등 키값에 [] 있으면 배열 값으로 들어오게됨.
  const queryHash = upbit.queryHash(query)
  if (queryHash) {
    payload.query_hash = queryHash
    payload.query_hash_alg = 'SHA512'
  }

  return { 'Authorization': `Bearer ${jwt.sign(payload, secretKey)}`, 'Content-Type': 'application/json', ...headers }
}

/*
  @ 시장 데이터(경고, 유의 등 상태)를 불러오기
  레퍼런스 : https://docs.upbit.com/kr/reference/%EB%A7%88%EC%BC%93-%EC%BD%94%EB%93%9C-%EC%A1%B0%ED%9A%8C
  endpoint : https://api.upbit.com/v1/market/all (GET)
  is_details : true로 설정하면 상세 정보를 포함하여 불러옴
  return: [
    {
      "market": "KRW-BTC",
      "korean_name": "비트코인",
      "english_name": "Bitcoin",
      "market_event": {
        "warning": false,
        "caution": {
          "PRICE_FLUCTUATIONS": false,
          "TRADING_VOLUME_SOARING": false,
          "DEPOSIT_AMOUNT_SOARING": true,
          "GLOBAL_PRICE_DIFFERENCES": false,
          "CONCENTRATION_OF_SMALL_ACCOUNTS": false
        }
      }
    },
    {
      "market": "KRW-ETH",
      "korean_name": "이더리움",
      "english_name": "Ethereum",
      "market_event": {
        "warning": true,
        "caution": {
          "PRICE_FLUCTUATIONS": false,
          "TRADING_VOLUME_SOARING": false,
          "DEPOSIT_AMOUNT_SOARING": false,
          "GLOBAL_PRICE_DIFFERENCES": false,
          "CONCENTRATION_OF_SMALL_ACCOUNTS": false
        }
      }
    },
  ...
  ] 
*/

upbit.getMarkets = async () => {
  try {
    const response = await upbit.fetch(`${upbit.apiUrl}/v1/market/all`, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    let data
    try { data = await response.json() } catch (e) { throw new Error('JSON 파싱 오류') }
    // console.log('마켓 데이터를 불러왔습니다.', data)
    return data
  } catch (error) {
    console.error('마켓 데이터를 불러오는 중 오류 발생:', error)
    return []
  }
}

/*
  @ 특정 종목의 시세를 빠르게 불러오는 기능
  티커 데이터 불러오기
  https://docs.upbit.com/kr/reference/tickers_by_quote
  endpoint : https://api.upbit.com/v1/ticker (GET)
  markets: ['KRW-BTC', 'KRW-ETH'] 형태로 전달
  return: [
    {
      "market": "KRW-BTC",
      "trade_date": "20240822",
      "trade_time": "071602",
      "trade_date_kst": "20240822",
      "trade_time_kst": "161602",
      "trade_timestamp": 1724310962713,
      "opening_price": 82900000,
      "high_price": 83000000,
      "low_price": 81280000,
      "trade_price": 82324000,
      "prev_closing_price": 82900000,
      "change": "FALL",
      "change_price": 576000,
      "change_rate": 0.0069481303,
      "signed_change_price": -576000,
      "signed_change_rate": -0.0069481303,
      "trade_volume": 0.00042335,
      "acc_trade_price": 66058843588.46906,
      "acc_trade_price_24h": 250206655398.15125,
      "acc_trade_volume": 803.00214714,
      "acc_trade_volume_24h": 3047.01625142,
      "highest_52_week_price": 105000000,
      "highest_52_week_date": "2024-03-14",
      "lowest_52_week_price": 34100000,
      "lowest_52_week_date": "2023-09-11",
      "timestamp": 1724310962747
    },
    {
      "market": "KRW-ETH",
      "trade_date": "20240822",
      "trade_time": "071600",
      "trade_date_kst": "20240822",
      "trade_time_kst": "161600",
      "trade_timestamp": 1724310960320,
      "opening_price": 3564000,
      "high_price": 3576000,
      "low_price": 3515000,
      "trade_price": 3560000,
      "prev_closing_price": 3564000,
      "change": "FALL",
      "change_price": 4000,
      "change_rate": 0.0011223345,
      "signed_change_price": -4000,
      "signed_change_rate": -0.0011223345,
      "trade_volume": 0.00281214,
      "acc_trade_price": 14864479133.80843,
      "acc_trade_price_24h": 59043494176.58761,
      "acc_trade_volume": 4188.3697943,
      "acc_trade_volume_24h": 16656.93091147,
      "highest_52_week_price": 5783000,
      "highest_52_week_date": "2024-03-13",
      "lowest_52_week_price": 2087000,
      "lowest_52_week_date": "2023-10-12",
      "timestamp": 1724310960351
    }
  ]
*/
upbit.getTickersByMarkets = async (markets = []) => {
  try {
    const url = `${upbit.apiUrl}/v1/ticker?${querystring.stringify({ markets: markets.join(',') })}`
    const response = await upbit.fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    let data
    try { data = await response.json() } catch (e) { throw new Error('JSON 파싱 오류') }
    // console.log('티커 데이터를 불러왔습니다.', data)
    return data
  } catch (error) {
    console.error('티커 데이터를 불러오는 중 오류 발생:', error)
    return []
  }
}

/*
  @ 시세를 빠르게 불러오는 기능
  레퍼런스 :  https://docs.upbit.com/kr/reference/ticker%ED%98%84%EC%9E%AC%EA%B0%80-%EC%A0%95%EB%B3%B4
  endpoint : https://api.upbit.com/v1/ticker/all (GET)
  currencies : ['BTC', 'KRW', 'USDT'] 형태로 전달 => querystring.stringify({ quote_currencies: 'BTC,KRW,USDT' })
  return: [
      {
        "market": "KRW-BTC",
        "trade_date": "20240822",
        "trade_time": "071602",
        "trade_date_kst": "20240822",
        "trade_time_kst": "161602",
        "trade_timestamp": 1724310962713,
        "opening_price": 82900000.00000000,
        "high_price": 83000000.00000000,
        "low_price": 81280000.00000000,
        "trade_price": 82324000.00000000,
        "prev_closing_price": 82900000.00000000,
        "change": "FALL",
        "change_price": 576000.00000000,
        "change_rate": 0.0069481303,
        "signed_change_price": -576000.00000000,
        "signed_change_rate": -0.0069481303,
        "trade_volume": 0.00042335,
        "acc_trade_price": 66058843588.4690600000000000,
        "acc_trade_price_24h": 250206655398.15126000,
        "acc_trade_volume": 803.00214714,
        "acc_trade_volume_24h": 3047.01625142,
        "highest_52_week_price": 105000000.00000000,
        "highest_52_week_date": "2024-03-14",
        "lowest_52_week_price": 34100000.00000000,
        "lowest_52_week_date": "2023-09-11",
        "timestamp": 1724310962747
      },
      {
        "market": "KRW-ETH",
        "trade_date": "20240822",
        "trade_time": "071600",
        "trade_date_kst": "20240822",
        "trade_time_kst": "161600",
        "trade_timestamp": 1724310960320,
        "opening_price": 3564000.00000000,
        "high_price": 3576000.00000000,
        "low_price": 3515000.00000000,
        "trade_price": 3560000.00000000,
        "prev_closing_price": 3564000.00000000,
        "change": "FALL",
        "change_price": 4000.00000000,
        "change_rate": 0.0011223345,
        "signed_change_price": -4000.00000000,
        "signed_change_rate": -0.0011223345,
        "trade_volume": 0.00281214,
        "acc_trade_price": 14864479133.8084300000000000,
        "acc_trade_price_24h": 59043494176.58761000,
        "acc_trade_volume": 4188.36979430,
        "acc_trade_volume_24h": 16656.93091147,
        "highest_52_week_price": 5783000.00000000,
        "highest_52_week_date": "2024-03-13",
        "lowest_52_week_price": 2087000.00000000,
        "lowest_52_week_date": "2023-10-12",
        "timestamp": 1724310960351
      },
      ...
    ]
*/
upbit.getTickersByCurrencies = async (currencies = []) => {
  try {
    const url = `${upbit.apiUrl}/v1/ticker/all?${querystring.stringify({ quote_currencies: currencies.join(',') })}`
    const response = await upbit.fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    let data
    try { data = await response.json() } catch (e) { throw new Error('JSON 파싱 오류') }
    // console.log('티커 데이터를 불러왔습니다.', data)
    return data
  } catch (error) {
    console.error('티커 데이터를 불러오는 중 오류 발생:', error)
    return []
  }
}

/*
  @ 분봉 캔들데이터 가져오기
  레퍼런스 : https://docs.upbit.com/kr/reference/%EB%B6%84minute-%EC%BA%94%EB%93%A4-1
  endpoint : https://api.upbit.com/v1/candles/minutes/{unit} (GET)
  return [
    {
      "market": "KRW-BTC",
      "candle_date_time_utc": "2018-04-18T10:16:00",
      "candle_date_time_kst": "2018-04-18T19:16:00",
      "opening_price": 8615000,
      "high_price": 8618000,
      "low_price": 8611000,
      "trade_price": 8616000,
      "timestamp": 1524046594584,
      "candle_acc_trade_price": 60018891.90054,
      "candle_acc_trade_volume": 6.96780929,
      "unit": 1
    }
  ]
*/
upbit.getMinCandles = async (market, unit = 1, count = 200, to) => {
  try {
    const url = new URL(`${upbit.apiUrl}/v1/candles/minutes/${unit}`)
    url.searchParams.append('market', market)
    url.searchParams.append('count', count.toString())
    if (to) url.searchParams.append('to', to.toISOString())
    else url.searchParams.append('to', new Date().toISOString())
    
    const response = await upbit.fetch(url.href, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    let data
    try { data = await response.json() } catch (e) { throw new Error('JSON 파싱 오류') }
    // console.log('캔들 데이터를 불러왔습니다.', data)
    return data
  } catch (error) {
    console.error('캔들 데이터를 불러오는 중 오류 발생:', error)
    return []
  }
}

/*
  @ 일봉 캔들데이터 가져오기
  레퍼런스 : https://docs.upbit.com/kr/reference/%EC%9D%BCday-%EC%BA%94%EB%93%A4-1
  endpoint : https://api.upbit.com/v1/candles/days (GET)
  return [
    {
      "market": "KRW-BTC",
      "candle_date_time_utc": "2018-04-18T00:00:00",
      "candle_date_time_kst": "2018-04-18T09:00:00",
      "opening_price": 8450000,
      "high_price": 8679000,
      "low_price": 8445000,
      "trade_price": 8626000,
      "timestamp": 1524046650532,
      "candle_acc_trade_price": 107184005903.68721,
      "candle_acc_trade_volume": 12505.93101659,
      "prev_closing_price": 8450000,
      "change_price": 176000,
      "change_rate": 0.0208284024
    }
  ]
*/
upbit.getDayCandles = async (market, count = 200, to) => {
  try {
    const url = new URL(`${upbit.apiUrl}/v1/candles/days`)
    url.searchParams.append('market', market)
    url.searchParams.append('count', count.toString())
    if (to) url.searchParams.append('to', to.toISOString())
    else url.searchParams.append('to', new Date().toISOString())
    
    const response = await upbit.fetch(url.href, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    let data
    try { data = await response.json() } catch (e) { throw new Error('JSON 파싱 오류') }
    // console.log('일 캔들 데이터를 불러왔습니다.', data)
    return data
  } catch (error) {
    console.error('일 캔들 데이터를 불러오는 중 오류 발생:', error)
    return []
  }
}

/*
  @ 주봉 캔들데이터 가져오기
  레퍼런스 : https://docs.upbit.com/kr/reference/%EC%A3%BCweek-%EC%BA%94%EB%93%A4-1
  endpoint : https://api.upbit.com/v1/candles/weeks (GET)
  return [
    {
      "market": "KRW-BTC",
      "candle_date_time_utc": "2018-04-16T00:00:00",
      "candle_date_time_kst": "2018-04-16T09:00:00",
      "opening_price": 8665000,
      "high_price": 8840000,
      "low_price": 8360000,
      "trade_price": 8611000,
      "timestamp": 1524046708995,
      "candle_acc_trade_price": 466989414916.1301,
      "candle_acc_trade_volume": 54410.56660813,
      "first_day_of_period": "2018-04-16"
    }
  ]
*/
upbit.getWeekCandles = async (market, count = 200, to) => {
  try {
    const url = new URL(`${upbit.apiUrl}/v1/candles/weeks`)
    url.searchParams.append('market', market)
    url.searchParams.append('count', count.toString())
    if (to) url.searchParams.append('to', to.toISOString())
    else url.searchParams.append('to', new Date().toISOString())
    
    const response = await upbit.fetch(url.href, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    let data
    try { data = await response.json() } catch (e) { throw new Error('JSON 파싱 오류') }
    // console.log('주 캔들 데이터를 불러왔습니다.', data)
    return data
  } catch (error) {
    console.error('주 캔들 데이터를 불러오는 중 오류 발생:', error)
    return []
  }
}

/*
  @ 캔들 데이터를 분, 일, 주 단위로 가져오는 함수
  캔들 가져오는 기능을 통합적으로 불러오기 위한 퍼블릭 함수
*/
upbit.getCandles = async function (interval = 1, market, count, to, orderby = 'asc') {
  try {
    let candles = []
    const minutes = ['1', '3', '5', '10', '15', '30', '60', '240']
    if (minutes.includes(interval.toString())) {
      candles = await upbit.getMinCandles(market, interval, count, to)
    } else if (interval === 'days') {
      candles = await upbit.getDayCandles(market, count, to)
    } else if (interval === 'weeks') {
      candles = await upbit.getWeekCandles(market, count, to)
    } else {
      return []
    }
    // candle_date_time_utc 로 정렬해서 내보낸다.
    if (orderby === 'asc') {
      candles.sort((a, b) => new Date(a.candle_date_time_utc) - new Date(b.candle_date_time_utc))
    } else {
      candles.sort((a, b) => new Date(b.candle_date_time_utc) - new Date(a.candle_date_time_utc))
    }
    return candles.slice(0, count) // 상한선에 맞춰서 반환
  } catch(e) {
    console.error('캔들 데이터를 불러오는 중 오류 발생:', e)
    return []
  }
}

/*
  @ 캔들을 여러번 나누어서 불러오기 : limit 200개 상한선
  to를 기준으로 이어서 가져온뒤 candle_date_time_utc 최근 시간순으로 정렬해서 가져온다.
*/
upbit.getCandlesByPage = async function (interval = 1, market, count = 200, to, orderby = 'asc') {
  let allCandles = []
  let currentTo = to ? new Date(to) : new Date()
  
  while (allCandles.length < count) {
    const candles = await upbit.getCandles(interval, market, count - allCandles.length, currentTo)
    if (candles.length === 0) break // 더 이상 가져올 캔들이 없으면 종료
    allCandles = allCandles.concat(candles)
    
    // 마지막 캔들의 시간으로 다음 요청의 to를 설정
    currentTo = new Date(candles[candles.length - 1].candle_date_time_utc)
  }
  
  // 정렬
  const sortedCandles = _.orderBy(_.uniqBy(allCandles, 'candle_date_time_utc'), ['candle_date_time_utc'], [orderby])
  
  return sortedCandles // 중복 제거 후 상한선에 맞춰서 반환
}

/*
  @ 지갑 데이터를 불러오기
  레퍼런스 : https://docs.upbit.com/kr/reference/%EC%A0%84%EC%B2%B4-%EA%B3%84%EC%A2%8C-%EC%A1%B0%ED%9A%8C
  endpoint : https://api.upbit.com/v1/accounts
  return: [
      {
        "currency":"KRW",
        "balance":"1000000.0",
        "locked":"0.0",
        "avg_buy_price":"0",
        "avg_buy_price_modified":false,
        "unit_currency": "KRW",
      },
      {
        "currency":"BTC",
        "balance":"2.0",
        "locked":"0.0",
        "avg_buy_price":"101000",
        "avg_buy_price_modified":false,
        "unit_currency": "KRW",
      }
    ]
*/
upbit.getWallet = async () => {
  try {
    const response = await upbit.fetch(`${upbit.apiUrl}/v1/accounts`, {
      method: 'GET',
      headers: upbit.authorization({ 'Accept': 'application/json', 'Content-Type': 'application/json' })
    })
    const data = await response.json()
    // console.log('지갑 데이터를 불러왔습니다.', data)
    return data
  } catch (error) {
    console.error('지갑 데이터를 불러오는 중 오류 발생:', error)
    return []
  }
}

/*
  @ 시장가 매수하기 : 마켓, 원화
  레퍼런스 : https://docs.upbit.com/kr/reference/%EC%A3%BC%EB%AC%B8%ED%95%98%EA%B8%B0
  endpoint : https://api.upbit.com/v1/orders (POST)
  return: {
    "uuid": "cdd92199-2897-4e14-9448-f923320408ad",
    "side": "bid",
    "ord_type": "limit",
    "price": "100.0",
    "state": "wait",
    "market": "KRW-BTC",
    "created_at": "2018-04-10T15:42:23+09:00",
    "volume": "0.01",
    "remaining_volume": "0.01",
    "reserved_fee": "0.0015",
    "remaining_fee": "0.0015",
    "paid_fee": "0.0",
    "locked": "1.0015",
    "executed_volume": "0.0",
    "trades_count": 0,
    "prevented_volume": "0",
    "prevented_locked": "0"
  }
*/
upbit.bidByKrw = async (market, amount = 0) => {
  try {
    const body = { market, side: 'bid', volume: null, price: amount, ord_type: 'price' }
    const response = await upbit.fetch(`${upbit.apiUrl}/v1/orders`, {
      method: 'POST',
      headers: upbit.authorization({ 'Accept': 'application/json', 'Content-Type': 'application/json' }, body),
      body: JSON.stringify(body)
    })
    const data = await response.json()
    // console.log('매수 주문을 완료했습니다.', data)
    return data
  } catch (error) {
    console.error('매수 주문 중 오류 발생:', error)
    return { error: { message: "알수없는 오류", name: "client_side_error" } }
  }  
}

/*
  @ 매도하기
  레퍼런스 : https://docs.upbit.com/kr/reference/%EC%A3%BC%EB%AC%B8%ED%95%98%EA%B8%B0
  endpoint : https://api.upbit.com/v1/orders (POST)
  return : {
    "uuid": "cdd92199-2897-4e14-9448-f923320408ad",
    "side": "ask",
    "ord_type": "market",
    "price": null,
    "state": "wait",
    "market": "KRW-BTC",
    "created_at": "2018-04-10T15:42:23+09:00",
    "volume": "0.01",
    "remaining_volume": "0.01",
    "reserved_fee": "0.0015",
    "remaining_fee": "0.0015",
    "paid_fee": "0.0",
    "locked": "1.0015",
    "executed_volume": "0.0",
    "trades_count": 0,
    "prevented_volume": "0",
    "prevented_locked": "0"
  }
*/
upbit.askByCoinVolume = async (market, volume = 0) => {
  try {
    const body = { market, side: 'ask', volume, price: null, ord_type: 'market' }
    const response = await upbit.fetch(`${upbit.apiUrl}/v1/orders`, {
      method: 'POST',
      headers: upbit.authorization({ 'Accept': 'application/json', 'Content-Type': 'application/json' }, body),
      body: JSON.stringify(body)
    })
    const data = await response.json()
    // console.log('매도 주문을 완료했습니다.', data)
    return data
  } catch (error) {
    console.error('매도 주문 중 오류 발생:', error)
    return { error: { message: "알수없는 오류", name: "client_side_error" } }
  }
}

/*
  @ 체결대기 주문
  레퍼런스 : https://api.upbit.com/v1/orders/open (GET)
  return: [
	{
	  "uuid": "e5715c44-2d1a-41e6-91d8-afa579e28731",
	  "side": "ask",
	  "ord_type": "limit",
	  "price": "103813000",
	  "state": "done",
	  "market": "KRW-BTC",
	  "created_at": "2024-06-13T10:28:36+09:00",
	  "volume": "0.00039132",
	  "remaining_volume": "0",
	  "reserved_fee": "0",
	  "remaining_fee": "0",
	  "paid_fee": "20.44627434",
	  "locked": "0",
	  "executed_volume": "0.00039132",
	  "executed_funds": "40892.54868",
	  "trades_count": 2,
    "prevented_volume":"0",
    "prevented_locked":"0"
	},
  # ....
]
*/
upbit.getWaitOrders = async (market, limit = 10, page = 1, order_by = 'desc') => {
  try {
    const url = new URL(`${upbit.apiUrl}/v1/orders`)
    if (market) url.searchParams.append('market', market)
    url.searchParams.append('limit', limit) // 최대 100개까지 불러오기
    url.searchParams.append('page', page) // 최대 100개까지 불러오기
    url.searchParams.append('order_by', order_by) // 최신순으로 정렬
    url.searchParams.append('states[]', 'wait')
    
    const hashQuery = querystring.parse(url.search.replace('?', ''))
    const response = await upbit.fetch(url.href, {
      method: 'GET',
      headers: upbit.authorization({ 'Accept': 'application/json', 'Content-Type': 'application/json' }, hashQuery)
    })
    
    const data = await response.json()
    // console.log('주문내역을 불러왔습니다.', data)
    return data
  } catch (error) {
    console.error('주문내역을 불러오는 중 오류 발생:', error)
    return []
  }
}

/*
  @ 체결완료 주문
  레퍼런스 : https://api.upbit.com/v1/orders/close (GET)
  return: [
	{
	  "uuid": "e5715c44-2d1a-41e6-91d8-afa579e28731",
	  "side": "ask",
	  "ord_type": "limit",
	  "price": "103813000",
	  "state": "done",
	  "market": "KRW-BTC",
	  "created_at": "2024-06-13T10:28:36+09:00",
	  "volume": "0.00039132",
	  "remaining_volume": "0",
	  "reserved_fee": "0",
	  "remaining_fee": "0",
	  "paid_fee": "20.44627434",
	  "locked": "0",
	  "executed_volume": "0.00039132",
	  "executed_funds": "40892.54868",
	  "trades_count": 2,
    "prevented_volume":"0",
    "prevented_locked":"0"
	},
  # ....
]
*/
upbit.getDoneOrders = async (market, limit = 10, startAt, endAt, order_by = 'desc') => {
  try {
    const sAt = startAt ? startAt.toISOString() : moment().startOf('day').subtract(1, 'day').toISOString() // 기본값은 1일 전
    const eAt = endAt ? endAt.toISOString() : moment().endOf('day').toISOString() // 기본값은 현재 시간

    const url = new URL(`${upbit.apiUrl}/v1/orders`)
    if (market) url.searchParams.append('market', market)
      if (sAt) { url.searchParams.append('start_time', sAt) }
    if (eAt) { url.searchParams.append('end_time', eAt) }
    url.searchParams.append('limit', limit) // 최대 100개까지 불러오기
    url.searchParams.append('order_by', order_by) // 최신순으로 정렬
    url.searchParams.append('states[]', 'done')
    url.searchParams.append('states[]', 'cancel')
    console.log(url.search)

    const hashQuery = querystring.parse(url.search.replace('?', ''))
    const response = await upbit.fetch(url.href, {
      method: 'GET',
      headers: upbit.authorization({ 'Accept': 'application/json', 'Content-Type': 'application/json' }, hashQuery)
    })
    
    const data = await response.json()
    // console.log('주문내역을 불러왔습니다.', data)
    return order_by === 'asc' ? _.sortBy(data, 'created_at') : _.sortBy(data, 'created_at').reverse()
  } catch (error) {
    console.error('주문내역을 불러오는 중 오류 발생:', error)
    return []
  }
}

/*
  @ 특정 주문내역이 있는지 id로 확인하기, 최대 100개씩만 가능
  레퍼런스 : https://api.upbit.com/v1/orders/uuids (GET)
  market, "uuids[]", order_by(desc 기본)
  endpoint : https://api.upbit.com/v1/orders/uuids
  예시 :
  curl --request GET \
      --url 'https://api.upbit.com/v1/orders/uuids?market=KRW-BTC&uuids[]=d098ceaf-6811-4df8-97f2-b7e01aefc03f%2Cd098ceaf-6811-4df8-97f2-b7e01aefc03f&order_by=desc' \
      --header 'accept: application/json'
  return: [
  {
    "uuid": "d098ceaf-6811-4df8-97f2-b7e01aefc03f",
    "side": "bid",
    "ord_type": "limit",
    "price": "104812000",
    "state": "wait",
    "market": "KRW-BTC",
    "created_at": "2024-06-13T10:26:21+09:00",
    "volume": "0.00101749",
    "remaining_volume": "0.00006266",
    "reserved_fee": "53.32258094",
    "remaining_fee": "3.28375996",
    "paid_fee": "50.03882098",
    "locked": "6570.80367996",
    "executed_volume": "0.00095483",
    "executed_funds": "100077.64196",
    "trades_count": 1,
    "prevented_volume":"0",
    "prevented_locked":"0"
  }
  # ....
]
*/
upbit.getOrderByUuid = async (uuids = [], order_by = 'desc') => {
  try {
    const url = new URL(`${upbit.apiUrl}/v1/orders/uuids`)
    for (const uuid of uuids) { url.searchParams.append('uuids[]', uuid) }
    if (order_by) url.searchParams.append('order_by', order_by)

    // 쿼리스트링을 직접 생성하여 authorization에 넘김
    const hashQuery = querystring.parse(url.search.replace('?', ''))
    const response = await upbit.fetch(url.href, {
      method: 'GET',
      headers: upbit.authorization({ 'Accept': 'application/json', 'Content-Type': 'application/json' }, hashQuery)
    })
    
    const data = await response.json()
    return data
  } catch (error) {
    return []
  }  
}

export default upbit
