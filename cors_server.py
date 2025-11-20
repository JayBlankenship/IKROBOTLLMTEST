from http.server import HTTPServer, SimpleHTTPRequestHandler
import os
import json


class CORSRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Load encryption key from environment (like Netlify) or local config
        self.encryption_key = os.environ.get('VITE_ENCRYPTION_KEY')
        if not self.encryption_key:
            # Fallback to local config file for development
            config_path = os.path.join(os.path.dirname(__file__), 'local_config.json')
            if os.path.exists(config_path):
                try:
                    with open(config_path, 'r') as f:
                        config = json.load(f)
                        self.encryption_key = config.get('VITE_ENCRYPTION_KEY')
                except Exception as e:
                    print(f"Error loading local config: {e}")
                    self.encryption_key = None
            else:
                self.encryption_key = None

        super().__init__(*args, **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Origin, Content-Type, Accept, Range')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200, "ok")
        self.end_headers()

    def do_GET(self):
        if self.path == '/api/encryption-key':
            # Serve encryption key like Netlify environment variable
            if self.encryption_key:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'key': self.encryption_key}).encode('utf-8'))
            else:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b'Encryption key not configured')
            return

        # Default file serving
        super().do_GET()


if __name__ == '__main__':
    port = 8000
    print(f"Serving HTTP with CORS at http://127.0.0.1:{port}/ (Press CTRL+C to quit)")
    if not os.environ.get('VITE_ENCRYPTION_KEY'):
        config_path = os.path.join(os.path.dirname(__file__), 'local_config.json')
        if os.path.exists(config_path):
            print("Using local config for VITE_ENCRYPTION_KEY")
        else:
            print("Warning: VITE_ENCRYPTION_KEY not set. Create local_config.json or set environment variable.")
    HTTPServer(('127.0.0.1', port), CORSRequestHandler).serve_forever()