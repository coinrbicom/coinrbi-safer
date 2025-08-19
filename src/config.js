// 🤖 실행간격
const interval = 1000 * 60 // 5분마다 실행
const errorInterval = 1000 * 60 * 5 // 에러 발생시 5분 대기

// 🕧 backtest 모드 활성화 여부 : 과거 기준 설정했던 내역이 올바르게 수익성이 나오는지 점검하는 기능
const backtest = { balance: 1000000, markets: ['KRW-BTC', 'KRW-ETH'] } // 백테스트 시 사용할 원화 금액, 값이 false이면 백테스트 모드 종료
// const backtest = false

// 🔥시장설정
const currencies = ['KRW'] // 원화 마켓으로 설정
const dangerousMarkets = ['KRW-BTT'] // ['KRW-BTT', 'KRW-BTC'] 처럼 구분해 넣기
const clearCloseMarket = true // 상장폐지 종목 : true 명시시 자동 정리, false 두기

// 📜 사용할 전략
const strategies = ['default-v1']

// ⚙️ 설정 종합
const config = {}
config.env = process.env.NODE_ENV || 'development'
config.isDev = config.env === 'development'? true : false
config.isProd = config.env === 'production'? true : false

config.cacheDir = './.caches' // 캐시 디렉토리
config.logsDir = './.logs' // 로그 디렉토리

// 💹 업비트 사용 가능한 API 연결
const apiUrl = 'https://api.upbit.com'
const accessKey = process.env.UPBIT_ACCESS_KEY || ''
const secretKey = process.env.UPBIT_SECRET_KEY || ''

export default { ...config, currencies, backtest, apiUrl, accessKey, secretKey, dangerousMarkets, clearCloseMarket, strategies, interval, errorInterval }