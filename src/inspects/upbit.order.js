/*
  @ 인증 API가 정상적으로 구동이 되는지 경우의 수 체크하기
  1. upbit.getWallet
  2. upbit.getOrders
  2-1. upbit.getOrderByUuid
  3. upbit.bidByKrw
  4. upbit.askByCoinVolume
*/
import upbit from '../services/upbit/index.js'
import log from '../services/log/index.js'

Promise.resolve()
  .then(async () => {
    // const wallet = await upbit.getWallet()
    // log.debug('Wallet:')
    // log.debug(JSON.stringify(wallet, null, 2))

    // const waitOrders = await upbit.getWaitOrders('KRW-BTC')
    // log.debug('waitOrders:')
    // log.debug(JSON.stringify(waitOrders, null, 2))

    // const doneOrders = await upbit.getDoneOrders('KRW-ETH', 100)
    // log.debug('doneOrders:')
    // log.debug(JSON.stringify(doneOrders, null, 2))
    
    // const orders = doneOrders ? doneOrders.filter(order => order.side === 'ask') : []
    // log.debug('orders:')
    // log.debug(JSON.stringify(orders, null, 2))
    // if (orders && orders.length) {
    //   const orderDetails = await upbit.getOrderByUuid(orders.map(o => o.uuid))
    //   log.debug('Order Details by UUID:')
    //   log.debug(JSON.stringify(orderDetails, null, 2))
    // }

    // const result = await upbit.bidByKrw('KRW-BTC', 5050)
    // log.debug('Bid Order:')
    // log.debug(JSON.stringify(result, null, 2))

    // const askOrder = await upbit.askByCoinVolume('KRW-BTC', 0.001)
    // log.debug('Ask Order:')
    // log.debug(JSON.stringify(askOrder, null, 2))
  })

export default {}
