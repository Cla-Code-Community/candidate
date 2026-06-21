# ── Build stage ─────────────────────────────────────────────
FROM golang:1.26-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build \
    -trimpath \
    -ldflags="-s -w" \
    -o /go-scraper ./cmd/server

# ── Runtime stage ───────────────────────────────────────────
FROM alpine:3.20

RUN apk --no-cache add ca-certificates wget

WORKDIR /app

COPY --from=builder /go-scraper /go-scraper

COPY --from=builder /app/internal/keywords/keywords.json  ./internal/keywords/keywords.json
COPY --from=builder /app/internal/interfaces              ./internal/interfaces

EXPOSE 8081

ENV GO_SCRAPER_ADDR=:8081

ENTRYPOINT ["/go-scraper"]