#!/bin/bash

# Automated Component Style Testing Script (Bash Version)
# Usage: ./scripts/test-component-styles.sh [dev|build]

set -e

MODE="${1:-dev}"
SITE_DIR="apps/site"
TEST_URL="http://localhost:3000"

echo "🚀 Component Style Testing Script"
echo "=================================="
echo ""

# Check if we need to start the dev server
if [ "$MODE" = "dev" ]; then
    echo "Starting dev server..."
    cd "$SITE_DIR"
    pnpm dev &
    SERVER_PID=$!
    
    # Wait for server to be ready
    echo "Waiting for server to start..."
    sleep 10
    
    # Check if server is running
    if ! curl -s "$TEST_URL" > /dev/null; then
        echo "❌ Server failed to start"
        kill $SERVER_PID 2>/dev/null || true
        exit 1
    fi
    
    echo "✅ Server started successfully"
    cd ../..
elif [ "$MODE" = "build" ]; then
    echo "Building site..."
    cd "$SITE_DIR"
    pnpm build
    
    echo "Starting production server..."
    pnpm start &
    SERVER_PID=$!
    
    sleep 10
    cd ../..
fi

# Run the Node.js test script
echo ""
echo "Running component style tests..."
node scripts/test-component-styles.js

TEST_EXIT_CODE=$?

# Cleanup: stop the server if we started it
if [ ! -z "$SERVER_PID" ]; then
    echo ""
    echo "Stopping server..."
    kill $SERVER_PID 2>/dev/null || true
fi

exit $TEST_EXIT_CODE
