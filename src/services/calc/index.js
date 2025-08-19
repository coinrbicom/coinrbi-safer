// 평단가 계산기
function getAveragePrice(originalBalance = 0, originalPrice = 0, additionBalance = 0, additionPrice = 0) {
  if (originalBalance === 0 && originalPrice === 0) {
    return additionPrice; // 처음 매수하는 경우
  }
  
  if (additionBalance === 0 && additionPrice === 0) {
    return originalPrice; // 추가 매수하지 않는 경우
  }

  const totalBalance = parseFloat(originalBalance) + parseFloat(additionBalance);
  const totalPrice = (parseFloat(originalPrice) * parseFloat(originalBalance)) + (parseFloat(additionPrice) * parseFloat(additionBalance));
  
  if (totalBalance === 0) {
    return 0; // 나누기 0 방지
  }
  
  return Math.round((totalPrice / totalBalance) * 100000000) / 100000000; // 소수점 8자리까지 반올림
}

// 현재 수익률 계산하기
function getCurrentRate(currentPrice, avgBuyPrice, quantity) {
  if (avgBuyPrice === 0 || quantity === 0) {
    return 0;
  }
  const profit = (currentPrice - avgBuyPrice) * quantity;
  const rate = (profit / (avgBuyPrice * quantity)) * 100;
  return Math.round(rate * 100) / 100; // 소수점 2자리까지 반올림
}

export default { getAveragePrice, getCurrentRate }
