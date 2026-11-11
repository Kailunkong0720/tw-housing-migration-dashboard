"""下載內政部不動產交易實價查詢服務網 — 本期/歷史季度「不動產買賣 + 預售屋」開放資料 (CSV zip)。

來源: https://plvr.land.moi.gov.tw/DownloadOpenData
輸出: data_raw/lvr/{季別}/lvr_landcsv.zip   (每季各自一個資料夾，不解壓)

用法:  python scripts/fetch_lvr.py
"""
import os
import subprocess
import sys
import time
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data_raw", "lvr")
URL = "https://plvr.land.moi.gov.tw/DownloadSeason?season={s}&type=zip&fileName=lvr_landcsv.zip"
URL_PERIOD = "https://plvr.land.moi.gov.tw/DownloadHistory?type=history&fileName={s}"   # 每月 1/11/21 日發布的單期檔
URL_NOW = "https://plvr.land.moi.gov.tw/Download?type=zip&fileName=lvr_landcsv.zip"      # 本期


def seasons(start=(109, 1)):
    t = time.localtime()
    ey, eq = t.tm_year - 1911, (t.tm_mon - 1) // 3 + 1
    y, q = start
    while (y, q) <= (ey, eq):
        yield f"{y}S{q}"
        q += 1
        if q > 4:
            y, q = y + 1, 1


def fetch(s, url=None):
    d = os.path.join(OUT, s)
    path = os.path.join(d, "lvr_landcsv.zip")
    if os.path.exists(path):
        return "cached"
    os.makedirs(d, exist_ok=True)
    tmp = path + ".part"
    err = ""
    for i in range(5):
        # 用 curl 下載：速度低於 20KB/s 持續 30 秒就中斷重試 (伺服器偶爾會卡住連線)
        r = subprocess.run(["curl", "-s", "-L", "-A", "Mozilla/5.0 (dashboard data fetch)", "--speed-limit", "20000",
                            "--speed-time", "30", "-m", "900", "-o", tmp, (url or URL).format(s=s)])
        if r.returncode == 0 and os.path.exists(tmp):
            if not zipfile.is_zipfile(tmp):
                os.remove(tmp)
                return "not published yet"
            os.replace(tmp, path)
            return f"{os.path.getsize(path) / 1e6:.1f} MB"
        err = f"curl exit {r.returncode}"
        time.sleep(3 + i * 5)
    return f"failed: {err}"


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    last = None
    for s in seasons():
        msg = fetch(s)
        print(s, msg, flush=True)
        if not msg.startswith(("not", "failed")):
            last = s
    # 最新一季之後已發布的單期檔 (補上季度檔還沒收錄的近期登錄資料)
    y, q = (int(x) for x in last.split("S"))
    y, m = (y + 1911, q * 3 + 1) if q < 4 else (y + 1912, 1)
    t = time.localtime()
    today = (t.tm_year, t.tm_mon, t.tm_mday)
    while (y, m, 1) <= today:
        for day in (1, 11, 21):
            if (y, m, day) < today:
                name = f"{y}{m:02d}{day:02d}"
                print(name, fetch("p" + name, URL_PERIOD.replace("{s}", name)), flush=True)
        m += 1
        if m > 12:
            y, m = y + 1, 1
    cur = os.path.join(OUT, "current", "lvr_landcsv.zip")
    if os.path.exists(cur):
        os.remove(cur)          # 本期檔每 10 天更新，一律重抓
    print("current", fetch("current", URL_NOW), flush=True)
