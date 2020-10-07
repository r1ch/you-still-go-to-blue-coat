window.config.QUIET = true

const checkVersion = ()=>{
  fetch("https://ysgtb.bradi.sh/version")
  .then(response=>console.log(JSON.stringify(response)))
}

setInterval(checkVersion,500)
