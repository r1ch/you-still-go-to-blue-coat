window.config.QUIET = true

const checkVersion = ()=>{
  fetch(`https://ysgtb.bradi.sh/version?${Date.now()}`)
  .then(response=>{
    response.text()
      .then(text=>{
      if(text!==window.config.version){
        location.reload();
      }
    })
  })
  .catch(err=>{
    clearInterval(checker)
  })
}

const checker = setInterval(checkVersion,500)
