#!/bin/bash
set -e

echo "Building fingerragio for Cloudflare Pages..."

# Temporarily move API routes (they need Python/Node.js server, not edge)
API_BACKUP="/tmp/fingerragio-api-backup-$$"
if [ -d "src/app/api" ]; then
  mv src/app/api "$API_BACKUP"
fi

# Build static export
CLOUDFLARE_BUILD=1 npx next build

# Restore API routes
if [ -d "$API_BACKUP" ]; then
  mv "$API_BACKUP" src/app/api
fi

echo "Deploying to Cloudflare Pages..."
npx wrangler pages deploy out --project-name fingerragio

echo "Done! Site should be live at fingerragio.innovariance.com"
