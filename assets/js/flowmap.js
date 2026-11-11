/* 遷徙流向地圖：Leaflet + OpenStreetMap 底圖 + 自繪「戰略箭頭」SVG 圖層 */
(function () {
  'use strict';
  const TW = window.TW;
  const NS = 'http://www.w3.org/2000/svg';

  /* 箭頭端點 (人口重心附近，相鄰縣市刻意錯開以免箭頭重疊) [lat, lng] */
  TW.ANCHOR = {
    台北市: [25.09, 121.57], 新北市: [24.94, 121.4], 基隆市: [25.125, 121.74], 桃園市: [24.955, 121.2], 新竹市: [24.805, 120.955],
    新竹縣: [24.705, 121.125], 苗栗縣: [24.49, 120.86], 台中市: [24.19, 120.71], 彰化縣: [23.99, 120.48], 南投縣: [23.84, 120.93],
    雲林縣: [23.7, 120.39], 嘉義市: [23.48, 120.45], 嘉義縣: [23.43, 120.6], 台南市: [23.08, 120.24], 高雄市: [22.7, 120.36],
    屏東縣: [22.5, 120.6], 宜蘭縣: [24.69, 121.72], 花蓮縣: [23.85, 121.5], 台東縣: [22.9, 121.1], 澎湖縣: [23.57, 119.6],
    金門縣: [24.44, 118.36], 連江縣: [26.16, 119.95],
  };

  const svgEl = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };

  /* 計算一支錐形彎曲箭頭的外框路徑 */
  function arrowGeometry(p0, p1, w, bend) {
    const dx = p1.x - p0.x, dy = p1.y - p0.y, L = Math.hypot(dx, dy);
    if (L < 14) return null;
    const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;                 // 單位向量與法線
    const a = { x: p0.x + ux * Math.min(7, L * .12), y: p0.y + uy * Math.min(7, L * .12) };   // 起點離開圓點一點點
    const b = { x: p1.x - ux * Math.min(5, L * .08), y: p1.y - uy * Math.min(5, L * .08) };
    const k = L * bend;
    const c = { x: (a.x + b.x) / 2 + nx * k, y: (a.y + b.y) / 2 + ny * k };  // 控制點：往行進方向左側彎
    const pt = (t) => ({ x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y });
    const tan = (t) => { const x = 2 * (1 - t) * (c.x - a.x) + 2 * t * (b.x - c.x), y = 2 * (1 - t) * (c.y - a.y) + 2 * t * (b.y - c.y), m = Math.hypot(x, y) || 1; return { x: x / m, y: y / m }; };
    const curveLen = L * (1 + 1.6 * bend * bend);
    const headLen = Math.min(Math.max(w * 1.9, 11), curveLen * .42);
    const headHalf = Math.max(w * 1.15, 6.5);
    const tH = Math.max(.3, 1 - headLen / curveLen);
    const N = 22, left = [], right = [];
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * tH, p = pt(t), g = tan(t);
      const hw = (w / 2) * (0.22 + 0.78 * Math.pow(i / N, 0.75));           // 尾細頭粗
      left.push([p.x - g.y * hw, p.y + g.x * hw]); right.push([p.x + g.y * hw, p.y - g.x * hw]);
    }
    const ph = pt(tH), gh = tan(tH), tip = pt(1);
    const hl = [ph.x - gh.y * headHalf, ph.y + gh.x * headHalf], hr = [ph.x + gh.y * headHalf, ph.y - gh.x * headHalf];
    const f = (q) => q[0].toFixed(1) + ' ' + q[1].toFixed(1);
    const outline = 'M' + left.map(f).join('L') + 'L' + f(hl) + 'L' + tip.x.toFixed(1) + ' ' + tip.y.toFixed(1) + 'L' + f(hr) + 'L' + right.reverse().map(f).join('L') + 'Z';
    const spine = 'M' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) + 'Q' + c.x.toFixed(1) + ' ' + c.y.toFixed(1) + ' ' + ph.x.toFixed(1) + ' ' + ph.y.toFixed(1);
    const full = 'M' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) + 'Q' + c.x.toFixed(1) + ' ' + c.y.toFixed(1) + ' ' + b.x.toFixed(1) + ' ' + b.y.toFixed(1);
    return { outline, spine, full, a, b, tip, mid: pt(.5) };
  }

  TW.flowMap = function (el, opts) {
    opts = opts || {};
    const HOME = [[21.85, 119.95], [25.35, 122.05]], pad = () => ({ paddingTopLeft: [10, opts.padTop ? opts.padTop() : 52], paddingBottomRight: [10, opts.padBottom ? opts.padBottom() : 118] });  // 留出上下控制列的空間 (窄螢幕控制列會換行)
    const map = L.map(el, { center: [23.6, 121], zoom: 8, zoomSnap: .25, zoomDelta: .5, minZoom: 6, maxZoom: 12, maxBounds: [[19.5, 115], [28.5, 126]], attributionControl: true, wheelPxPerZoomLevel: 110 });
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '底圖 &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' }).addTo(map);
    map.getPane('tilePane').classList.add('dim');
    map.createPane('flows'); map.getPane('flows').style.zIndex = 450; map.getPane('flows').style.pointerEvents = 'none';

    let values = {}, vmax = 1, tipFn = null, focus = null;
    const styleOf = (name) => ({ color: name === focus ? '#fff' : TW.T.dark ? 'rgba(200,215,255,.55)' : 'rgba(40,55,100,.55)', weight: name === focus ? 2.4 : .8, fillColor: values[name] == null ? (TW.T.dark ? '#2a3350' : '#d7dcea') : TW.diverge(values[name] / vmax), fillOpacity: name === focus ? .5 : .62, className: 'county-shape' });
    const geo = L.geoJSON(TW.D.geo, {
      style: (f) => styleOf(f.properties.name),
      onEachFeature: (f, layer) => {
        const name = f.properties.name;
        layer.on('mouseover', (e) => { layer.setStyle({ fillOpacity: .85, weight: 2 }); if (tipFn) TW.tip.show(tipFn(name), e.originalEvent); });
        layer.on('mousemove', (e) => TW.tip.move(e.originalEvent));
        layer.on('mouseout', () => { layer.setStyle(styleOf(name)); TW.tip.hide(); });
        layer.on('click', () => opts.onSelect && opts.onSelect(name));
      },
    }).addTo(map);

    /* ---- 箭頭圖層 ---- */
    const svg = svgEl('svg', { class: 'flow-svg leaflet-zoom-hide' });
    map.getPane('flows').appendChild(svg);
    const uid = 'f' + Math.random().toString(36).slice(2, 7);
    let flows = [], hl = null;

    let dead = false;
    function draw() {
      if (dead) return;
      const size = map.getSize(), tl = map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(svg, tl);
      svg.setAttribute('width', size.x); svg.setAttribute('height', size.y);
      svg.setAttribute('viewBox', tl.x + ' ' + tl.y + ' ' + size.x + ' ' + size.y);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      if (!flows.length) return;
      const defs = svgEl('defs', {}, svg);
      const glow = svgEl('filter', { id: uid + 'glow', x: '-30%', y: '-30%', width: '160%', height: '160%' }, defs);
      svgEl('feGaussianBlur', { stdDeviation: TW.T.dark ? 4 : 2.2, result: 'b' }, glow);
      const merge = svgEl('feMerge', {}, glow); svgEl('feMergeNode', { in: 'b' }, merge); svgEl('feMergeNode', { in: 'SourceGraphic' }, merge);
      const max = Math.max.apply(null, flows.map((f) => f.value)) || 1;
      const zoomK = Math.max(.7, Math.min(1.5, 1 + (map.getZoom() - 7.5) * .22));
      const gArrows = svgEl('g', { filter: 'url(#' + uid + 'glow)' }, svg), gLabels = svgEl('g', {}, svg);
      const pts = {};
      const P = (name) => pts[name] || (pts[name] = map.latLngToLayerPoint(TW.ANCHOR[name]));
      /* 標籤避讓：記錄已放置的框，依序嘗試 上 / 下 / 右 / 左 */
      const boxes = [];
      const textW = (t) => { let w = 8; for (const ch of t) w += ch.charCodeAt(0) > 255 ? 12 : 6.8; return w; };
      const place = (text, x, y, big) => {
        const w = textW(text) * (big ? 1.12 : 1), hgt = big ? 17 : 15;
        const tries = [[x, y - 11], [x, y + 20], [x + w / 2 + 10, y + 4], [x - w / 2 - 10, y + 4], [x, y - 26], [x, y + 35]];
        for (const [cx, cy] of tries) {
          const b = [cx - w / 2, cy - hgt + 3, cx + w / 2, cy + 3];
          if (!boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) { boxes.push(b); return [cx, cy]; }
        }
        return null;
      };
      let focusLabel = null;
      if (focus && TW.ANCHOR[focus]) { const p = P(focus); focusLabel = place(focus, p.x, p.y + 31, true) || [p.x, p.y + 20]; boxes.push([p.x - 9, p.y - 9, p.x + 9, p.y + 9]); }
      /* 方向相近的箭頭輪流往兩側、且彎度遞增，像扇形展開而不疊在一起 */
      const sorted = flows.slice().sort((a, b) => b.value - a.value);
      const vec = sorted.map((f) => { const a = P(f.from), b = P(f.to), rev = focus && f.to === focus ? -1 : 1; return { ang: Math.atan2((b.y - a.y) * rev, (b.x - a.x) * rev), len: Math.hypot(b.x - a.x, b.y - a.y) }; });
      sorted.forEach((f, i) => {
        let k = 0;
        for (let j = 0; j < i; j++) { let d = Math.abs(vec[i].ang - vec[j].ang); if (d > Math.PI) d = 2 * Math.PI - d; if (d < 0.45 && vec[j].len > vec[i].len * 0.4) k++; }
        const rev = focus && f.to === focus ? -1 : 1;
        const bend = f.bend != null ? f.bend : rev * (k % 2 === 0 ? 1 : -1) * (0.16 + 0.15 * Math.floor(k / 2));
        const w = (4 + 25 * Math.sqrt(f.value / max)) * zoomK;
        const geom = arrowGeometry(P(f.from), P(f.to), w, bend);
        if (!geom) return;
        const color = f.color, id = uid + 'g' + i;
        const grad = svgEl('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: geom.a.x, y1: geom.a.y, x2: geom.tip.x, y2: geom.tip.y }, defs);
        svgEl('stop', { offset: '0', 'stop-color': color, 'stop-opacity': .28 }, grad);
        svgEl('stop', { offset: '.5', 'stop-color': color, 'stop-opacity': .92 }, grad);
        svgEl('stop', { offset: '1', 'stop-color': f.color2 || color, 'stop-opacity': 1 }, grad);
        const g = svgEl('g', { class: 'arrow' + (hl === f.key ? ' hl' : ''), 'data-key': f.key }, gArrows);
        svgEl('path', { d: geom.outline, fill: 'none', stroke: 'rgba(8,10,20,.55)', 'stroke-width': 3.2, 'stroke-linejoin': 'round' }, g);
        svgEl('path', { d: geom.outline, fill: 'url(#' + id + ')', stroke: f.color2 || color, 'stroke-width': 1, 'stroke-opacity': .95, 'stroke-linejoin': 'round' }, g);
        svgEl('path', { d: geom.spine, class: 'dash', 'stroke-width': Math.max(1.1, w * .14) }, g);
        const hit = svgEl('path', { d: geom.full, class: 'hit', 'stroke-width': Math.max(14, w + 6) }, g);
        hit.addEventListener('mouseenter', (e) => { api.highlight(f.key); if (f.tip) TW.tip.show(f.tip, e); opts.onHover && opts.onHover(f.key); });
        hit.addEventListener('mousemove', (e) => TW.tip.move(e));
        hit.addEventListener('mouseleave', () => { api.highlight(null); TW.tip.hide(); opts.onHover && opts.onHover(null); });
        hit.addEventListener('click', () => f.onClick && f.onClick());
        if (f.label) {
          const at = f.labelAt === 'tail' ? P(f.from) : f.labelAt === 'mid' ? geom.mid : P(f.to);
          const pos = place(f.label, at.x, f.labelAt === 'mid' ? at.y + 5 : at.y);
          if (pos) { const t = svgEl('text', { class: 'lbl', x: pos[0].toFixed(1), y: pos[1].toFixed(1), 'text-anchor': 'middle' }, gLabels); t.textContent = f.label; }
        }
      });
      if (focus && TW.ANCHOR[focus]) {
        const p = P(focus), col = opts.focusColor ? opts.focusColor() : '#fff';
        svgEl('circle', { cx: p.x, cy: p.y, r: 9, fill: 'none', stroke: col, 'stroke-width': 2, class: 'pulse' }, svg);
        svgEl('circle', { cx: p.x, cy: p.y, r: 5.5, fill: col, stroke: '#fff', 'stroke-width': 1.6 }, svg);
        const t = svgEl('text', { class: 'lbl', x: focusLabel[0], y: focusLabel[1], 'text-anchor': 'middle', style: 'font-size:13px' }, svg); t.textContent = focus;
      }
      svg.classList.toggle('dimmed', !!hl);
    }
    map.on('moveend zoomend viewreset resize', draw);

    const api = {
      map,
      setChoropleth(vals, maxAbs, tf) { values = vals || {}; vmax = maxAbs || 1; tipFn = tf; geo.eachLayer((l) => l.setStyle(styleOf(l.feature.properties.name))); },
      setFlows(list, f) { flows = list || []; focus = f || null; geo.eachLayer((l) => l.setStyle(styleOf(l.feature.properties.name))); draw(); },
      highlight(key) { hl = key; svg.classList.toggle('dimmed', !!key); Array.prototype.forEach.call(svg.querySelectorAll('.arrow'), (g) => g.classList.toggle('hl', g.getAttribute('data-key') === key)); },
      fit(names) { const ll = names.filter((n) => TW.ANCHOR[n]).map((n) => TW.ANCHOR[n]); if (ll.length > 1) map.flyToBounds(L.latLngBounds(ll).pad(.3), { maxZoom: 9.5, duration: .6 }); },
      home() { map.flyToBounds(HOME, Object.assign({ duration: .5 }, pad())); },
      dim(on) { map.getPane('tilePane').classList.toggle('dim', on); },
      refresh() { if (!dead) { map.invalidateSize(); draw(); } },
      destroy() { dead = true; map.off(); map.remove(); },
    };
    setTimeout(() => { if (dead) return; map.invalidateSize(); map.fitBounds(HOME, Object.assign({ animate: false }, pad())); draw(); }, 60);
    return api;
  };
})();
