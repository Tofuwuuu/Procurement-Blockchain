#!/bin/bash

# CouchDB Initialization Script
# This script initializes required CouchDB system databases
# It's designed to run after CouchDB starts

set +e  # Don't exit on errors, just log them

echo "=== CouchDB Initialization Started ==="

# Get the container hostname (usually the service name in docker-compose)
HOSTNAME=$(hostname)
HOST=${COUCHDB_HOST:-${HOSTNAME:-localhost}}
PORT=${COUCHDB_PORT:-5984}
USER=${COUCHDB_USER:-admin}
PASSWORD=${COUCHDB_PASSWORD:-adminpw}

echo "CouchDB Configuration:"
echo "  Host: $HOST"
echo "  Port: $PORT"
echo "  User: $USER"

# Wait for CouchDB to be ready with increased timeout
echo "Waiting for CouchDB to be ready at $HOST:$PORT..."
MAX_ATTEMPTS=60
ATTEMPT=0

until curl -s -f -u "$USER:$PASSWORD" "http://$HOST:$PORT/" > /dev/null 2>&1; do
    ATTEMPT=$((ATTEMPT + 1))
    if [ $ATTEMPT -ge $MAX_ATTEMPTS ]; then
        echo "CouchDB did not start within timeout period"
        exit 1
    fi
    echo "  Attempt $ATTEMPT/$MAX_ATTEMPTS: CouchDB not ready yet, waiting..."
    sleep 1
done

echo "✓ CouchDB is ready!"

# Initialize system databases with error handling
echo "Initializing CouchDB system databases..."

# Create _users database
echo "  Creating _users database..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "http://$USER:$PASSWORD@$HOST:$PORT/_users")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "412" ]; then
    echo "    ✓ _users database initialized (HTTP $HTTP_CODE)"
else
    echo "    ⚠ _users database response: HTTP $HTTP_CODE"
fi

# Create _global_changes database
echo "  Creating _global_changes database..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "http://$USER:$PASSWORD@$HOST:$PORT/_global_changes")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "412" ]; then
    echo "    ✓ _global_changes database initialized (HTTP $HTTP_CODE)"
else
    echo "    ⚠ _global_changes database response: HTTP $HTTP_CODE"
fi

# Create _replicator database
echo "  Creating _replicator database..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "http://$USER:$PASSWORD@$HOST:$PORT/_replicator")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "412" ]; then
    echo "    ✓ _replicator database initialized (HTTP $HTTP_CODE)"
else
    echo "    ⚠ _replicator database response: HTTP $HTTP_CODE"
fi

# Verify databases
echo "Verifying initialized databases..."
RESPONSE=$(curl -s -u "$USER:$PASSWORD" "http://$HOST:$PORT/_all_dbs")
echo "  Available databases: $RESPONSE"

echo "=== CouchDB Initialization Complete ==="
exit 0
