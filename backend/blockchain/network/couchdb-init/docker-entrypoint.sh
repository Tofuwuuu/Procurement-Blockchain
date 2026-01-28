#!/bin/bash

# CouchDB initialization and startup script
# This script runs before CouchDB starts to set up the environment

set -e

echo "=== CouchDB Initialization ==="

# Set permissions on the initialization script
if [ -f "/docker-entrypoint-initdb.d/init-couchdb.sh" ]; then
    chmod +x "/docker-entrypoint-initdb.d/init-couchdb.sh"
fi

# Start CouchDB in the background
echo "Starting CouchDB..."
/opt/couchdb/bin/couchdb -a /opt/couchdb/etc/default.ini -a /opt/couchdb/etc/local.ini &
COUCHDB_PID=$!

# Wait for CouchDB to be fully ready
echo "Waiting for CouchDB to be ready..."
sleep 5

# Run init script if it exists
if [ -f "/docker-entrypoint-initdb.d/init-couchdb.sh" ]; then
    echo "Running initialization script..."
    bash "/docker-entrypoint-initdb.d/init-couchdb.sh"
fi

# Keep the container running
wait $COUCHDB_PID
