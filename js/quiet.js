window.config.QUIET = true

const checkVersion = ()=>{
  fetch(`https://ysgtb.bradi.sh/version?${Date.now()}`)
  .then(response=>{
    console.log(response.status)
    response.text().then(console.log)
  })
  .catch(err=>console.error(err))
}

setInterval(checkVersion,500)
