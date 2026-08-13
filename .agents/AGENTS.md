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
2. **Push to GitHub:** Once local changes are verified, the user will commit and push the code to GitHub.
3. **VPS Syncing (Agent Workflow):**
   - If you (the agent) need to modify or debug the VPS environment directly, **DO NOT** make changes on the VPS without also applying those exact same changes to the local codebase.
   - You can connect to the VPS via SSH to run docker commands, check logs, or sync files. The preferred way to do this on Windows is to write and execute a temporary Python script utilizing the `paramiko` library.
   - **Credentials:** VPS credentials (IP, Username, Password) are stored securely in `.env.vps` at the root of the local workspace. **Never** hardcode or expose these credentials in your scripts or responses. Parse `.env.vps` to read them.
4. **Rebuilding Containers:** After syncing code to the VPS, you must rebuild the corresponding Docker container (`docker compose up -d --build backend`, `store`, or `admin`).

## Important Best Practices
- **CORS & Domains:** Next.js `next.config.js` `remotePatterns` and Django's `CORS_ALLOWED_ORIGINS` must correctly whitelist production domains (`store.poshplexbd.com`, etc.). If images are broken, it is almost always a `next.config.js` issue or a database artifact containing `localhost`.
- **Nginx Configuration:** The production Nginx config is located at `/etc/nginx/sites-available/poshplex` on the VPS. If you modify it, be sure to mirror the final version to `nginx.host.conf` in the local repository so it is backed up in version control.
- **Database Drift:** Remember that the local SQLite database and production PostgreSQL database are entirely separate. Fixing a data issue (like a broken image URL saved in a `JSONField`) on the VPS will not fix it locally, and vice versa. Always clarify with the user which database you are operating on.
