"""一鍵更新全部資料：下載 -> 彙整 -> 打包。  用法: python scripts/update_all.py"""
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
for step in ["fetch_lvr.py", "fetch_migration.py", "fetch_od.py", "fetch_cathay.py",
             "build_geo.py", "build_prices.py", "build_migration.py", "bundle.py"]:
    print("=====", step, flush=True)
    r = subprocess.run([sys.executable, os.path.join(HERE, step)])
    if r.returncode:
        sys.exit(f"{step} failed")
