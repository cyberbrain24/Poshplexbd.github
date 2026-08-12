# Build Stage
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Copy dependency files first for caching
COPY go.mod ./
# (If we had go.sum, we would copy it here too: COPY go.sum ./)

# Download dependencies
RUN go mod download

# Copy the rest of the source code
COPY . .

# Build a statically linked binary
# CGO_ENABLED=0 ensures it runs without C libraries on Alpine/Scratch
# -ldflags="-w -s" strips debugging info to reduce the binary size
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o webhook-shield .

# Final Stage: Minimal Runtime Environment
FROM alpine:latest

# Add ca-certificates in case we need to make outbound HTTPS calls later
RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy the pre-built binary from the builder stage
COPY --from=builder /app/webhook-shield .

# Expose the default port
EXPOSE 8080

# Run the binary
CMD ["./webhook-shield"]
