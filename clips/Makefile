clean:
	rm -rf ../bin

build: clean
	GOOS=linux go build -o ../bin/clips clips.go
	rm -f ../bin/clips.zip && zip -r ../bin/clips.zip ../bin/clips