package adapterutil

import (
	"net/http"
	"strconv"
	"strings"
	"time"
)

func ParseRetryAfter(value string, now time.Time) (time.Time, bool) {
	value = strings.TrimSpace(value)
	if seconds, err := strconv.ParseInt(value, 10, 64); err == nil && seconds >= 0 && seconds <= int64((1<<63-1)/time.Second) {
		return now.Add(time.Duration(seconds) * time.Second), true
	}
	if at, err := http.ParseTime(value); err == nil {
		if at.Before(now) {
			return now, true
		}
		return at, true
	}
	return time.Time{}, false
}
