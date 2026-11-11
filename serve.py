"""本機預覽伺服器：python serve.py  ->  http://localhost:8765
(加上 no-store 標頭，更新資料或程式後重新整理就會生效)"""
import http.server
import os
import sys
import webbrowser

PORT = int(os.environ.get("PORT") or (sys.argv[1] if len(sys.argv) > 1 and sys.argv[1].isdigit() else 8765))
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    with http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler) as srv:
        url = f"http://localhost:{PORT}/"
        print("Dashboard ->", url, "(Ctrl+C to stop)", flush=True)
        if "--open" in sys.argv:
            webbrowser.open(url)
        srv.serve_forever()
