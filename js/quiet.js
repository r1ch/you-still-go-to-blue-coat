window.config.QUIET = true

const checkVersion = ()=>{
  fetch(`https://ysgtb.bradi.sh/revision?${Date.now()}`)
  .then(response=>{
    response.text()
      .then(latestRevision=>{
      if(latestRevision.trim()!=revision){
        console.log(`Different version detected : ${latestRevision} v.s. ${revision}`)
        location.reload();
      }
    })
  })
  .catch(err=>{
    clearInterval(checker)
  })
}

const checker = setInterval(checkVersion,500)
