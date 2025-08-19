import config from '../../config.js'

import _ from 'lodash'
import { v4 as uuidv4 } from 'uuid'

import log from '../log/index.js'
import cache from '../cache/index.js'
import calc from '../calc/index.js'
import moment from '../moment/index.js'

const backtest = {}

backtest.delay = async (ms) => new Promise(r => setTimeout(r, ms))

/*
  @ 업비트의 지갑의 모습을 딴다
  업비트에서 자신의 계좌리스트를 가져오면 배열이다.
  최소 1개의 마켓에는 참여해 있다. 원화마켓
{
    "currency": "KRW",
    "balance": "3941.28607964",
    "locked": "0",
    "avg_buy_price": "0",
    "avg_buy_price_modified": true,
    "unit_currency": "KRW"
  },
  {
    "currency": "ETH",
    "balance": "0.0008641",
    "locked": "0",
    "avg_buy_price": "6365000",
    "avg_buy_price_modified": false,
    "unit_currency": "KRW"
  },
  ...
*/
backtest.getWallet = async (store) => {
  const settings = _.cloneDeep(config.backtest || {})

  // 최초 로드하게되면, 세팅을 진행한다.
  if (!store.wallet.length) {
    store.wallet.push({
      currency: 'KRW',
      balance: settings.balance || 1000000, // 기본값은 100만원
      locked: '0',
      avg_buy_price: '0',
      avg_buy_price_modified: true,
      unit_currency: 'KRW'
    })
  }

  return store.wallet
}

// @  어떤마켓 수량, 적용단가
backtest.addCurrencyToWallet = async (store, identity, volume, current_price = 0) => {
  const { wallet } = store
  if (!identity) { return { error: true, message: '티커 정보가 올바르지 않아 수량을 추가하지 못했습니다.' } }

  // "KRW-BTC" -> "BTC" 또는 "BTC"
  const currencyName = identity.includes('-') ? identity.split('-')[1]  : identity

  let currency = wallet.find(c => c.currency === currencyName)

  // 📜 없다면 추가하기
  if (!currency) {
    currency = {
      currency: currencyName,
      balance: volume * 1,
      locked: '0',
      avg_buy_price: current_price, // 현재가로 평단가 설정
      avg_buy_price_modified: false,
      unit_currency: 'KRW'
    }
    wallet.push(currency)
  }

  // 📜 원화라면, 수량추가 + 평단변경
  if (currencyName === 'KRW') {
    // 원화는 수량만 추가하고, 평단가는 변경하지 않음
    currency.balance = (parseFloat(currency.balance) + parseFloat(volume)).toFixed(8) * 1
  }

  // 📜 이미 있다면 수량추가 + 평단변경
  if (currencyName !== 'KRW') {
    currency.avg_buy_price = calc.getAveragePrice(currency.balance, currency.avg_buy_price, volume, current_price)
    currency.balance = (parseFloat(currency.balance) + parseFloat(volume)).toFixed(8) * 1
    // console.log(`누적 : ${currency.balance}, 추가 : ${volume}, 현재가 : ${current_price}, 평단가 : ${currency.avg_buy_price}`)
  }

  // 캐시에 저장하기
  await cache.saveWalletCache(wallet)
  // log.info(`지갑에 ${currencyName} 추가: 수량 ${volume}, 현재가 ${current_price}, 평단가 ${currency.avg_buy_price}`)
 
  return {  error: false, message: `${currencyName} 지갑에 ${volume} 추가` }
}

// @ 지갑에서 감소
// 원화 - 원화, 코인 - 코인 형태로 amount 값으로 전달해주기
backtest.subtractCurrencyFromWallet = async (store, identity, volume, current_price = 0, options = {}) => {
  const { wallet } = store
  if (!identity) { return { error: true, message: '티커 정보가 없습니다.' } }
  if (!current_price) { return { error: true, message: '현재 시세정보가 없습니다.' } }

  // "KRW-BTC" -> "BTC" 또는 "BTC"
  const currencyName = identity.includes('-') ? identity.split('-')[1] : identity

  const currency = wallet.find(c => c.currency === currencyName)
  if (!currency) {
    log.error(`지갑에 ${currencyName}가 없습니다.`)
    return { error: true, message: `지갑에 ${currencyName}가 없습니다.` }
  }

  // 📜 원화라면, 수량감소 또는 0이라면, 지갑에서 제외하지 않고 0원 처리
  if (currencyName === 'KRW') {
    // 잔여 시드 검사
    if (parseFloat(currency.balance) < parseFloat(volume)) {
      return { error: true, message: `지갑에 ${currencyName} 잔액이 부족합니다. 현재 잔액: ${currency.balance}, 요청 금액: ${volume}` }
    }
    // 수수료액 제외 수량 검사, 거래소의 트레이딩 거래가 아닌 직접 감소하는 경우 options.bypassFee 옵션을 통해 수수료를 제외하지 않을 수 있다.
    if (!options.bypassFee) {
      const fee = (volume * 0.0005).toFixed(1) * 1 // 0.05% 수수료
      const krwVolume = (volume - fee).toFixed(1) * 1 // 수수료를 제외한 실제 거래량
      const minimumLimitKrw = 5001 // 5000원 이지만 딱 5천원이면 안된다.
      if (krwVolume < minimumLimitKrw) {
        return { error: true, message: `지갑에서 ${currencyName}를 감소할 수 없습니다. 최소 ${minimumLimitKrw}원 이상이어야 합니다.` }
      }
    }
    currency.balance = (parseFloat(currency.balance) - parseFloat(volume)).toFixed(8) * 1
  }

  // 📜 원화가 아니라면, 수량 감소 처리
  if (currencyName !== 'KRW') {
    // 잔여 수량 검사
    if (parseFloat(currency.balance) < parseFloat(volume)) {
      return { error: true, message: `지갑에 ${currencyName} 잔액이 부족합니다. 현재 잔액: ${currency.balance}, 요청 수량: ${volume}` }
    }
    // 수수료액 제외 수량 검사, 거래소의 트레이딩 거래가 아닌 직접 감소하는 경우 options.bypassFee 옵션을 통해 수수료를 제외하지 않을 수 있다.
    if (!options.bypassFee) {
      const fee = (volume * 0.0005).toFixed(8) * 1 // 0.05% 수수료
      const coinVolume = (volume - fee).toFixed(8) * 1 // 수수료를 제외한 실제 거래량
      const mininumLimitCoin = (5001/current_price).toFixed(8) * 1 // 5000원 이상이어야 함, 현재가로 나누어서 최소 수량을 계산
      if (parseFloat(coinVolume) < mininumLimitCoin) {
        return { error: true, message: `지갑에서 ${currencyName}를 감소할 수 없습니다. 최소 ${mininumLimitCoin} 이상이어야 합니다.` }
      }
    }
    currency.balance = (parseFloat(currency.balance) - parseFloat(volume)).toFixed(8) * 1
  }

  await cache.saveWalletCache(wallet)
  // log.info(`지갑에서 ${currencyName} 제거: 수량 ${volume}, 현재 잔액 ${currency.balance}`)

  return { error: false, message: `${currencyName} 지갑에서 ${volume} 감소`}
}







// @ 매수 또는 매도 주문내역 만들기
backtest.createOrder = async (store, identity, side, price, volume, at = new Date()) => {
  if (!identity || !side || !price || !volume) {
    log.error('주문 생성에 필요한 정보가 부족합니다.')
    return null
  }
  const { orders } = store

  const curAt = at

  // "KRW-BTC" -> "BTC" 또는 "BTC"
  const currencyName = identity.includes('-') ? identity.split('-')[1] : identity
  const market = `KRW-${currencyName}`
  
  const order = {
    uuid: uuidv4(),
    market,
    ord_type: "market",
    side: side, // 'bid' 또는 'ask'
    price: price, // 현재가
    volume: volume, // 수량
    state: 'done', // 백테스트라, 바로 done으로 처리
    created_at: curAt.toISOString(), // 주문 생성 시간
    identity: identity, // 주문을 요청한 사용자 식별자
  }

  orders.push(order)
  
  // 주문내역이 변동이 되면 해당 마켓명칭(market)의 주문건을 모아 캐시를 저장
  const marketOrders = _.orderBy(orders.filter(o => o.market === market), ['created_at'], ['desc'])
  await cache.saveOrderCacheByMarket(market, marketOrders)

  return order
}

// 매수대기 상태의 내역을 찾기
backtest.getWaitOrders = async (store, identity) => {
  const { orders } = store
  const currencyName = identity.includes('-') ? identity.split('-')[1] : identity
  const market = `KRW-${currencyName}`
  return orders.filter(o => o.market === market && o.state === 'wait')
}

// 매수와 매도 목록 가져오기
backtest.getDoneOrders = async (store, identity) => {
  const { orders } = store
  const currencyName = identity.includes('-') ? identity.split('-')[1] : identity
  const market = `KRW-${currencyName}`
  return orders.filter(o => o.market === market && o.state === 'done')
}

// 특정 UUID 주문내역 가져오기
backtest.getOrderByUuid = async (store, uuid) => {
  const { orders } = store
  return orders.find(o => uuid && o.uuid === uuid)
}








/*
@ 매수 기능
*/
backtest.bidByKrw = async (store, identity, volume = 0, price, at = new Date()) => {
  const curMt = moment(at), curFt = curMt.format('YYYY-MM-DD HH:mm:ss')

  const { wallet, tickers } = store
  if (!identity || !volume) { return }

  // "KRW-BTC" -> "BTC" 또는 "BTC"
  const currencyName = identity.includes('-') ? identity.split('-')[1] : identity
  const current_price = price || (tickers[`KRW-${currencyName}`] && tickers[`KRW-${currencyName}`].trade_price)
  if (!current_price) {
    log.error(`🔴 [매수실패] 현재 시세정보가 없습니다. ${identity}의 시세를 확인해주세요.`)
    return wallet    
  }

  // 수수료 산정
  const fee = (volume * 0.0005).toFixed(1) * 1
  const krwVolume = (volume - fee).toFixed(1) * 1 // 수수료를 제외한 원화 교환량
  const coinVolume = (krwVolume/current_price).toFixed(8) * 1 // 실제 수량

  // 지갑에 원화를 감소시킨 후, 매수 주문서를 생성하면서 매수한 종목을 지갑에 담아주기
  const result = await backtest.subtractCurrencyFromWallet(store, 'KRW', volume, current_price) // KRW 감소
  if (result.error) {
    log.msg(`🔴 [매수실패] ${curFt} : ${identity}, ${result.message}`, 'fail')
    return wallet
  }
  await backtest.createOrder(store, identity, 'bid', current_price, coinVolume, curMt.toDate()) // 매수 주문서 생성
  await backtest.addCurrencyToWallet(store, identity, coinVolume, current_price) // Coin Volumne 증가

  // 원화잔액
  const krwWallet = store.wallet.find(w => w.currency === 'KRW')
  log.msg(`🟢 [매수] ${curFt} : ${identity}, ${krwVolume.toLocaleString()}원(${coinVolume} ${currencyName}, 시세 ${parseFloat(current_price).toLocaleString()}원, 원화잔액 ${parseFloat(krwWallet.balance).toLocaleString()}원)`, 'success')

  return wallet
}

/*
@ 매도 기능
*/
backtest.askByCoinVolume = async (store, identity, volume = 0, price, at = new Date()) => {
  const curMt = moment(at), curFt = curMt.format('YYYY-MM-DD HH:mm:ss')

  const { wallet, tickers } = store
  if (!identity || !volume) {
    log.error(`🔴 [매도실패] identity나 volume 정보가 없습니다. identity: ${identity}, volume: ${volume}`)
    return wallet
  }

  // "KRW-BTC" -> "BTC" 또는 "BTC"
  const currencyName = identity.includes('-') ? identity.split('-')[1] : identity
  const current_price = price || (tickers[`KRW-${currencyName}`] && tickers[`KRW-${currencyName}`].trade_price)
  if (!current_price) {
    log.error(`🔴 [매도실패] 현재 시세정보가 없습니다. ${identity}의 시세를 확인해주세요.`)
    return wallet
  }

  // 수수료 산정
  const fee = (volume * 0.0005).toFixed(8) * 1 // 0.05% 수수료
  const coinVolume = (volume - fee).toFixed(8) * 1 // 수수료를 제외한 실제 거래량
  const krwVolume = ((volume - fee) * current_price).toFixed(1) * 1
  
  // 지갑에서 코인량을 감소시킨 후, 매도 주문서를 생성하면서 원화를 지갑에 담아주기
  const result = await backtest.subtractCurrencyFromWallet(store, identity, coinVolume, current_price) // Coin Volume 감소
  if (result.error) {
    log.msg(`🔴 [매도실패] ${curFt} : ${identity}, ${result.message}`, 'fail')
    return wallet
  }
  await backtest.createOrder(store, identity, 'ask', current_price, coinVolume, curMt.toDate()) // 매도 주문서 생성
  await backtest.addCurrencyToWallet(store, 'KRW', krwVolume) // KRW 증가

  log.msg(`🟢 [매도] ${curFt} : ${identity}, ${krwVolume.toLocaleString()}원(${coinVolume} ${currencyName}, 시세 ${current_price.toLocaleString()}원)`, 'warn')
  
  return wallet  
}

export default backtest
