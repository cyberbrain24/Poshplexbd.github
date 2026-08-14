# Poshplex Agent Guidelines

This document contains rules, architecture details, and deployment best practices for agents working on the Poshplex codebase. **All future Antigravity agents MUST read and adhere to these guidelines before making changes.**

## System Architecture & Stack
- **Frontend (Storefront):** Next.js App Router (Runs on port 3000 locally, `store.poshplexbd.com` in production).
- **Frontend (Admin):** Next.js or React SPA (Runs on port 3001 locally, `admin.poshplexbd.com` in production).
- **Backend API:** Django REST Framework (Runs on port 8000 locally, `api.poshplexbd.com` / `poshplexbd.com` in production).
- **Database:** SQLite (Local development) / PostgreSQL (Production VPS).
- **Production Server:** Docker Compose environment deployed on a Linux VPS running Nginx as a reverse proxy.

## Deployment & Syncing Workflow
The production VPS code is NOT currently configured as a Git repository. Code syncs and deployments must be handled carefully:

1. **Local Changes First:** All development, testing, and debugging should be done on the local PC first.
2. **Push to GitHub:** Once local changes are verified, commit and push the code to GitHub (`main` branch).
3. **VPS Syncing (Automated CI/CD):**
   - We have implemented a **GitHub Actions CI/CD pipeline** (`.github/workflows/deploy.yml`).
   - Pushing to the `main` branch will automatically trigger GitHub servers to SCP the new code to `/root/poshplex_store` on the VPS and run `docker compose up -d --build`.
   - **DO NOT** write custom Python/Paramiko deployment scripts unless the CI/CD pipeline is broken or you need to run a one-off database migration/maintenance script.
4. **Manual Fallback / Diagnostics:**
   - If you (the agent) must connect to the VPS manually to debug, write a temporary Python script utilizing the `paramiko` library and save it in `agent_scripts/`.
   - **Credentials:** VPS credentials (IP, Username, Password) are stored securely in `.env.vps` at the root of the local workspace. **Never** hardcode or expose these credentials.

## Important Best Practices
- **Temporary Scripts (agent_scripts/):** Do NOT create temporary testing or deployment scripts in the root directory where they might get pushed to GitHub. Always save any temporary Python scripts (like those used for SSH/Paramiko deployments) or data files into the `agent_scripts/` directory, which is gitignored.
- **CORS & Domains:** Next.js `next.config.js` `remotePatterns` and Django's `CORS_ALLOWED_ORIGINS` must correctly whitelist production domains (`store.poshplexbd.com`, etc.). If images are broken, it is almost always a `next.config.js` issue or a database artifact containing `localhost`.
- **Nginx Configuration:** The production Nginx config is located at `/etc/nginx/sites-available/poshplex` on the VPS. If you modify it, be sure to mirror the final version to `nginx.host.conf` in the local repository so it is backed up in version control.
- **Database Drift:** Remember that the local SQLite database and production PostgreSQL database are entirely separate. Fixing a data issue (like a broken image URL saved in a `JSONField`) on the VPS will not fix it locally, and vice versa. Always clarify with the user which database you are operating on.

## Role-Based Access Control (RBAC) & New Modules
The Poshplex monolithic backend and admin panel are protected by a granular, module-based RBAC system.
- **Backend (`apps.core.models.Role`):** Permissions are stored in a dynamic JSON matrix (e.g., `{"orders": {"view": true, "edit": false}}`).
- **Endpoint Protection:** Any new administrative API endpoints MUST be protected using the `enforce_permission(request, module_name, action)` utility function from `apps.core.api`.
- **Frontend Refine UI:** Any new pages or modules added to the `poshplex_admin` React SPA MUST be registered with the `accessControlProvider` (using `useCan` or native Refine access control properties) to ensure the UI correctly hides/shows based on the user's role.
- **Do not bypass this system:** When building new modules, ALWAYS integrate them into the RBAC JSON matrix rather than creating separate or hardcoded permission logic.
## Docker Compose Architecture (Local vs Prod)
- **`docker-compose.yml`**: This file is **strictly for production**. It does NOT contain local volume mounts (`.:/app`) that override the built images. It is pushed to the VPS.
- **`docker-compose.override.yml`**: This file is **strictly for local development** and is `.gitignore`d. It contains the volume mounts to enable hot-reloading. When running `docker compose up` locally, Docker merges both files automatically.
- **NEVER** add local source code `volumes` back into `docker-compose.yml`, or you will break the production VPS build.

## Production RAM Allocation Breakdown (12 GB Total)
To ensure maximum performance and prevent Out-Of-Memory (OOM) crashes, the VPS is strictly architected with the following memory constraints. Future agents MUST respect these boundaries:

1. **PostgreSQL 16 Database**: `4.0 GB` 
   - Uses `shared_buffers=4GB` and `pg_prewarm` to pin product catalogs and pgvector embeddings in system RAM, bypassing SSD read penalties.
2. **Redis Stack Server**: `2.0 GB`
   - Configured with `maxmemory 2000mb` and `allkeys-lru` eviction policy. Serves as a read-through REST API cache and Celery broker.
3. **Django Ninja API (Gunicorn)**: `2.0 GB`
   - Runs 8 worker processes with 2 threads each (`--worker-class gthread`). Capable of serving 500-700 dynamic requests/sec.
4. **Next.js Storefront**: `1.5 GB`
   - Uses Next.js `output: 'standalone'` configuration to run as a highly minimized Node.js microservice without bloated `node_modules`.
5. **Celery Worker**: `0.8 GB`
   - Strictly limited to `--concurrency=2` with `--max-tasks-per-child=100` to prevent Python memory leaks during background tasks.
6. **OS & Nginx Overhead**: `0.8 GB`
   - Required for the Ubuntu 24.04 kernel, Nginx TLS termination, and serving the static Vite Admin panel.
7. **Free Safety Cushion**: `0.9 - 1.0 GB`
   - A critical unassigned buffer to absorb temporary spikes (e.g., during `npm run build` or heavy database sorting) and prevent complete server lockups.
