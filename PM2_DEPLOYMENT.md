# PM2 Deployment Guide for MCVU Ticketing Platform

This guide explains how to deploy the MCVU Ticketing Platform using PM2.

## Prerequisites

- Node.js and npm installed on your server
- PM2 installed globally (`npm install -g pm2`)
- Access to your server via SSH

## Deployment Steps

1. **Clone the repository to your server**

2. **Install dependencies**
   ```
   npm install
   ```

3. **Build the application**
   ```
   npm run build
   ```

4. **Start the application with PM2**
   ```
   npm run pm2:start
   ```

## PM2 Management Commands

All these commands are available as npm scripts:

- **Start application**: `npm run pm2:start`
- **Stop application**: `npm run pm2:stop`
- **Restart application**: `npm run pm2:restart`
- **Reload application** (zero downtime): `npm run pm2:reload`
- **Delete from PM2**: `npm run pm2:delete`
- **View logs**: `npm run pm2:logs`
- **Check status**: `npm run pm2:status`

## Domain Configuration

The application is configured to run at `https://mcvu.perkimakassar.com`. Make sure to:

1. Point your domain DNS to your server IP
2. Configure Nginx/Apache as a reverse proxy to forward requests to port 3000
3. Set up SSL certificates (recommended using Certbot/Let's Encrypt)

## Nginx Configuration Example

```nginx
server {
    listen 80;
    server_name mcvu.perkimakassar.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name mcvu.perkimakassar.com;
    
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Updating the Application

To update the application:

1. Pull the latest changes
2. Install any new dependencies: `npm install`
3. Rebuild: `npm run build`
4. Reload the application: `npm run pm2:reload`

## Troubleshooting

- Check logs: `npm run pm2:logs`
- Verify the application is running: `npm run pm2:status`
- Ensure your reverse proxy configuration is correct
- Verify the application is listening on port 3000
