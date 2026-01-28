FROM couchdb:3.2.2

# Copy initialization scripts
COPY init-couchdb.sh /docker-entrypoint-initdb.d/init-couchdb.sh

# Set permissions
RUN chmod +x /docker-entrypoint-initdb.d/init-couchdb.sh

# CouchDB will run with default configuration
# The init script will be triggered after startup
