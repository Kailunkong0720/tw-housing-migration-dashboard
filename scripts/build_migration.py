"""彙整戶政司遷徙資料 (data_raw/ris) -> data/migration.json

指標定義 (縣市層級，單位：人)
  tin / tout  = 遷入合計 / 遷出合計，扣掉「本縣市內其他鄉鎮市區」(縣內搬家)
  din / dout  = 國內跨縣市遷入 / 遷出 (自/往 其他縣市)
  fin / fout  = 自國外遷入 + 初設戶籍 + 其他 / 往國外遷出 + 廢止戶籍 + 其他
  淨遷入       = tin − tout ；國內淨遷入 = din − dout
OD (起訖) 資料
  odm  : ODRP011，六都 ↔ 各縣市，2020/01 起每月完整
  full : ODRP094，完整 22×22，僅部分月份
"""
import glob
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data_raw", "ris")
COUNTIES = ["臺北市", "新北市", "基隆市", "桃園市", "新竹市", "新竹縣", "苗栗縣", "臺中市", "彰化縣", "南投縣", "雲林縣",
            "嘉義市", "嘉義縣", "臺南市", "高雄市", "屏東縣", "宜蘭縣", "花蓮縣", "臺東縣", "澎湖縣", "金門縣", "連江縣"]
MUNI = [("新北市", "ntp"), ("臺北市", "tp"), ("桃園市", "ty"), ("臺中市", "tc"), ("臺南市", "tn"), ("高雄市", "kh")]
DOM = ["ntp", "tp", "ty", "tc", "tn", "kh", "tw", "fu", "other", "other_city"]


def tw(s):
    return s.replace("臺", "台")


def ym(code):
    return f"{int(code[:-2]) + 1911}-{code[-2:]}"


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    files = sorted(glob.glob(os.path.join(RAW, "odrp011_*.json")), key=lambda p: int(os.path.basename(p)[8:-5]))
    months = []
    m = {c: {k: [] for k in ("tin", "tout", "din", "dout", "fin", "fout", "intra")} for c in COUNTIES}
    odm = {mu: {c: {"to": [], "from": []} for c in COUNTIES} for mu, _ in MUNI}
    town_year = {}   # (county, town) -> year -> [in, out] (含縣內跨區)
    for path in files:
        d = json.load(open(path, encoding="utf-8"))
        fi = {f: i for i, f in enumerate(d["fields"])}
        code = d["yyymm"]
        months.append(ym(code))
        year = int(code[:-2]) + 1911
        for c in COUNTIES:
            v = d["county"].get(c)
            g = (lambda k: v[fi[k]]) if v else (lambda k: 0)
            m[c]["intra"].append(g("in_other_town"))
            m[c]["tin"].append(g("in_total") - g("in_other_town"))
            m[c]["tout"].append(g("out_total") - g("out_other_town"))
            m[c]["din"].append(sum(g("in_" + k) for k in DOM))
            m[c]["dout"].append(sum(g("out_" + k) for k in DOM))
            m[c]["fin"].append(g("in_foreign") + g("first_reg") + g("move_in_other"))
            m[c]["fout"].append(g("out_foreign") + g("deleted_reg") + g("move_out_other"))
            for mu, key in MUNI:
                odm[mu][c]["to"].append(g("in_" + key))      # 六都 mu -> 縣市 c
                odm[mu][c]["from"].append(g("out_" + key))   # 縣市 c -> 六都 mu
        for site, v in d["town"].items():
            c, t = site[:3], site[3:]
            rec = town_year.setdefault((c, t), {}).setdefault(year, [0, 0])
            rec[0] += v[fi["in_total"]]
            rec[1] += v[fi["out_total"]]

    years = sorted({int(x[:4]) for x in months})
    pop, tpop = {}, {}
    for path in glob.glob(os.path.join(RAW, "pop_*.json")):
        d = json.load(open(path, encoding="utf-8"))
        y = int(d["year"]) + 1911
        for c, v in d["county"].items():
            pop.setdefault(c, {})[y] = v[1]
        for site, v in d["town"].items():
            tpop.setdefault((site[:3], site[3:]), {})[y] = v[1]

    towns = {}
    for (c, t), ys in town_year.items():
        if c not in COUNTIES:
            continue
        p = tpop.get((c, t), {})
        towns.setdefault(tw(c), {})[t] = {
            "in": [ys.get(y, [0, 0])[0] for y in years], "out": [ys.get(y, [0, 0])[1] for y in years],
            "pop": p.get(max(p)) if p else None, "pop0": p.get(min(p)) if p else None}

    full_months, full = [], {}
    for path in sorted(glob.glob(os.path.join(RAW, "od_*.json")), key=lambda p: int(os.path.basename(p)[3:-5])):
        d = json.load(open(path, encoding="utf-8"))
        full_months.append(ym(d["yyymm"]))
        for o in COUNTIES:
            for dest in COUNTIES:
                if o != dest:
                    full.setdefault(tw(o), {}).setdefault(tw(dest), []).append(d["od"].get(o, {}).get(dest, 0))

    out = {
        "source": "內政部戶政司 人口統計資料 開放資料 API (ODRP011 遷入遷出統計表、ODRP094 縣市間遷徙、ODRP019 人口數)",
        "url": "https://www.ris.gov.tw/rs-opendata/api/Main/docs/v1",
        "months": months, "years": years, "counties": [tw(c) for c in COUNTIES], "muni": [tw(mu) for mu, _ in MUNI],
        "pop": {tw(c): {str(y): v for y, v in sorted(ys.items())} for c, ys in pop.items() if c in COUNTIES},
        "m": {tw(c): v for c, v in m.items()},
        "odm": {tw(mu): {tw(c): v for c, v in cs.items() if c != mu} for mu, cs in odm.items()},
        "fullMonths": full_months, "full": full, "towns": towns,
    }
    path = os.path.join(ROOT, "data", "migration.json")
    json.dump(out, open(path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("months", months[0], "->", months[-1], len(months), "| full OD months", len(full_months))
    print("saved", path, os.path.getsize(path) // 1024, "KB")
    for c in ["臺北市", "新北市", "桃園市", "臺中市", "新竹縣"]:
        net = [sum(m[c]["din"][i] - m[c]["dout"][i] for i, mm in enumerate(months) if mm.startswith(str(y))) for y in years]
        print(c, "國內淨遷入 by year", dict(zip(years, net)))
    # 六都之間同一筆流量兩端各記一次，應一致
    a = sum(odm["新北市"]["臺北市"]["to"]); b = sum(odm["臺北市"]["新北市"]["from"])
    print("check 新北->台北:", a, "vs", b)


if __name__ == "__main__":
    main()
