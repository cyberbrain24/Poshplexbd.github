# Poshplex CI/CD Deployment Pipeline

This folder contains the automated deployment workflows for the Poshplex infrastructure.

## How The Pipeline Works
Whenever you run `git push origin main` from your local PC, GitHub Actions automatically executes the `deploy.yml` file.

1. **Secure File Transfer:** It uses `appleboy/scp-action` to securely copy your new source code directly to `/root/poshplex_store` on your VPS.
2. **Safety Exclusions:** It strictly ignores `.env` files, `media/` folders, and `db.sqlite3` databases. This ensures that your production database and live API secrets are **never** accidentally overwritten by your local files.
3. **Zero-Downtime Rebuild:** It uses `appleboy/ssh-action` to log into your VPS and run `docker compose up -d --build`. This automatically compiles the new Next.js and Django code, and seamlessly restarts the containers without taking the website offline.
4. **Garbage Collection:** Finally, it runs `docker image prune -f` to delete the old dangling Docker images, preventing your VPS from running out of SSD space over time.

---

## ⚠️ MANDATORY GITHUB SECRETS CONFIGURATION

Because GitHub is a public repository platform, **we can never hardcode the VPS root password or IP address directly in the `deploy.yml` file.**

Before this automated pipeline can work, you MUST add your VPS credentials into your GitHub Repository's encrypted "Secrets" vault. 

### Step-by-Step Instructions:
1. Open your web browser and navigate to your GitHub repository.
2. Click on the **Settings** tab near the top right.
3. In the left sidebar menu, scroll down to the **Security** section, click **Secrets and variables**, then click **Actions**.
4. Click the green **New repository secret** button.
5. You must add exactly three secrets:

> **Secret 1:**
> - Name: `VPS_IP`
> - Secret: `185.227.134.236`

> **Secret 2:**
> - Name: `VPS_USER`
> - Secret: `root`

> **Secret 3:**
> - Name: `VPS_PASS`
> - Secret: *(Look inside your local `.env.vps` file on your PC and paste the password here)*

---

## Monitoring Deployments
Once those three secrets are saved, your pipeline is ready. 

Every time you push code, simply click the **"Actions"** tab at the top of your GitHub repository. You will be able to watch a live terminal feed of GitHub's servers connecting to your VPS and deploying your code!
