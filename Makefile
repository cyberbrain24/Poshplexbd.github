# ============================================================
# Poshplex Developer Makefile
# Usage: make <target>
# Requires: Docker Desktop, Python 3.12+, Node 20+
# ============================================================

.PHONY: help up down build logs shell migrate seed music-migrate

help:
	@echo ""
	@echo "  Poshplex Development Commands"
	@echo "  ────────────────────────────────"
	@echo "  make up           Start the full Docker stack"
	@echo "  make down         Stop and remove containers"
	@echo "  make build        Rebuild all Docker images"
	@echo "  make logs         Tail all service logs"
	@echo "  make shell        Open Django shell in backend container"
	@echo "  make migrate      Run Django migrations"
	@echo "  make seed         Seed Districts & Thanas from management command"
	@echo "  make music-migrate  Migrate external audio URLs to local storage"
	@echo ""

# ── Full Stack ──────────────────────────────────────────────

up:
	@echo "🚀 Starting Poshplex full stack..."
	docker compose up

up-d:
	@echo "🚀 Starting Poshplex full stack (detached)..."
	docker compose up -d

down:
	@echo "🛑 Stopping all services..."
	docker compose down

build:
	@echo "🔨 Rebuilding all Docker images..."
	docker compose build --no-cache

logs:
	docker compose logs -f

# ── Backend Shortcuts ───────────────────────────────────────

shell:
	docker compose exec backend python manage.py shell

migrate:
	docker compose exec backend python manage.py migrate

createsuperuser:
	docker compose exec backend python manage.py createsuperuser

seed:
	@echo "🌱 Seeding Bangladesh Districts & Thanas..."
	docker compose exec backend python manage.py import_districts_thanas

music-migrate:
	@echo "🎵 Migrating external audio tracks to internal storage..."
	docker compose exec backend python manage.py migrate_audio

# ── Local (No Docker) Shortcuts ─────────────────────────────

local-backend:
	@echo "🐍 Starting Django backend locally on port 8000..."
	python manage.py runserver 0.0.0.0:8000

local-store:
	@echo "⚡ Starting Next.js storefront locally on port 3000..."
	cd poshplex_store && npm run dev

local-admin:
	@echo "⚡ Starting Vite admin panel locally on port 3001..."
	cd poshplex_admin && npm run dev

local-all:
	@echo "🚀 Starting all services locally (requires 3 terminals)..."
	@echo "Run each command in its own terminal:"
	@echo "  make local-backend"
	@echo "  make local-store"
	@echo "  make local-admin"
