"""彙整實價登錄 (data_raw/lvr/*/lvr_landcsv.zip) -> data/prices.json

口徑
  * 交易日 2020-01-01 以後；以「交易年月日」歸屬季度/月份 (不是登錄日)
  * 住宅：主要用途含「住家用」，交易標的含建物
  * 單價中位數只用 區分所有住宅 (住宅大樓 / 華廈 / 公寓 / 套房)，透天厝單價含土地故不納入單價、但計入成交量與總價
  * 排除備註含 親友、員工、特殊關係、持分、地上權… 等特殊交易
  * 單價 = 官方「單價元平方公尺」(已扣除可拆分車位) × 3.305785 ÷ 10000 = 萬元/坪；保留 2–400 萬/坪
"""
import csv
import io
import json
import os
import re
import sys
import zipfile
from collections import defaultdict
from statistics import median

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data_raw", "lvr")
PING = 3.305785
csv.field_size_limit(1 << 30)

COUNTIES = ["臺北市", "新北市", "基隆市", "桃園市", "新竹市", "新竹縣", "苗栗縣", "臺中市", "彰化縣", "南投縣", "雲林縣",
            "嘉義市", "嘉義縣", "臺南市", "高雄市", "屏東縣", "宜蘭縣", "花蓮縣", "臺東縣", "澎湖縣", "金門縣", "連江縣"]
TYPES = [("大樓", "住宅大樓"), ("華廈", "華廈"), ("公寓", "公寓"), ("套房", "套房"), ("透天", "透天厝")]
APT = {"大樓", "華廈", "公寓", "套房"}
BAD = re.compile("親友|員工|共有人|特殊關係|親等|持分|地上權|債權|債務|瑕疵|急買|急賣|標售|政府機關|合建|受災|凶宅|毛胚")


def season_key(name):
    y, q = name.split("S")
    return int(y), int(q)


def fnum(v):
    try:
        return float(v)
    except Exception:
        return 0.0


def quant(xs, q):
    if not xs:
        return None
    xs = sorted(xs)
    k = (len(xs) - 1) * q
    lo = int(k)
    hi = min(lo + 1, len(xs) - 1)
    return xs[lo] + (xs[hi] - xs[lo]) * (k - lo)


def r1(v):
    return None if v is None else round(v, 1)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    seen = set()
    # (kind, county, quarter) -> lists ; kind: 'a' 成屋(中古+新成屋) / 'b' 預售
    unit = defaultdict(list)      # 單價 (區分所有住宅)
    total = defaultdict(list)     # 總價 萬
    area = defaultdict(list)      # 坪 (區分所有住宅, 扣車位)
    cnt = defaultdict(int)        # 住宅成交件數
    tcnt = defaultdict(int)       # (kind, county, quarter, type)
    munit = defaultdict(list)     # (kind, county, month)
    mcnt = defaultdict(int)
    tunit = defaultdict(list)     # (kind, county, town, year)
    tn = defaultdict(int)
    tlast = defaultdict(list)     # (county, town, 'cur'|'prev') 近四季 / 前四季 成屋單價
    stats = defaultdict(int)

    dirs = [d for d in os.listdir(RAW) if os.path.exists(os.path.join(RAW, d, "lvr_landcsv.zip"))]
    seasons = sorted([d for d in dirs if re.fullmatch(r"\d+S\d", d)], key=season_key)
    extra = sorted(d for d in dirs if d not in seasons)      # 季度檔之後的單期檔 (pYYYYMMDD) 與本期 (current)
    print("seasons:", seasons[0], "->", seasons[-1], len(seasons), "| extra:", extra)
    rows_all = []
    for s in seasons + extra:
        z = zipfile.ZipFile(os.path.join(RAW, s, "lvr_landcsv.zip"))
        man = {}
        for row in csv.reader(io.StringIO(z.read("manifest.csv").decode("utf-8-sig"))):
            if len(row) >= 3:
                man[row[0].lower()] = row[2]
        for name in z.namelist():
            m = re.fullmatch(r"([a-z])_lvr_land_([ab])\.csv", name.lower())
            if not m:
                continue
            kind = m.group(2)
            county = man.get(name.lower(), "")[:3]
            if county not in COUNTIES:
                continue
            text = z.read(name).decode("utf-8-sig", "replace").replace(chr(0), "")
            lines = text.splitlines()
            if not lines:
                continue
            head = lines[0].split(",")
            ix = {h: i for i, h in enumerate(head)}
            need = ["鄉鎮市區", "交易標的", "交易年月日", "建物型態", "主要用途", "建物移轉總面積平方公尺", "總價元", "單價元平方公尺",
                    "車位移轉總面積平方公尺", "車位總價元", "備註", "編號"]
            if any(n not in ix for n in need):
                print("  !! header mismatch", s, name)
                continue
            for line in lines[2:]:          # 第 2 列是英文欄名
                # 逐行解析：原始檔偶有未成對的引號，整檔交給 csv 會把後面的列吃掉
                try:
                    row = next(csv.reader([line]))
                except Exception:
                    row = line.split(",")
                if len(row) != len(head):
                    row = line.split(",")
                    if len(row) != len(head):
                        stats["bad_line"] += 1
                        continue
                stats["rows"] += 1
                rid = row[ix["編號"]]
                if rid in seen:
                    stats["dup"] += 1
                    continue
                seen.add(rid)
                d = row[ix["交易年月日"]].strip()
                if not d.isdigit() or len(d) < 6:
                    continue
                y, mo = int(d[:-4]) + 1911, int(d[-4:-2])
                if y < 2020 or not 1 <= mo <= 12:
                    continue
                if "建物" not in row[ix["交易標的"]] or "住家用" not in row[ix["主要用途"]]:
                    continue
                bt = row[ix["建物型態"]]
                typ = next((k for k, pat in TYPES if pat in bt), None)
                if typ is None:
                    continue
                if BAD.search(row[ix["備註"]]):
                    stats["special"] += 1
                    continue
                price = fnum(row[ix["總價元"]])
                if price <= 0:
                    continue
                barea = fnum(row[ix["建物移轉總面積平方公尺"]])
                parea = fnum(row[ix["車位移轉總面積平方公尺"]])
                pprice = fnum(row[ix["車位總價元"]])
                up = fnum(row[ix["單價元平方公尺"]])
                if up <= 0 and barea - parea > 0:
                    up = (price - pprice) / (barea - parea)
                wan_ping = up * PING / 10000
                rows_all.append((kind, county, row[ix["鄉鎮市區"]].strip(), y, mo, typ, price / 10000,
                                 wan_ping if 2 <= wan_ping <= 400 else 0.0, max(barea - parea, 0) / PING))
        print(" ", s, "kept so far", len(rows_all), flush=True)

    # 最後一個「完整」季度 = 最新季度檔案的季別 (交易日晚於它的資料尚未齊)
    ly, lq = season_key(seasons[-1])
    last_q = (ly + 1911, lq)
    quarters = []
    y, q = 2020, 1
    while (y, q) <= last_q:
        quarters.append(f"{y}Q{q}")
        q += 1
        if q > 4:
            y, q = y + 1, 1
    months = [f"{int(k[:4])}-{m:02d}" for k in quarters for m in range((int(k[5]) - 1) * 3 + 1, int(k[5]) * 3 + 1)]
    qi = {k: i for i, k in enumerate(quarters)}
    cur_q = set(quarters[-4:])
    prev_q = set(quarters[-8:-4])

    for kind, county, town, y, mo, typ, tot, up, ar in rows_all:
        qk = f"{y}Q{(mo - 1) // 3 + 1}"
        if qk not in qi:
            stats["after_last_q"] += 1
            continue
        mk = f"{y}-{mo:02d}"
        for c in (county, "全國"):
            cnt[kind, c, qk] += 1
            tcnt[kind, c, qk, typ] += 1
            total[kind, c, qk].append(tot)
            mcnt[kind, c, mk] += 1
            if typ in APT and up:
                unit[kind, c, qk].append(up)
                munit[kind, c, mk].append(up)
                if ar > 0:
                    area[kind, c, qk].append(ar)
        tn[kind, county, town, y] += 1
        if typ in APT and up:
            tunit[kind, county, town, y].append(up)
            if kind == "a":
                if qk in cur_q:
                    tlast[county, town, "cur"].append(up)
                elif qk in prev_q:
                    tlast[county, town, "prev"].append(up)

    def series(fn, keys):
        return [fn(k) for k in keys]

    out_q, out_m = {}, {}
    for c in ["全國"] + COUNTIES:
        e = {}
        for kind, pre in (("a", ""), ("b", "p")):
            e[pre + "n"] = series(lambda k: cnt.get((kind, c, k), 0), quarters)
            e[pre + "med"] = series(lambda k: r1(quant(unit.get((kind, c, k), []), .5)) if len(unit.get((kind, c, k), [])) >= 10 else None, quarters)
            e[pre + "total"] = series(lambda k: (round(median(total[kind, c, k])) if len(total.get((kind, c, k), [])) >= 5 else None), quarters)
        e["p25"] = series(lambda k: r1(quant(unit.get(("a", c, k), []), .25)) if len(unit.get(("a", c, k), [])) >= 8 else None, quarters)
        e["p75"] = series(lambda k: r1(quant(unit.get(("a", c, k), []), .75)) if len(unit.get(("a", c, k), [])) >= 8 else None, quarters)
        e["area"] = series(lambda k: r1(quant(area.get(("a", c, k), []), .5)) if len(area.get(("a", c, k), [])) >= 5 else None, quarters)
        e["nApt"] = series(lambda k: len(unit.get(("a", c, k), [])), quarters)
        # 近四季合併中位數 (樣本少的縣市用這個比較穩)：第 i 項 = 第 i-3 ~ i 季
        for kind, pre in (("a", ""), ("b", "p")):
            roll = []
            for i in range(len(quarters)):
                pool = [v for k in quarters[max(0, i - 3):i + 1] for v in unit.get((kind, c, k), [])]
                roll.append(r1(quant(pool, .5)) if i >= 3 and len(pool) >= 20 else None)
            e[pre + "med4"] = roll
        e["types"] = {t: series(lambda k: tcnt.get(("a", c, k, t), 0), quarters) for t, _ in TYPES}
        out_q[c] = e
        out_m[c] = {
            "n": series(lambda k: mcnt.get(("a", c, k), 0), months),
            "pn": series(lambda k: mcnt.get(("b", c, k), 0), months),
            "med": series(lambda k: r1(quant(munit.get(("a", c, k), []), .5)) if len(munit.get(("a", c, k), [])) >= 10 else None, months),
        }

    years = sorted({int(k[:4]) for k in quarters})
    towns = {}
    keys = {(c, t) for (_, c, t, _) in tn}
    for c, t in sorted(keys):
        if not t:
            continue
        rec = {"n": [tn.get(("a", c, t, y), 0) for y in years],
               "med": [r1(quant(tunit.get(("a", c, t, y), []), .5)) if len(tunit.get(("a", c, t, y), [])) >= 5 else None for y in years],
               "pn": [tn.get(("b", c, t, y), 0) for y in years],
               "pmed": [r1(quant(tunit.get(("b", c, t, y), []), .5)) if len(tunit.get(("b", c, t, y), [])) >= 5 else None for y in years]}
        cur, prev = tlast.get((c, t, "cur"), []), tlast.get((c, t, "prev"), [])
        rec["cur"] = [len(cur), r1(quant(cur, .5)) if len(cur) >= 5 else None]
        rec["prev"] = [len(prev), r1(quant(prev, .5)) if len(prev) >= 5 else None]
        towns.setdefault(c, {})[t] = rec

    out = {"source": "內政部不動產交易實價查詢服務網 開放資料", "url": "https://plvr.land.moi.gov.tw/DownloadOpenData",
           "seasons": [seasons[0], seasons[-1]], "extra": extra, "quarters": quarters, "months": months, "years": years,
           "counties": COUNTIES, "q": out_q, "m": out_m, "towns": towns, "stats": dict(stats, kept=len(rows_all))}
    path = os.path.join(ROOT, "data", "prices.json")
    json.dump(out, open(path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("stats", dict(stats), "kept", len(rows_all))
    print("saved", path, os.path.getsize(path) // 1024, "KB")
    for c in ["全國", "臺北市", "新北市", "臺中市", "高雄市", "新竹縣"]:
        print(c, "med", out_q[c]["med"][0], "->", out_q[c]["med"][-1], "| n", out_q[c]["n"][0], out_q[c]["n"][-1],
              "| presale", out_q[c]["pmed"][0], "->", out_q[c]["pmed"][-1])


if __name__ == "__main__":
    main()
