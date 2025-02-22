const logger = (req, res, next) => {
  console.log(`${req.method} request`)
  console.log(`URL: ${req.url}`)


  next()
}

export default logger