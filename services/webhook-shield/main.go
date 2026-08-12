package main

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"
)

var (
	rdb        *redis.Client
	ctx        = context.Background()
	queueName  = "poshplex_ai_webhook_queue"
)

func main() {
	// 1. Setup Structured Logger
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	// 2. Setup Redis Connection Pool
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379/0"
	}
	
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		slog.Error("Failed to parse REDIS_URL", "error", err)
		os.Exit(1)
	}
	
	// Optimize pool for high concurrency
	opts.PoolSize = 100
	opts.MinIdleConns = 10
	
	rdb = redis.NewClient(opts)
	
	// Test Redis connection
	if err := rdb.Ping(ctx).Err(); err != nil {
		slog.Error("Failed to connect to Redis", "error", err)
		os.Exit(1)
	}
	slog.Info("Connected to Redis queue successfully")

	// 3. Setup HTTP Router
	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/webhooks/meta", metaWebhookHandler)
	mux.HandleFunc("/webhooks/tiktok", tiktokWebhookHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	server := &http.Server{
		Addr:    ":" + port,
		Handler: mux,
	}

	// 4. Start Server with Graceful Shutdown
	go func() {
		slog.Info("Webhook shield listening on port " + port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("HTTP server error", "error", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("Shutting down webhook shield gracefully...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	if err := server.Shutdown(shutdownCtx); err != nil {
		slog.Error("Server forced to shutdown", "error", err)
	}
	rdb.Close()
	slog.Info("Shutdown complete")
}

// healthHandler is for Docker/Nginx to verify the service is alive.
func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("OK"))
}

// metaWebhookHandler catches payloads from Instagram/Messenger.
func metaWebhookHandler(w http.ResponseWriter, r *http.Request) {
	handleWebhook(w, r, "meta")
}

// tiktokWebhookHandler catches payloads from TikTok.
func tiktokWebhookHandler(w http.ResponseWriter, r *http.Request) {
	handleWebhook(w, r, "tiktok")
}

// handleWebhook is the core logic: read body, push to Redis, return 200 immediately.
func handleWebhook(w http.ResponseWriter, r *http.Request, platform string) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Read body quickly
	body, err := io.ReadAll(r.Body)
	if err != nil {
		slog.Error("Failed to read webhook body", "platform", platform, "error", err)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}
	defer r.Body.Close()

	// Push the raw JSON to Redis LPUSH immediately
	// Celery will POP this from the queue to process it asynchronously.
	err = rdb.LPush(ctx, queueName, body).Err()
	if err != nil {
		slog.Error("Failed to push webhook to Redis", "platform", platform, "error", err)
		http.Error(w, "Internal error", http.StatusInternalServerError)
		return
	}

	slog.Info("Webhook ingested successfully", "platform", platform, "bytes", len(body))

	// Immediately return 200 OK so Meta/TikTok don't timeout.
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("OK"))
}
