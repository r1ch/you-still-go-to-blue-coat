window.config.QUIET = true

const checkVersion = ()=>{
  fetch("https://ysgtb.bradi.sh/version")
  .then(response=>console.log(response.status))
  .catch(err=>console.error(err))
}

setInterval(checkVersion,500)
