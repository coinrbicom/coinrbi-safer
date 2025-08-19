/*
  @ 비인증 API가 정상적으로 구동이 되는지 경우의 수 체크하기
  1. upbit.getMarkets
  2. upbit.getTickersByMarkets
  3. upbit.getTickersByCurrency
  4. upbit.getMinCandles
  5. upbit.getDayCandles
  6. upbit.getWeekCandles
  7. upbit.getCandles
  8. upbit.getCandlesByPage
*/
import upbit from '../services/upbit/index.js'
import log from '../services/log/index.js'

Promise.resolve()
  .then(async () => {
    // const markets = await upbit.getMarkets()
    // log.debug('Markets:')
    // log.debug(JSON.stringify(markets, null, 2))

    // const tickers = await upbit.getTickersByMarkets(markets.map(m => m.market))
    // log.debug('Tickers:')
    // log.debug(JSON.stringify(tickers, null, 2))

    // const currencies = await upbit.getTickersByCurrency(['KRW'])
    // log.debug('Currencies:')
    // log.debug(JSON.stringify(currencies, null, 2))

    // const minCandles = await upbit.getMinCandles('KRW-BTC', '1')
    // log.debug('Min Candles (1분):')
    // log.debug(JSON.stringify(minCandles, null, 2))

    // const dayCandles = await upbit.getDayCandles('KRW-BTC')
    // log.debug('Day Candles:')
    // log.debug(JSON.stringify(dayCandles, null, 2))

    // const weekCandles = await upbit.getWeekCandles('KRW-BTC')
    // log.debug('Week Candles:')
    // log.debug(JSON.stringify(weekCandles, null, 2))

    // const candles = await upbit.getCandles('1', 'KRW-BTC', 3)
    // log.debug('Candles (1분):')
    // log.debug(JSON.stringify(candles, null, 2))

    // const candlesByPage = await upbit.getCandlesByPage('1', 'KRW-BTC', 300)
    // log.debug(`Candles by Page (1분, 300개): = ${candlesByPage.length} items`)
    // log.debug(JSON.stringify(candlesByPage, null, 2))
  })
