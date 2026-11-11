"""抓取內政部戶政司開放資料 API — 遷入遷出統計表 (ODRP011) 與人口數 (ODRP010)。

來源: https://www.ris.gov.tw/rs-opendata/api/Main/docs/v1
輸出: data_raw/ris/odrp011_{yyymm}.json  (彙總到 縣市 / 鄉鎮市區)
      data_raw/ris/pop_{yyymm}.json      (縣市 / 鄉鎮市區 人口數)

用法:  python scripts/fetch_migration.py            # 2020/01 起至最新月份
"""
import json
import os
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE = "https://www.ris.gov.tw/rs-opendata/api/v1/datastore"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data_raw", "ris")
os.makedirs(OUT, exist_ok=True)

# 欄位前綴 (男 _m + 女 _f 相加)
FIELDS = [
    "in_total", "in_foreign", "in_ntp", "in_tp", "in_ty", "in_tc", "in_tn", "in_kh",
    "in_tw", "in_fu", "in_other", "in_other_city", "in_other_town", "first_reg", "move_in_other",
    "out_total", "out_foreign", "out_ntp", "out_tp", "out_ty", "out_tc", "out_tn", "out_kh",
    "out_tw", "out_fu", "out_other", "out_other_city", "out_other_town", "deleted_reg", "move_out_other",
]


def get(url, tries=5):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (dashboard data fetch)"})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:  # noqa
            last = e
            time.sleep(2 + i * 3)
    raise last


def pages(code, yyymm):
    first = get(f"{BASE}/{code}/{yyymm}")
    if "responseData" not in first:
        return None
    rows = list(first["responseData"])
    for p in range(2, int(first["totalPage"]) + 1):
        for attempt in range(5):
            d = get(f"{BASE}/{code}/{yyymm}?PAGE={p}")
            if "responseData" in d:
                rows += d["responseData"]
                break
            time.sleep(3 + attempt * 3)
        else:
            raise RuntimeError(f"{code}/{yyymm} page {p}: {d}")
    return [normalize(code, r) for r in rows]


KEYS = {
    "ODRP011": ["statistic_yyymm", "district_code", "site_id", "village"] + [f + sfx for f in FIELDS for sfx in ("_m", "_f")],
    "ODRP019": ["statistic_yyy", "district_code", "site_id", "village",
                "household_ordinary_total", "household_business_total", "household_single_total",
                "household_ordinary_m", "household_business_m", "household_single_m",
                "household_ordinary_f", "household_business_f", "household_single_f"],
}


def normalize(code, r):
    """少數月份 API 回傳中文欄名 (欄位順序相同)，依位置對回英文欄名。"""
    if "site_id" in r:
        return r
    return dict(zip(KEYS[code], r.values()))


def num(v):
    try:
        return int(v)
    except Exception:
        return 0


def fetch_mig(yyymm):
    path = os.path.join(OUT, f"odrp011_{yyymm}.json")
    if os.path.exists(path):
        return yyymm, "cached"
    rows = pages("ODRP011", yyymm)
    if rows is None:
        return yyymm, "no data"
    county, town = {}, {}
    for r in rows:
        site = r["site_id"].replace("　", "").strip()
        c = site[:3]
        vals = [num(r.get(f + "_m")) + num(r.get(f + "_f")) for f in FIELDS]
        for key, d in ((c, county), (site, town)):
            cur = d.get(key)
            if cur is None:
                d[key] = vals[:]
            else:
                for i, v in enumerate(vals):
                    cur[i] += v
    json.dump({"yyymm": yyymm, "fields": FIELDS, "county": county, "town": town},
              open(path, "w", encoding="utf-8"), ensure_ascii=False)
    return yyymm, f"{len(rows)} rows"


POP_F = ["household_ordinary", "household_business", "household_single"]


def fetch_pop(yyy):
    """ODRP019 戶數、人口數按戶別及性別 (年底，年度資料)。"""
    path = os.path.join(OUT, f"pop_{yyy}.json")
    if os.path.exists(path):
        return yyy, "cached"
    rows = pages("ODRP019", yyy)
    if rows is None:
        return yyy, "no data"
    county, town = {}, {}
    for r in rows:
        site = r["site_id"].replace("　", "").strip()
        c = site[:3]
        hh = sum(num(r.get(f + "_total")) for f in POP_F)
        pop = sum(num(r.get(f + "_m")) + num(r.get(f + "_f")) for f in POP_F)
        for key, d in ((c, county), (site, town)):
            cur = d.setdefault(key, [0, 0])
            cur[0] += hh
            cur[1] += pop
    json.dump({"year": yyy, "fields": ["household", "population"], "county": county, "town": town},
              open(path, "w", encoding="utf-8"), ensure_ascii=False)
    return yyy, f"{len(rows)} rows"


def month_list(start=(109, 1)):
    t = time.localtime()
    end = (t.tm_year - 1911, t.tm_mon)
    y, m = start
    out = []
    while (y, m) <= end:
        out.append(f"{y}{m:02d}")
        m += 1
        if m > 12:
            y, m = y + 1, 1
    return out


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    months = month_list()
    with ThreadPoolExecutor(4) as ex:
        for ym, msg in ex.map(fetch_mig, months):
            print("ODRP011", ym, msg, flush=True)
        years = [str(y) for y in range(108, time.localtime().tm_year - 1911)]
        for y, msg in ex.map(fetch_pop, years):
            print("ODRP019", y, msg, flush=True)
