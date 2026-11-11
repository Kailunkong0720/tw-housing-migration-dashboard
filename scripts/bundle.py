"""把 data/*.json 打包成 data/bundle.js (window.TWDATA)，讓 index.html 直接用 <script> 載入 (雙擊開啟也能用)。"""
import json
import os
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "data")


def tw(o):
    """縣市名統一成「台」(顯示用)。"""
    if isinstance(o, str):
        return o.replace("臺", "台")
    if isinstance(o, list):
        return [tw(x) for x in o]
    if isinstance(o, dict):
        return {tw(k): tw(v) for k, v in o.items()}
    return o


def load(name):
    return json.load(open(os.path.join(D, name), encoding="utf-8"))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    data = {
        "built": time.strftime("%Y-%m-%d %H:%M"),
        "prices": tw(load("prices.json")),
        "asking": load("asking.json"),
        "migration": tw(load("migration.json")),
        "geo": tw(load("counties.geojson")),
    }
    path = os.path.join(D, "bundle.js")
    with open(path, "w", encoding="utf-8") as f:
        f.write("window.TWDATA=")
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";")
    print("saved", path, os.path.getsize(path) // 1024, "KB")
