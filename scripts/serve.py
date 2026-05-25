#!/usr/bin/env python3
"""Mini serveur statique pour la preview locale.
Contournement : http.server évalue os.getcwd() au lancement pour le default
de --directory, ce qui échoue dans la sandbox du preview MCP. On lui passe
explicitement une directory absolue et on utilise ThreadingHTTPServer."""
import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8003

Handler = partial(SimpleHTTPRequestHandler, directory=ROOT)
with ThreadingHTTPServer(("127.0.0.1", PORT), Handler) as httpd:
    print(f"Serving {ROOT} at http://127.0.0.1:{PORT}/", flush=True)
    httpd.serve_forever()
