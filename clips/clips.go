package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io/ioutil"
	"os"
	"path"
	"regexp"

	"github.com/aws-samples/amazon-ivs-clip-web-demo/clips/hls"
	"github.com/aws-samples/amazon-ivs-clip-web-demo/clips/remux"
	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3/s3manager"
	"github.com/google/uuid"
)

type Response struct {
	URL   string `json:",omitempty"`
	Error string `json:",omitempty"`
}

//Regex to verify that the clip requests is in the same AWS account as the lambda.
var channelPattern = regexp.MustCompile(`^https:\/\/[a-z0-9]+\.([a-z0-9-]+)\.playback.live-video.net\/api\/video\/v[0-9]\/([a-z0-9-]+)\.([0-9]+)\.channel\.([a-zA-Z0-9]+)\.m3u8$`)

func main() {
	lambda.Start(clip)
}

func clip(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {

	///////////
	// Sanity check the input
	///////////

	//Check if request has "channel" parameter
	var channel string
	if val, ok := request.QueryStringParameters["channel"]; ok {
		channel = val
	} else {
		return events.APIGatewayProxyResponse{
			StatusCode: 400,
			Headers:    map[string]string{"Access-Control-Allow-Origin": "*"},
			Body:       encodeErrorResponse("Please provide a channel"),
		}, nil
	}

	//Does the URL match the pattern?
	if !channelPattern.MatchString(channel) {
		return events.APIGatewayProxyResponse{
			StatusCode: 400,
			Headers:    map[string]string{"Access-Control-Allow-Origin": "*"},
			Body:       encodeErrorResponse("Please provide an accepted playback url"),
		}, nil
	}

	//Extract the AWS Account ID and make sure it matches the lambda is currently running in.
	match := channelPattern.FindStringSubmatch(channel)
	if request.RequestContext.AccountID != match[3] {
		return events.APIGatewayProxyResponse{
			StatusCode: 400,
			Headers:    map[string]string{"Access-Control-Allow-Origin": "*"},
			Body:       encodeErrorResponse("Please provide an allowlisted playback url"),
		}, nil
	}

	///////////
	// Perform the segment download & stitch
	///////////

	// Download the segments for a given manifest URL.
	segments, err := hls.GetSegments(channel)
	if err != nil {
		return events.APIGatewayProxyResponse{
			StatusCode: 500,
			Headers:    map[string]string{"Access-Control-Allow-Origin": "*"},
			Body:       encodeErrorResponse("Could not clip."),
		}, nil
	}

	// Stitch together the segments using FFmpeg and write a new .mp4 into /tmp
	filename := uuid.New().String() + ".mp4"
	tempPath := path.Join("/tmp/" + filename)
	err = remux.Remux(segments, tempPath)
	if err != nil {
		return events.APIGatewayProxyResponse{
			StatusCode: 500,
			Headers:    map[string]string{"Access-Control-Allow-Origin": "*"},
			Body:       encodeErrorResponse("Could not clip."),
		}, nil
	}

	///////////
	// Upload the segement to S3
	///////////

	// Read generated .mp4 back into memory
	mp4, err := ioutil.ReadFile(tempPath)
	if err != nil {
		return events.APIGatewayProxyResponse{
			StatusCode: 500,
			Headers:    map[string]string{"Access-Control-Allow-Origin": "*"},
			Body:       encodeErrorResponse("Could not clip."),
		}, nil
	}

	// Upload file to S3 from memory
	sess := session.Must(session.NewSession())
	uploader := s3manager.NewUploader(sess)
	_, err = uploader.Upload(&s3manager.UploadInput{
		Bucket: aws.String(os.Getenv("bucket")),
		Key:    aws.String(path.Join("clips/", filename)),
		Body:   bytes.NewReader(mp4),
	})

	if err != nil {
		return events.APIGatewayProxyResponse{
			StatusCode: 500,
			Headers:    map[string]string{"Access-Control-Allow-Origin": "*"},
			Body:       encodeErrorResponse("Could not clip."),
		}, nil
	}

	os.Remove(tempPath)

	// Respond with URL to clip

	rs := Response{
		URL: "https://" + path.Join(os.Getenv("url"), "clips/", filename),
	}

	resp, _ := json.Marshal(rs)

	return events.APIGatewayProxyResponse{
		StatusCode: 200,
		Headers:    map[string]string{"Access-Control-Allow-Origin": "*"},
		Body:       string(resp),
	}, nil

}

func encodeErrorResponse(err string) string {
	rs := Response{
		Error: err,
	}

	resp, _ := json.Marshal(rs)
	return string(resp)

}
