#!/bin/sh

# Generate nginx.conf based on environment
if [ -n "$API_BACKEND_URL" ]; then
    echo "Using API backend: $API_BACKEND_URL"
    sed "s|{{API_BACKEND_URL}}|$API_BACKEND_URL|g" /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf
else
    echo "Using default remote backend"
    sed "s|{{API_BACKEND_URL}}|https://vizchemlab-backend.onrender.com|g" /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf
fi

# Start nginx
exec nginx -g "daemon off;"
