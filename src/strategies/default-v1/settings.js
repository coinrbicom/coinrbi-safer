const settings = {}

settings.commons = {
  interval: '240', // 매매 주시간봉
  candleCount: 200, // 분석할 캔들 총 갯수
  scopeCandleCount: 10, // 최종 캔들 판정 갯수
  basis: 'trade_price', // 판정기준 opening_price(시가), trade_price(종가)
  bidBat: 30000, // 매수 베팅 금액
  askBat: 30000, // 매도 베팅 금액
  operator: 'MACD' // 👁️ 매수매도 조건에 사용할 인디케이터
}

// 👁️ 인디케이터 기본 설정 : 매수매도 조건과 별개로 인디케이터 옵션은 두어야 합니다.
const indicatorOptions = {
  MACD: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
  RSI: { period: 14 },
  WR: { period: 14 }
}

// 매수bid / 매도ask 조건 결정
const bidConditions = [], askConditions = []

// 매수매도 생성 공식 함수
const c = (indicator = 'MACD', conditions = []) => {
  return conditions.map(condition => {
    const { cross, pattern, min, max, rate } = condition
    if (cross) { return { indicator, cross, min, max, rate } }
    if (pattern) { return { indicator, pattern, min, max, rate } }
    return null
  }).filter(c => c !== null)
}

// 📜 MACD를 사용하는 경우
if (settings.commons.operator  ==='MACD') {
  bidConditions.push(
    ...c('MACD', [
      { cross: 'golden', min: -0.05, max: 0.05, rate: 1.0 },
      { cross: 'none', min: -0.15, max: -0.05, rate: 2.0 },
      // { cross: 'none', min: -0.30, max: -0.15, rate: 3.0 }
    ]))
  askConditions.push(
    ...c('MACD', [
      { cross: 'death', min: -0.01, max: 0.01, rate: 0.33 },
      { cross: 'none', min: 0.05, max: 0.1, rate: 0.5 },
      { cross: 'none', min: 0.1, max: 0.3, rate: 1 }
    ]))
}

// 📜 RSI을 사용하는 경우
if (settings.commons.operator === 'RSI') {
  bidConditions.push(
    ...c('RSI', [
      { pattern: 'w', min: 0, max: 30, rate: 1.0 },
      { pattern: 'w', min: 30, max: 70, rate: 2.0 },
      { pattern: 'w', min: 70, max: 100, rate: 3.0 }
    ]))
  askConditions.push(
    ...c('RSI', [
      { pattern: 'm', min: 70, max: 100, rate: 0.33 },
      { pattern: 'm', min: 30, max: 70, rate: 0.5 },
      { pattern: 'm', min: 0, max: 30, rate: 1 }
    ]))
}

// 📜 WR을 사용하는 경우
if (settings.commons.operator === 'WR') {
  bidConditions.push(
    ...c('WR', [
      { pattern: 'w', min: -100, max: -70, rate: 1.0 },
      { pattern: 'w', min: -70, max: -30, rate: 2.0 },
      { pattern: 'w', min: -30, max: 0, rate: 3.0 }
    ]))
  askConditions.push(
    ...c('WR', [
      { pattern: 'm', min: -30, max: -10, rate: 0.33 },
      { pattern: 'm', min: -70, max: -30, rate: 0.5 },
      { pattern: 'm', min: -100, max: -70, rate: 1 }
    ]))
}

// 설정 내보내기
export default {
  ...settings.commons,
  indicatorOptions,
  bidConditions, askConditions
}
