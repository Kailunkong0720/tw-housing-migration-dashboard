"""下載並解析「國泰房地產指數」季報新聞稿 (國泰建設 × 政治大學台灣房地產研究中心)。

來源: https://www.cathay-red.com.tw/tw/About/House   (圖表文轉載須註明出處)
取用: 表 1「各地區可能成交價與價量指數」— 可能成交價(萬/坪)、議價率(%)、30天銷售率(%)、成交量指數
推導: 開價 = 可能成交價 ÷ (1 − 議價率)    (議價率定義 = (開價 − 成交價) ÷ 開價)
輸出: data_raw/cathay/*.pdf 與 data/asking.json

需要: pip install pypdf
"""
import json
import os
import re
import sys
import time
import urllib.request

from pypdf import PdfReader

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data_raw", "cathay")
INDEX = "https://www.cathay-red.com.tw/tw/About/House"
HOST = "https://www.cathay-red.com.tw"
REGIONS = ["全國", "台北市", "新北市", "桃園市", "新竹縣市", "台中市", "台南市", "高雄市"]
UA = {"User-Agent": "Mozilla/5.0 (dashboard data fetch)"}


def http(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def links():
    html = http(INDEX).decode("utf-8", "replace")
    out = {}
    for href in re.findall(r'href="([^"]+news_Q\d\.pdf)"', html):
        m = re.search(r"(\d{3})news_Q(\d)\.pdf", href)
        y, q = int(m.group(1)), int(m.group(2))
        if y >= 109:
            out[(y, q)] = HOST + href
    return out


NUM = r"(-?\d+(?:\.\d+)?)"
FLAG = r"\s*(?:\([^)]*\))?\s*"      # (△) (+) (---) 等變動標記
ROW = re.compile(
    r"^\s*(全國|台北市|新北市|桃園市|新竹縣市|台中市|台南市|高雄市)\s+" + NUM + r"\s+" + NUM + r"\s*%" + FLAG +
    NUM + r"\s*%?\s+" + NUM + FLAG + NUM + r"\s*%?\s+" + NUM + FLAG + NUM, re.M)
# 完整季報(簡報)裡的彙總表: 地區 可能成交價 議價率% 推案戶數 30天銷售率%
ALT = re.compile(
    r"^\s*(全國|台北市|新北市|桃園市|新竹縣市|台中市|台南市|高雄市)\s+" + NUM + r"\s+" + NUM + r"%\s+[\d,]+\s+" + NUM + r"%", re.M)


def parse(path):
    text = "\n".join((p.extract_text() or "") for p in PdfReader(path).pages)
    seg = re.sub(r"新竹縣\s*市\s*", "新竹縣市 ", text)   # 舊版表格「新竹縣市」會斷行
    rows = {}
    for m in ROW.finditer(seg):
        name = m.group(1)
        if name in rows:
            continue
        price, _, nego, _, sales, _, vol = (float(x) for x in m.groups()[1:])
        rows[name] = {
            "deal": price, "nego": nego, "sale30": sales, "volIdx": vol,
            "ask": round(price / (1 - nego / 100), 2),
        }
    if len(rows) < 8:
        for m in ALT.finditer(seg):
            price, nego, sales = (float(x) for x in m.groups()[1:])
            rows.setdefault(m.group(1), {
                "deal": price, "nego": nego, "sale30": sales, "volIdx": None,
                "ask": round(price / (1 - nego / 100), 2)})
    return rows


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    os.makedirs(RAW, exist_ok=True)
    found = links()
    t = time.localtime()
    result = {}
    y, q = 109, 1
    while (y, q) <= (t.tm_year - 1911, (t.tm_mon - 1) // 3 + 1):
        key = f"{y + 1911}Q{q}"
        path = os.path.join(RAW, f"{y}news_Q{q}.pdf")
        if not os.path.exists(path):
            cands = [found.get((y, q))] + [
                f"{HOST}/Content/Upload/files/about/about-house/{kind}/{yy}/{y}{kind}_Q{q}.pdf"
                for kind in ("news", "report") for yy in (y + 1911, y + 1912)]
            for u in [c for c in cands if c]:
                try:
                    b = http(u)
                    if b[:4] == b"%PDF":
                        open(path, "wb").write(b)
                        break
                except Exception:
                    pass
        if os.path.exists(path):
            rows = parse(path)
            print(key, len(rows), "regions", "" if len(rows) == 8 else "<< CHECK", flush=True)
            if rows:
                result[key] = rows
        else:
            print(key, "pdf not found", flush=True)
        q += 1
        if q > 4:
            y, q = y + 1, 1
    out = {
        "source": "國泰房地產指數季報 (國泰建設、政治大學台灣房地產研究中心)",
        "url": INDEX,
        "note": "新推個案(預售+新成屋)。開價 = 可能成交價 ÷ (1 − 議價率)。",
        "regions": REGIONS,
        "quarters": result,
    }
    os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
    json.dump(out, open(os.path.join(ROOT, "data", "asking.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("saved data/asking.json", len(result), "quarters")
