window.config.QUIET = true

const checkVersion = ()=>{
  fetch(`https://ysgtb.bradi.sh/revision?${Date.now()}`)
  .then(response=>{
    response.text()
      .then(latestRevision=>{
      if(latestRevision!==revision){
        console.log(`${latestRevision}!=${revision}`)
        //location.reload();
      }
    })
  })
  .catch(err=>{
    clearInterval(checker)
  })
}

const checker = setInterval(checkVersion,500)
