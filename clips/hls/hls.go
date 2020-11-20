package hls

import (
	"errors"
	"fmt"
	"io/ioutil"
	"net/http"
	"sort"

	"github.com/grafov/m3u8"
)

type Segment struct {
	SequenceID uint64
	Data       []byte
}

func GetSegments(playbackURL string) ([]Segment, error) {

	masterManifest, err := getMasterManifest(playbackURL)
	if err != nil {
		return nil, err
	}

	topVariant := extractTopVariant(masterManifest.Variants)

	playlist, err := getPlaylist(topVariant.URI)
	if err != nil {
		return nil, err
	}

	return downloadSegments(playlist.Segments)

}

func getMasterManifest(playbackURL string) (*m3u8.MasterPlaylist, error) {
	resp, err := http.Get(playbackURL)
	if err != nil {
		return nil, err
	}

	defer resp.Body.Close()

	p, listType, err := m3u8.DecodeFrom(resp.Body, true)
	if err != nil {
		return nil, err
	}

	switch listType {
	case m3u8.MASTER:
		masterPlaylist := p.(*m3u8.MasterPlaylist)
		return masterPlaylist, nil
	}

	return nil, fmt.Errorf("Could not decode master manifest.")
}

func getPlaylist(playlistURL string) (*m3u8.MediaPlaylist, error) {
	resp, err := http.Get(playlistURL)
	if err != nil {
		return nil, err
	}

	defer resp.Body.Close()

	p, listType, err := m3u8.DecodeFrom(resp.Body, true)
	if err != nil {
		return nil, err
	}

	switch listType {
	case m3u8.MEDIA:
		mediaPlaylist := p.(*m3u8.MediaPlaylist)
		return mediaPlaylist, nil
	}

	return nil, fmt.Errorf("Could not decode playlist.")
}

func extractTopVariant(v []*m3u8.Variant) m3u8.Variant {
	dm := &m3u8.Variant{}
	for _, v := range v {
		if v.Bandwidth > dm.Bandwidth {
			dm = v
		}
	}
	return *dm

}

func downloadSegments(segments []*m3u8.MediaSegment) ([]Segment, error) {

	var buffer []Segment
	numSegments := 0
	for _, s := range segments {
		if s != nil {
			numSegments++
		}
	}

	done := make(chan Segment, numSegments)
	errorChan := make(chan error, numSegments)

	for _, segment := range segments {
		if segment != nil {
			go func(URI string, seq uint64) {
				s, err := downloadSegment(URI, seq)
				if err != nil {
					errorChan <- err
					done <- s
					return
				}
				done <- s
				errorChan <- nil
			}(segment.URI, segment.SeqId)
		}
	}

	var errStr string
	for i := 0; i < numSegments; i++ {
		buffer = append(buffer, <-done)
		if err := <-errorChan; err != nil {
			errStr = errStr + " " + err.Error()
		}
	}
	if errStr != "" {
		return nil, errors.New(errStr)
	}

	sort.SliceStable(buffer, func(i, j int) bool {
		return buffer[i].SequenceID < buffer[j].SequenceID
	})

	return buffer, nil

}

func downloadSegment(URI string, sequenceID uint64) (Segment, error) {
	resp, err := http.Get(URI)
	if err != nil {
		return Segment{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return Segment{}, errors.New(resp.Status)
	}
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return Segment{}, err
	}
	return Segment{
		SequenceID: sequenceID,
		Data:       body,
	}, nil
}
