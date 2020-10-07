window.config.QUIET = true

const checkVersion = ()=>{
  fetch("https://ysgtb.bradi.sh/version")
  .then(console.log)
}

setInterval(checkVersion,500)
