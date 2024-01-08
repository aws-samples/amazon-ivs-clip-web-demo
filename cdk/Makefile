build: app cdksynth

buildcdk:
	npm install && npm run build

cdksynth: buildcdk
	npx cdk -v synth ClipsBackend
	npx cdk -v synth ClipsUI

deploy: build
	cdk deploy -v --outputs-file tempvars.json ClipsBackend
	node repack.js
	rm tempvars.json
	cdk deploy -v ClipsUI

app:
	cd ../clips && make build

bootstrap: app
	npx cdk bootstrap