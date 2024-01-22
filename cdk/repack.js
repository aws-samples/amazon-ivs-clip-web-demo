const { readFileSync } = require('fs');

const tempvars = readFileSync('tempvars.json');

const tempvars2= (JSON.parse(tempvars));

const publicConfig = { 
  api: tempvars2.ClipsBackend.api,
  playbackURL: tempvars2.ClipsBackend.playbackUrl
}

const { writeFileSync } = require('fs');

const path = '../web-ui/config.json';

try {
  writeFileSync(path, JSON.stringify(publicConfig, null, 2), 'utf8');
  console.log('Data successfully saved to disk');
} catch (error) {
  console.log('An error has occurred ', error);
}
