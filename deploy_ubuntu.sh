#!/bin/bash
# ============================================================
# Poshplex Enterprise Deployment Script (Ubuntu 24.04 LTS)
# Run this on your Contabo VPS to deploy the stack!
# ============================================================

set -e

echo "🚀 Starting Poshplex Enterprise Deployment..."

# 1. Update system and install dependencies
echo "📦 Installing Nginx and Certbot..."
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx curl jq

# 2. Build the React Admin Panel
echo "⚛️ Building Vite Admin Panel..."
cd poshplex_admin
# Install Node.js if not installed
if ! command -v npm &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi
npm ci
npm run build

# 3. Move Admin Panel to Host Web Root
echo "📂 Moving Admin build to /var/www/poshplex_admin..."
sudo mkdir -p /var/www/poshplex_admin
sudo cp -r dist/* /var/www/poshplex_admin/
sudo chown -R www-data:www-data /var/www/poshplex_admin
cd ..

# 4. Copy Nginx Configuration
echo "⚙️ Configuring Host Nginx..."
sudo cp nginx.host.conf /etc/nginx/sites-available/poshplex
# Enable site and remove default
sudo ln -sf /etc/nginx/sites-available/poshplex /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# 5. Launch Docker Stack
echo "🐳 Launching optimized Docker Stack..."
docker compose -f docker-compose.prod.yml up -d --build

# 6. Verify Nginx and Restart
echo "🔄 Restarting Nginx..."
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx docker

echo "============================================================"
echo "✅ Deployment Successful!"
echo "⚠️ IMPORTANT: Please ensure your DNS A-Records for poshplexbd.com, www.poshplexbd.com, and admin.poshplexbd.com point to this server's IP address."
echo "Then, run the following command to secure your domains with SSL:"
echo ""
echo "sudo certbot --nginx -d poshplexbd.com -d www.poshplexbd.com -d admin.poshplexbd.com"
echo "============================================================"
