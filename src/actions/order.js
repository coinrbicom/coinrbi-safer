import config from '../config.js'

import upbit from '../services/upbit/index.js'
import backtest from '../services/backtest/index.js'

import log from '../services/log/index.js'

async function bidByKrw (store, identity, volume, price, at) {
  const { wallet, tickers } = store

  // 백테스트 모드인 경우
  if (config.backtest) { return await backtest.bidByKrw(store, identity, volume, price, at) }

  if (!identity || !volume) {
    log.msg(`🔴 [매수실패] identity나 volume 정보가 없습니다. identity: ${identity}, volume: ${volume}`, 'fail')
    return wallet
  }

  // 현재가 시세정보를 불러오기
  const currencyName = identity.includes('-') ? identity.split('-')[1] : identity
  const current_price = price || (tickers[`KRW-${currencyName}`] && tickers[`KRW-${currencyName}`].trade_price)
  if (!current_price) {
    log.msg(`🔴 [매수실패] 현재 시세정보가 없습니다. ${identity}의 시세를 확인해주세요.`, 'fail')
    return wallet    
  }

  // 수수료 산정
  const fee = (volume * 0.0005).toFixed(1) * 1
  const krwVolume = (volume - fee).toFixed(1) * 1 // 수수료를 제외한 원화 교환량
  const coinVolume = (krwVolume/current_price).toFixed(8) * 1 // 실제 수량

  // 원화지갑 가져오기
  const krwWallet = wallet.find(w => w.currency === 'KRW')
  const krwBalance = parseFloat(krwWallet ? krwWallet.balance : 0).toFixed(1) * 1
  const minimumLimitKrw = 5001 // 5000원 이지만 딱 5천원이면 안된다.

  if (krwBalance < volume) {
    log.msg(`🔴 [매수실패] ${currencyName} : 현재 지갑의 원화가 부족합니다. (현재 원화잔고 ${krwBalance.toLocaleString()}원, 필요한 원화 ${krwVolume.toLocaleString()}원)`, 'fail')
    return wallet
  }
  if (krwVolume < minimumLimitKrw) {
    log.msg(`🔴 [매수실패] ${currencyName} : 매수할 양이 최소 구매액(${minimumLimitKrw.toLocaleString()}원)보다 적습니다. (현재 ${krwVolume.toLocaleString()}원 요청됨)`, 'fail')
    return wallet
  }

  const result = await upbit.bidByKrw(`KRW-${currencyName}`, volume)
  if (result.error) {
    log.msg(`🔴 [매수실패] ${currencyName} : 매수 주문에 실패했습니다.`, 'fail')
    log.msg(JSON.stringify(result, null, null), 'notice')
    return wallet
  }

  // 지갑정보를 업데이트
  await store.update()

  log.msg(`🟢 [매수] ${curFt} : ${identity}, ${krwVolume.toLocaleString()}원(${coinVolume} ${currencyName}, 시세 ${parseFloat(current_price).toLocaleString()}원, 원화잔액 ${krwBalance.toLocaleString()}원)`, 'success')
}

async function askByCoinVolume (store, identity, volume, price, at) {
  const { wallet, tickers } = store

  // 백테스트 모드인 경우
  if (config.backtest) { return await backtest.askByCoinVolume(store, identity, volume, price, at) }

  if (!identity || !volume) {
    log.msg(`🔴 [매수실패] identity나 volume 정보가 없습니다. identity: ${identity}, volume: ${volume}`, 'fail')
    return wallet
  }

  // 현재가 시세정보를 불러오기
  const currencyName = identity.includes('-') ? identity.split('-')[1] : identity
  const current_price = price || (tickers[`KRW-${currencyName}`] && tickers[`KRW-${currencyName}`].trade_price)
  if (!current_price) {
    log.msg(`🔴 [매수실패] 현재 시세정보가 없습니다. ${identity}의 시세를 확인해주세요.`, 'fail')
    return wallet    
  }

  // 실제 보유량이 매도할 양보다 적다면
  const coinWallet = wallet.find(w => w.currency === currencyName)
  if (!coinWallet || coinWallet.balance < volume) {
    // log.msg(`🔴 [매도실패] ${currencyName} : 보유량이 부족합니다. (현재 보유량 ${coinWallet ? coinWallet.balance : 0}, 요청된 매도량 ${coinVolume})`, 'fail')
    return wallet
  }

  // 수수료 산정
  const fee = (volume * 0.0005).toFixed(8) * 1 // 0.05% 수수료
  const coinVolume = (volume - fee).toFixed(8) * 1 // 수수료를 제외한 실제 거래량
  const krwVolume = (coinVolume * current_price).toFixed(1) * 1
  // 원화지갑 가져오기
  const krwWallet = wallet.find(w => w.currency === 'KRW')
  const krwBalance = parseFloat(krwWallet ? krwWallet.balance : 0).toFixed(1) * 1
  const minimumLimitKrw = 5001 // 5000원 이지만 딱 5천원이면 안된다.

  // 수수료를 포함한 매도금액이 적절한지 검증
  if (krwVolume < minimumLimitKrw) {
    // log.msg(`🔴 [매도실패] ${currencyName} : 매도를 할 양이 최소 ${minimumLimitKrw.toLocaleString()}원 이상이여야 합니다. (현재 : ${krwVolume.toLocaleString()}원)`, 'fail')
    return wallet
  }

  const result = await upbit.askByCoinVolume(`KRW-${currencyName}`, volume)
  if (result.error) {
    log.msg(`🔴 [매도실패] ${currencyName} : 매도 주문에 실패했습니다.`, 'fail')
    log.msg(JSON.stringify(result, null, null), 'notice')
    return wallet
  }

  // 지갑정보를 업데이트
  await store.update()

  log.msg(`🟢 [매도] ${curFt} : ${identity}, ${krwVolume.toLocaleString()}원(${coinVolume} ${currencyName}, 시세 ${parseFloat(current_price).toLocaleString()}원, 원화잔액 ${krwBalance.toLocaleString()}원)`, 'success')
}

// 전체 주문내역 불러오기
async function getDoneOrders(store, market, limit, startAt, endAt, order_by) {
  if (config.backtest) { return await backtest.getDoneOrders(store, market) }

  // Live 모드의 경우, 여기서 체크

  return await upbit.getDoneOrders(market, limit, startAt, endAt, order_by)
}





// 특정종목의 매수 주문내역 가져오기
async function getBidOrdersByMarket(store, market, limit, startAt, endAt, order_by) {
  const orders = await getDoneOrders(store, market, limit, startAt, endAt, order_by)
  return orders.filter(order => order.side === 'bid')
}

// 특정종목의 매도 주문내역 가져오기
async function getAskOrdersByMarket(store, market, limit, startAt, endAt, order_by) {
  const orders = await getDoneOrders(store, market, limit, startAt, endAt, order_by)
  return orders.filter(order => order.side === 'ask')
}

export default {
  bidByKrw,
  askByCoinVolume,
  getDoneOrders,
  getBidOrdersByMarket,
  getAskOrdersByMarket
}
