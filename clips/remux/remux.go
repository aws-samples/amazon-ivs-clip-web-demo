package remux

import (
	"errors"
	"io/ioutil"
	"log"
	"os/exec"
	"syscall"

	"github.com/aws-samples/amazon-ivs-clip-web-demo/clips/hls"
)

func Remux(segments []hls.Segment, path string) error {

	var buffer []byte
	for _, b := range segments {
		buffer = append(buffer, b.Data...)
	}

	cmd := exec.Command("/opt/bin/ffmpeg", "-f", "mpegts", "-i", "pipe:", "-c", "copy", "-f", "mp4", path)
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return err
	}

	go func() {
		defer stdin.Close()
		stdin.Write(buffer)
	}()

	cmd.Start()

	slurp, err := ioutil.ReadAll(stderr)
	if err != nil {
		log.Fatal(err)
	}

	if err := cmd.Wait(); err != nil {

		if exiterr, ok := err.(*exec.ExitError); ok {

			if status, ok := exiterr.Sys().(syscall.WaitStatus); ok {
				ex := status.ExitStatus()
				if ex == -1 || ex == 255 {
				} else {
					return errors.New(string(slurp))
				}
			}
		}

	}

	return nil
}
