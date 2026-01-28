# CouchDB Initialization Guide

## Overview
This directory contains initialization scripts and configuration for properly setting up CouchDB instances in the Hyperledger Fabric network.

## Files

### init-couchdb.sh
The main initialization script that:
- Waits for CouchDB to be ready
- Creates system databases:
  - `_users` - For user authentication and management
  - `_global_changes` - For cluster-wide change notifications
  - `_replicator` - For database replication

**Features:**
- Error handling (doesn't fail if databases already exist)
- Automatic retry logic with timeout
- HTTP status code verification
- Database verification output

### Dockerfile
Custom CouchDB 3.2.2 image that:
- Includes the initialization script
- Sets proper execution permissions
- Maintains compatibility with standard CouchDB

### docker-entrypoint.sh
Alternative startup script for custom entry point handling.

## How It Works

### Deployment Flow
1. Docker Compose starts CouchDB containers
2. Volume mount makes `init-couchdb.sh` available at `/docker-entrypoint-initdb.d/`
3. CouchDB starts with default configuration
4. Healthcheck verifies CouchDB is responding to HTTP requests
5. Initialization script runs and creates system databases

### Database Initialization
The script performs HTTP PUT requests to create databases:
- `201 Created`: Database created successfully
- `412 Precondition Failed`: Database already exists (expected on restart)

## Configuration

### Environment Variables
- `COUCHDB_USER` - Database admin user (default: admin)
- `COUCHDB_PASSWORD` - Database password (default: adminpw)
- `COUCHDB_HOST` - Database hostname (auto-detected from container)
- `COUCHDB_PORT` - Database port (default: 5984)

### Healthcheck
Each CouchDB service includes a healthcheck:
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "-u", "admin:adminpw", "http://localhost:5984/"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 10s
```

## Troubleshooting

### CouchDB Logs
Check the initialization output:
```bash
docker-compose logs couchdb0
docker-compose logs couchdb1
docker-compose logs couchdb2
```

### Verify Databases
Access CouchDB admin interface:
```
http://localhost:5984/_utils/
http://localhost:6984/_utils/
http://localhost:7984/_utils/
```

### Manual Database Creation
If needed, create databases manually:
```bash
curl -X PUT http://admin:adminpw@localhost:5984/_users
curl -X PUT http://admin:adminpw@localhost:5984/_global_changes
curl -X PUT http://admin:adminpw@localhost:5984/_replicator
```

## Port Mapping
- **couchdb0**: 5984 (container) → 5984 (host)
- **couchdb1**: 5984 (container) → 6984 (host)
- **couchdb2**: 5984 (container) → 7984 (host)

## Data Persistence
Each CouchDB instance uses a named volume:
- `couchdb0_data` - persists to `/opt/couchdb/data`
- `couchdb1_data` - persists to `/opt/couchdb/data`
- `couchdb2_data` - persists to `/opt/couchdb/data`

## References
- [CouchDB Official Documentation](https://docs.couchdb.org/)
- [Hyperledger Fabric CouchDB Documentation](https://hyperledger-fabric.readthedocs.io/en/latest/couchdb_as_state_database.html)
