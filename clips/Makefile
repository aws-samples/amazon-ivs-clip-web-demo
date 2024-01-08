clean:
	rm -rf ../bin

build: clean
	GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o ../bin/clips clips.go
	rm -f ../bin/clips.zip && zip -r ../bin/clips.zip ../bin/clips