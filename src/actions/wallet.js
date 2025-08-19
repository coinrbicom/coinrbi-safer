import Table from 'cli-table3'

import config from '../config.js'

import upbit from '../services/upbit/index.js'
import backtest from '../services/backtest/index.js'

import marketActions from './market.js'

import log from '../services/log/index.js'
import calc from '../services/calc/index.js'

// 내 지갑정보 가져오기
async function getWallet(store) {
  if (config.backtest) { return await backtest.getWallet(store) }
  store.wallet = await upbit.getWallet()
  return store.wallet
}

// 현재 지갑을 표현하는 기능
async function prettyWallet(store = {}) {
  const { wallet, tickers } = store;
  if (!Array.isArray(wallet) || wallet.length === 0) return;

  // 1. Skip items with no price or ticker info
  // 2. Skip items with avg_buy_price 0, except KRW
  // 3. KRW always first

  const calcProfit = (avg, price) => {
    if (!avg || avg === '0') return '-';
    return (((price - avg) / avg) * 100).toFixed(2) + '%';
  };

  const calcProfitAmount = (avg, price, balance) => {
    if (!avg || avg === 0) return '-';
    return ((price - avg) * balance).toFixed(2);
  };

  const calcCurrentValue = (price, balance) => {
    if (!price) return '-';
    return (price * balance).toFixed(2);
  };

  const getPrice = (currency) => {
    if (!tickers) return null;
    const ticker = tickers.find(t => t.market.endsWith('-' + currency));
    return ticker ? Number(ticker.trade_price) : null;
  };

  let rows = wallet
    .filter(item => {
      if (item.currency === 'KRW') return true;
      if (!tickers) return false;
      const price = getPrice(item.currency);
      if (!price) return false;
      if (item.avg_buy_price === '0') return false;
      return true;
    })
    .map(item => {
      const isKRW = item.currency === 'KRW';
      const price = isKRW ? 1 : getPrice(item.currency);
      const avg = Number(item.avg_buy_price);
      const balance = Number(item.balance);
      const profit = isKRW ? '-' : calcProfit(avg, price);
      const profitAmount = isKRW ? '-' : calcProfitAmount(avg, price, balance);
      const currentValue = isKRW ? balance.toFixed(2) : calcCurrentValue(price, balance);
      return {
        symbol: item.currency,
        balance: balance,
        avgPrice: avg,
        price: price,
        profit: profit,
        profitAmount: profitAmount,
        currentValue: currentValue
      };
    });

  rows.sort((a, b) => (a.symbol === 'KRW' ? -1 : b.symbol === 'KRW' ? 1 : 0));
  // 표가 뒤틀리는 문제는 padEnd, padStart로 한글/영문/숫자 조합에서 발생할 수 있습니다.
  // 예쁜 표를 만들려면 'cli-table3' 같은 라이브러리를 추천합니다.
  // 설치: npm install cli-table3


  const table = new Table({
    head: ['심볼', '보유량', '평균단가', '시세', '현재수익률', '수익액', '보유가치'],
    colAligns: ['left', 'right', 'right', 'right', 'right', 'right', 'right'],
    style: { head: ['cyan'], border: ['grey'] }
  });

  rows.forEach(r => { table.push([ r.symbol, r.balance.toFixed(2), r.avgPrice.toFixed(2), r.price.toFixed(2), r.profit, parseInt(r.profitAmount).toFixed(0), parseInt(r.currentValue).toFixed(0) ]) });

  const header = '';
  const body = table.toString();
  const footer = '';

  return `${header}\n${body}\n${footer}`;
}

// 내 자산 총가치 원화계산
async function getTotalAssets(store) {
  const { wallet, tickers } = store
  if (!wallet || !tickers) { return 0 }

  let totalAssets = 0
  for (const my of wallet) {
    // 👛 원화라면 balance 합산
    if (my.currency === 'KRW') {
      totalAssets = totalAssets + parseFloat(my.balance)
    }

    // 👛 원화가 아나리면 balance * 현재가를 곱해서 원화 환산 한 후 합산
    if (my.currency !== 'KRW') {
      const ticker = tickers.find(t => t.market === `KRW-${my.currency}`)
      if (ticker) {
        const krwVolume = ticker.trade_price ? parseFloat(my.balance) * parseFloat(ticker.trade_price) : 0
        totalAssets = totalAssets + krwVolume
      }
    }
  }

  return totalAssets
}

// 현재평단과 현재 시장가 대비 수익금을 체크해보려는 과정
async function getCurrentRate(store, market) {
  const { wallet, tickers } = store

  const myMarket = wallet.find(m => m.market === market)
  if (!myMarket) { return 0 }

  const ticker = tickers.find(t => t.market === market)
  if (!ticker) { return 0 }

  const currentRate = calc.getCurrentRate(ticker.trade_price, myMarket.avg_buy_price, myMarket.quantity)
  return currentRate
}

export default { getWallet, prettyWallet, getTotalAssets, getCurrentRate }
