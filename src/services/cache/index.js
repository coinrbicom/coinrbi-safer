import _ from 'lodash'
import config from '../../config.js'
import fs from 'node:fs/promises'
import path from 'node:path'

// 캐시 디렉토리에서 데이터를 가져오는 기능
async function getCache(cacheFIlePath) {
  try {
    const data = await fs.readFile(path.join(cacheFIlePath), 'utf-8')
    return JSON.parse(data)
  } catch(e) { 
    return {}
  }
}

// 없으면 만들고, 있으면 업데이트 하는 개념
async function writeCache(cacheFilePath, data = {}) {
  try {
    const dir = path.dirname(path.join(cacheFilePath))
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(cacheFilePath), JSON.stringify(data, null, 2))
    return true
  } catch(e) {
    return false
  }
}

// 월렛 데이터 세이브
// 월렛데이터를 세이브하는 기능은 백테스트 때문에 진행한다.
// 실제 업비트연동시 바로 불러와서 체크
// 예시 : ./.caches/wallet.json

async function saveWalletCache(wallet = []) {
  const cacheFilePath = path.join('.caches', 'wallet.json')
  let cacheData = await getCache(cacheFilePath)
  if (!cacheData || !cacheData.wallet) {
    cacheData = { wallet: [] }
  }
  if (!Array.isArray(wallet)) {
    wallet = [wallet]
  }
  // 기존 월렛이 있다면 업데이트, 없다면 추가
  wallet.forEach(w => {
    const existingWalletIndex = cacheData.wallet.findIndex(wl => wl.market === w.market)
    if (existingWalletIndex > -1) {
      // 이미 존재하는 월렛이라면 업데이트
      cacheData.wallet[existingWalletIndex] = w
    } else {
      // 새로운 월렛이라면 추가
      cacheData.wallet.push(w)
    }
  })
  return writeCache(cacheFilePath, cacheData)
}

// 월렛데이터를 불러오기
async function getWalletCaches() {
  const cacheFilePath = path.join('.caches', 'wallet.json')
  try {
    const data = await fs.readFile(path.join('.caches', cacheFilePath), 'utf-8')
    const cacheData = JSON.parse(data)
    return cacheData && cacheData.wallet ? cacheData.wallet : []
  } catch (e) {
    return []
  }
}



// 오더데이터를 세이브하는 기능은 백테스트 때문에 진행한다.
// 실제 업비트연동시 바로 불러와서 체크
// 예시 : ./.caches/orders/KRW-BTC.json
// 저장되는 파일 예시 { market: 'KRW-BTC', orders: [...] }
// 업비트의 order 그대로 객체가 담겨줘야하는데 백테스트라 최대한 구조체를 따라간다.
// 매수주문서의 생성 예시
/*
  매수주문서
  {
    "uuid": "65c1c2fc-f9a9-4c70-8041-b7f4c2c4878f",
    "side": "bid",
    "ord_type": "price",
    "price": "5500",
    "state": "cancel",
    "market": "KRW-ETH",
    "created_at": "2025-08-13T12:52:26+09:00",
    "reserved_fee": "2.75",
    "remaining_fee": "0.00000175",
    "paid_fee": "2.74999825",
    "locked": "0.00350175",
    "prevented_locked": "0",
    "executed_volume": "0.0008641",
    "executed_funds": "5499.9965",
    "trades_count": 1
  }

  매도주문서
  {
    "uuid": "aba21638-0e0e-4d3e-b35d-29174082fede",
    "side": "ask",
    "ord_type": "market",
    "state": "done",
    "market": "KRW-BTC",
    "created_at": "2025-08-11T17:10:42+09:00",
    "volume": "0.00003375",
    "remaining_volume": "0",
    "prevented_volume": "0",
    "reserved_fee": "0",
    "remaining_fee": "0",
    "paid_fee": "2.80074375",
    "locked": "0",
    "prevented_locked": "0",
    "executed_volume": "0.00003375",
    "executed_funds": "5601.4875",
    "trades_count": 1
  }
*/
async function saveOrderCacheByMarket(market = 'ERR-ERR', orders = []) {
  const cacheFilePath = path.join('.caches', 'orders', `${market}.json`)
  let cacheData = await getCache(cacheFilePath)

  if (!cacheData || !cacheData.market) {
    cacheData = { market, orders: [] }
  }
  if (!Array.isArray(orders)) {
    orders = [orders]
  }
  
  // 기존 오더가 있다면 업데이트, 없다면 추가
  orders.forEach(order => {
    const existingOrderIndex = cacheData.orders.findIndex(o => o.uuid === order.uuid)
    if (existingOrderIndex > -1) {
      // 이미 존재하는 오더라면 업데이트
      cacheData.orders[existingOrderIndex] = order
    } else {
      // 새로운 오더라면 추가
      cacheData.orders.push(order)
    }
  })

  // 넣어줄 때 중복검사, 역순정렬
  cacheData.orders = _.orderBy(_.uniqBy(cacheData.orders, 'uuid'), ['uuid'], ['desc'])

  return writeCache(cacheFilePath, cacheData)
}

// 특정 마켓의 주문내역을 불러오기
async function getOrderCachesByMarket(market = 'ERR-ERR') {
  const cacheFilePath = path.join('.caches', 'orders', `${market}.json`)
  try {
    const data = await fs.readFile(path.join('.caches', cacheFilePath), 'utf-8')
    const cacheData = JSON.parse(data)
    return cacheData && cacheData.orders ? cacheData.orders : []
  } catch (e) {
    return []
  }
}

// 주문내역 캐시 데이터를 모두 불러오기
async function getAllOrderCaches() {
  const cacheDir = path.join('.caches', 'orders')
  try {
    const files = await fs.readdir(cacheDir)
    const allOrders = []
    for (const file of files) {
      const data = await fs.readFile(path.join(cacheDir, file), 'utf-8')
      const cacheData = JSON.parse(data)
      if (cacheData && cacheData.orders) {
        allOrders.push(...cacheData.orders)
      }
    }
    // uuid 기준으로 역순정렬
    return _.orderBy(allOrders, ['uuid'], ['desc'])
  } catch (e) {
    return []
  }
}

// 마켓명칭 + 인터벌 + 해당날짜별로 분류하여 저장하는 기능
// 여러 파일로 분화되어서 저장되는 개념이지만 파일을 열어보고, 해당 캔들과 동일한 캔들이 있다면 추가하지 않고 업데이트만 진행하기
// 예시 : ./.caches/KRW-BTC/240/2025-08-01.json
// 저장되는 파일 예시 { market: 'KRW-BTC', interval: '240', candles: [...] }
// 업비트의 캔들 그대로 저장되게 하면 된다.
// isExists 함수를 만들어 isExists(candle, candleData) 형태로 체크하는데, timestamp가 다르다면 업데이트를 진행하는 형태로 하면 된다.
/*
분봉
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

일봉
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

  주봉
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
async function saveCandleCachesByCandles(market = 'ERR-ERR', interval = '1', candles = []) {
  const marketDir = path.join('.caches', 'candles', market)

  // 이미 존재하는 캔들이라면 그대로 업데이트해주기
  const saveCandlesCache = async (date = '0000-00-00', candles = []) => {
    const cacheFilePath = path.join(marketDir, interval, `${date}.json`)
    let cacheData = await getCache(cacheFilePath)

    if (!cacheData || !cacheData.market) {
      cacheData = { market, interval, candles: [] }
    }
    if (!Array.isArray(candles)) {
      candles = [candles]
    }

    // 기존 캔들이 있다면 업데이트, 없다면 추가
    candles.forEach(candle => {
      const existingCandleIndex = cacheData.candles.findIndex(c => c.candle_date_time_utc === candle.candle_date_time_utc)
      if (existingCandleIndex > -1) {
        // 이미 존재하는 캔들이라면 업데이트
        cacheData.candles[existingCandleIndex] = candle
      } else {
        // 새로운 캔들이라면 추가
        cacheData.candles.push(candle)
      }
    })

    // 넣어줄 때 중복검사, 순정렬
    cacheData.candles = _.orderBy(_.uniqBy(cacheData.candles, 'candle_date_time_utc'), ['candle_date_time_utc'], ['asc'])

    return writeCache(cacheFilePath, cacheData)
  }

  // 1. 넘어온 캔들을 날짜순으로 정리하기 UTC 0시기준으로 정리를 진행
  // 날짜순으로 캐시파일들을 저장하는 과정을 갖기
  const dates = _.uniq(candles.map(c => c.candle_date_time_utc.split('T')[0]))
  for (let date of dates) {
    const dateCandles = candles.filter(c => c.candle_date_time_utc.startsWith(date))
    await saveCandlesCache(date, dateCandles)
  }

  return true
}

// 기존에 받아두었던 캔들을 불러오기
// 불러올때도 limit를 적용하는데, 최신순 기준으로 먼저 열어서 200개씩 채워서 가져온다.
async function getCandleCachesByMarket(market = 'ERR-ERR', interval = '1', limit = 200) {
  const marketDir = path.join('.caches', 'candles', market, interval)
  try {
    const files = await fs.readdir(marketDir)
    const candles = []

    // 파일들을 최신순으로 정렬해서 가져오기
    const sortedFiles = _.orderBy(files, file => new Date(file.split('.')[0]), ['desc'])
    
    for (const file of sortedFiles) {
      const data = await fs.readFile(path.join(marketDir, file), 'utf-8')
      const cacheData = JSON.parse(data)
      if (cacheData && cacheData.candles) {
        candles.push(...cacheData.candles)
      }
      if (candles.length >= limit) {
        break
      }
    }

    // 날짜 순방향으로 정리해서 내보낸다.
    return _.orderBy(candles, ['candle_date_time_utc'], ['asc']).slice(-limit)
  } catch (e) {
    return []
  }
}

export default {
  getCache,
  writeCache,
  saveWalletCache,
  getWalletCaches,
  saveOrderCacheByMarket,
  getOrderCachesByMarket,
  getAllOrderCaches,
  saveCandleCachesByCandles,
  getCandleCachesByMarket
}
