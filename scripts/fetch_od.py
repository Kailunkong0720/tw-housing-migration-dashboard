"""抓取內政部戶政司 ODRP094「各直轄市、縣(市)間遷徙人口數按性別分」— 完整 22×22 縣市遷徙矩陣。

API 以「遷出村里 × 遷入縣市」逐列提供 (每月約 34 萬列 / 172 頁)，這裡彙總成 遷出縣市 × 遷入縣市。
注意：此資料集只提供部分月份 (2023/09 起零星、2025/02 起連續)。
輸出: data_raw/ris/od_{yyymm}.json
"""
import json
import os
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE = "https://www.ris.gov.tw/rs-opendata/api/v1/datastore/ODRP094"
DOCS = "https://www.ris.gov.tw/rs-opendata/api/Main/docs/v1"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data_raw", "ris")
UA = {"User-Agent": "Mozilla/5.0 (dashboard data fetch)"}


def get(url):
    last = None
    for i in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
                d = json.loads(r.read().decode("utf-8"))
            if "responseData" in d or "totalPage" not in d and i >= 2:
                return d
        except Exception as e:  # noqa
            last = e
        time.sleep(2 + i * 3)
    raise RuntimeError(f"{url}: {last}")


def month(yyymm, ex):
    path = os.path.join(OUT, f"od_{yyymm}.json")
    if os.path.exists(path):
        return "cached"
    first = get(f"{BASE}/{yyymm}")
    if "responseData" not in first:
        return "no data"
    n = int(first["totalPage"])
    od = {}
    rows = 0
    pages = [first] + list(ex.map(lambda p: get(f"{BASE}/{yyymm}?PAGE={p}"), range(2, n + 1)))
    for d in pages:
        for r in d["responseData"]:
            v = list(r.values())   # 統計年月, 區域代碼, 區域別, 村里, 性別, 遷入地, 人數 (欄位順序固定)
            o, dest = v[2][:3], v[5]
            row = od.setdefault(o, {})
            row[dest] = row.get(dest, 0) + int(v[6] or 0)
            rows += 1
    json.dump({"yyymm": yyymm, "od": od}, open(path, "w", encoding="utf-8"), ensure_ascii=False)
    return f"{rows} rows"


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    os.makedirs(OUT, exist_ok=True)
    docs = get(DOCS)
    months = [str(m) for m in docs["paths"]["/ODRP094/{yyymm}"]["get"]["parameters"][0]["enum"]]
    with ThreadPoolExecutor(4) as ex:
        for m in months:
            print(m, month(m, ex), flush=True)
