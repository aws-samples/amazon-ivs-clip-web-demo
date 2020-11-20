const jsonfile = require('jsonfile')
const file = 'tempvars.json'

let tempvars = jsonfile.readFileSync(file)

let publicConfig = { 
  api: tempvars.ClipsBackend.api,
  playbackURL: tempvars.ClipsBackend.playbackUrl
}

jsonfile.writeFileSync("../web-ui/config.json", publicConfig)