#!/usr/bin/env python3
"""
YBot Test Server Launcher
A simple Python script to launch and test the YBot web application.
"""

import os
import sys
import webbrowser
import subprocess
import time
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler
import socket

class CustomHTTPRequestHandler(SimpleHTTPRequestHandler):
    """Custom HTTP request handler with CORS support for local development."""

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'X-Requested-With')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, format, *args):
        # Only log errors and important messages, suppress routine requests
        if args and len(args) > 0:
            message = format % args
            if "GET /" in message and ("200" in message or "304" in message):
                return  # Suppress successful GET requests
        super().log_message(format, *args)

def find_free_port(start_port=8000, max_attempts=100):
    """Find a free port starting from start_port."""
    for port in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            try:
                sock.bind(('localhost', port))
                return port
            except OSError:
                continue
    raise RuntimeError(f"Could not find a free port between {start_port} and {start_port + max_attempts}")

def start_server(port):
    """Start the HTTP server on the specified port."""
    os.chdir('.')  # Serve from current directory
    server_address = ('', port)
    httpd = HTTPServer(server_address, CustomHTTPRequestHandler)

    print(f"🚀 YBot Test Server starting on port {port}")
    print(f"📁 Serving files from: {os.getcwd()}")
    print(f"🌐 Open your browser to: http://localhost:{port}")
    print("📝 Press Ctrl+C to stop the server")
    print("-" * 50)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
        httpd.shutdown()

def check_files():
    """Check if required files exist."""
    required_files = [
        'index.html',
        'assets/YBot.fbx'
    ]

    missing_files = []
    for file_path in required_files:
        if not os.path.exists(file_path):
            missing_files.append(file_path)

    if missing_files:
        print("❌ Missing required files:")
        for file in missing_files:
            print(f"   - {file}")
        return False

    print("✅ All required files found")
    return True

def open_browser(port, delay=2):
    """Open the default web browser after a delay."""
    time.sleep(delay)
    url = f"http://localhost:{port}"
    print(f"🌐 Opening browser to: {url}")
    webbrowser.open(url)

def main():
    """Main function to launch the test server."""
    print("🤖 YBot Web Test Launcher")
    print("=" * 30)

    # Check if required files exist
    if not check_files():
        print("❌ Cannot start server - missing required files")
        sys.exit(1)

    # Find a free port
    try:
        port = find_free_port(8000)
    except RuntimeError as e:
        print(f"❌ {e}")
        sys.exit(1)

    # Start browser in a separate thread
    browser_thread = threading.Thread(target=open_browser, args=(port,))
    browser_thread.daemon = True
    browser_thread.start()

    # Start the server
    try:
        start_server(port)
    except Exception as e:
        print(f"❌ Error starting server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()