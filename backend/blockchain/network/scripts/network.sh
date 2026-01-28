#!/bin/bash

# PAMS - Blockchain Network Management Script
# This script manages the Hyperledger Fabric network for PAMS

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
NETWORK_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_DIR="$(dirname "$NETWORK_DIR")"

# Docker Compose file location
DOCKER_COMPOSE_FILE="$NETWORK_DIR/docker-compose.yml"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to start the network
start_network() {
    print_status "Starting Hyperledger Fabric network..."
    
    if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
        print_error "docker-compose.yml not found at $DOCKER_COMPOSE_FILE"
        return 1
    fi
    
    cd "$NETWORK_DIR"
    
    # Start containers
    docker-compose -f docker-compose.yml up -d
    
    if [ $? -eq 0 ]; then
        print_success "Network started successfully"
        print_status "Waiting for containers to be ready (10 seconds)..."
        sleep 10
        
        print_status "Network Status:"
        docker-compose -f docker-compose.yml ps
        
        return 0
    else
        print_error "Failed to start network"
        return 1
    fi
}

# Function to stop the network
stop_network() {
    print_status "Stopping Hyperledger Fabric network..."
    
    if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
        print_error "docker-compose.yml not found"
        return 1
    fi
    
    cd "$NETWORK_DIR"
    docker-compose -f docker-compose.yml down
    
    if [ $? -eq 0 ]; then
        print_success "Network stopped successfully"
        return 0
    else
        print_error "Failed to stop network"
        return 1
    fi
}

# Function to restart the network
restart_network() {
    print_status "Restarting network..."
    stop_network
    sleep 3
    start_network
}

# Function to show network status
network_status() {
    print_status "Network Status:"
    cd "$NETWORK_DIR"
    docker-compose -f docker-compose.yml ps
    
    print_status "Docker containers:"
    docker ps --filter "label=com.example.pams" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

# Function to view logs
view_logs() {
    local container=$1
    if [ -z "$container" ]; then
        print_status "Showing all logs (Ctrl+C to exit)..."
        cd "$NETWORK_DIR"
        docker-compose -f docker-compose.yml logs -f
    else
        print_status "Showing logs for $container..."
        docker logs -f "$container"
    fi
}

# Function to clean up the network
cleanup_network() {
    print_warning "This will remove all network data and containers. Continue? (y/N)"
    read -r response
    
    if [[ "$response" =~ ^[Yy]$ ]]; then
        print_status "Cleaning up network..."
        cd "$NETWORK_DIR"
        docker-compose -f docker-compose.yml down -v
        
        # Remove any remaining volumes
        docker volume rm $(docker volume ls -q --filter "label=com.example.pams") 2>/dev/null || true
        
        print_success "Network cleaned up"
    else
        print_status "Cleanup cancelled"
    fi
}

# Function to show help
show_help() {
    cat << EOF
${BLUE}PAMS Blockchain Network Management${NC}

Usage: ./network.sh [COMMAND]

Commands:
    up                  Start the Hyperledger Fabric network
    down                Stop the network
    restart             Restart the network
    status              Show network status
    logs [container]    Show logs (optionally for specific container)
    clean               Clean up and remove all network data
    help                Show this help message

Examples:
    ./network.sh up
    ./network.sh logs peer0.org1
    ./network.sh status

EOF
}

# Main script logic
case "${1:-help}" in
    up)
        start_network
        ;;
    down)
        stop_network
        ;;
    restart)
        restart_network
        ;;
    status)
        network_status
        ;;
    logs)
        view_logs "$2"
        ;;
    clean)
        cleanup_network
        ;;
    help)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
