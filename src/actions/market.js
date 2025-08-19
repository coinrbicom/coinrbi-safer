import config from '../config.js'

import upbit from '../services/upbit/index.js'
import log from '../services/log/index.js'

// @ 전체 마켓 정보를 가져오기
async function getMarkets() {
  try {
    const markets = await upbit.getMarkets()
    return markets.filter(m => m.market.startsWith('KRW-'))
  } catch(e) {
    return []
  }
}

// @ 현재 시장의 가격정보를 불러오기
async function getTickersByCurrencies(currencies = ['KRW']) {
  try {
    const tickers = await upbit.getTickersByCurrencies(currencies)
    return tickers
  } catch(e) {
    return []
  }
}


export default { getMarkets, getTickersByCurrencies }
