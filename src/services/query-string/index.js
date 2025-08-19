const qs = {}

// @ 객체 -> 문자열 변환
qs.stringify = (params = {}) => {
  const URLSearchParams = new URLSearchParams()
  Object.keys(params).forEach(key => {
    if (Array.isArray(params[key])) {
      params[key].forEach(value => URLSearchParams.append(key, value))
    } else {
      URLSearchParams.append(key, params[key])
    }
  })
  return URLSearchParams.toString()
}

// @ 문자열 -> 객체 변환
qs.parse = (queryString = '') => {
  const URLSearchParams = new URLSearchParams(queryString)
  const params = {}
  for (const [key, value] of URLSearchParams.entries()) {
    if (params[key]) {
      if (Array.isArray(params[key])) {
        params[key].push(value)
      } else {
        params[key] = [params[key], value]
      }
    } else {
      params[key] = value
    }
  }
  return params  
}

export default qs
