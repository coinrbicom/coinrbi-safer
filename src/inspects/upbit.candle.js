/*
  @ 업비트에 캔들 요청 API 안전검수
1. upbit.getMinCandles 200
2. upbit.getDayCandles 200
3. upbit.getWeekCandles 200
4. upbit.getCandles 200
5. upbit.getCandlesByPage : 몇개의 봉인지만 로그찍기
*/
import upbit from '../services/upbit/index.js'
import log from '../services/log/index.js'

Promise.resolve()
  .then(async () => {
    // const minCandles = await upbit.getMinCandles('KRW-BTC', '1')
    // log.debug('Min Candles (1분):')
    // // log.debug(JSON.stringify(minCandles, null, 2))

    // const dayCandles = await upbit.getDayCandles('KRW-BTC')
    // log.debug('Day Candles:')
    // // log.debug(JSON.stringify(dayCandles, null, 2))

    // const weekCandles = await upbit.getWeekCandles('KRW-BTC')
    // log.debug('Week Candles:')
    // // log.debug(JSON.stringify(weekCandles, null, 2))

    // const candles = await upbit.getCandles('1', 'KRW-BTC', 200)
    // log.debug('Candles (1분):')
    // // log.debug(JSON.stringify(candles, null, 2))

    // const candlesByPage = await upbit.getCandlesByPage('1', 'KRW-BTC', 300)
    // log.debug(`Candles by Page (1분, 300개): = ${candlesByPage.length} items`)
    // // log.debug(JSON.stringify(candlesByPage, null, 2))
  })

export default {}