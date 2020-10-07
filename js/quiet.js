window.config.QUIET = true

const checkVersion = ()=>{
  fetch("https://ysgtb.bradi.sh/version.json")
  .then(console.log)
}

setInterval(checkVersion,500)
