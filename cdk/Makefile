build: app cdksynth

buildcdk:
	npm install && npm run build

cdksynth: buildcdk
	npx cdk -v synth ClipsBackend
	npx cdk -v synth ClipsUI

deploy: build
	npx cdk -v deploy ClipsBackend --outputs-file tempvars.json
	node repack.js
	rm tempvars.json
	npx cdk -v deploy ClipsUI

app:
	cd ../clips && make build

bootstrap: app
	npx cdk bootstrap