"""把 taiwan-atlas 的縣市界 TopoJSON 轉成 GeoJSON (data/counties.geojson)。

來源: https://github.com/dkaoster/taiwan-atlas (MIT) — 原始圖資為內政部國土測繪中心「直轄市、縣市界線」
"""
import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
topo = json.load(open(os.path.join(ROOT, "data_raw", "geo", "counties-10t.json"), encoding="utf-8"))
sx, sy = topo["transform"]["scale"]
tx, ty = topo["transform"]["translate"]

arcs = []
for arc in topo["arcs"]:
    x = y = 0
    pts = []
    for dx, dy in arc:
        x += dx
        y += dy
        pts.append([round(x * sx + tx, 4), round(y * sy + ty, 4)])
    arcs.append(pts)


def ring(idx):
    out = []
    for i in idx:
        a = arcs[i] if i >= 0 else arcs[~i][::-1]
        out += a[1:] if out else a
    # 去掉取整後重複的點
    dedup = [out[0]]
    for p in out[1:]:
        if p != dedup[-1]:
            dedup.append(p)
    return dedup


def geom(g):
    if g["type"] == "Polygon":
        return {"type": "Polygon", "coordinates": [ring(r) for r in g["arcs"]]}
    polys = [[ring(r) for r in poly] for poly in g["arcs"]]
    polys = [p for p in polys if len(p[0]) >= 4]
    return {"type": "MultiPolygon", "coordinates": polys}


obj = topo["objects"][list(topo["objects"])[0]]
feats = []
for g in obj["geometries"]:
    p = g.get("properties", {})
    feats.append({"type": "Feature", "properties": {"name": p.get("COUNTYNAME"), "id": p.get("COUNTYID"), "code": p.get("COUNTYCODE")},
                  "geometry": geom(g)})
out = os.path.join(ROOT, "data", "counties.geojson")
json.dump({"type": "FeatureCollection", "features": feats}, open(out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(len(feats), "counties ->", out, os.path.getsize(out) // 1024, "KB")
print([f["properties"]["name"] for f in feats])
