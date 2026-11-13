/* 台灣房價與人口遷徙觀測站 — 核心：資料存取、工具、主題、路由、共用圖表設定 */
(function () {
  'use strict';
  const D = window.TWDATA;
  const P = D.prices, A = D.asking, M = D.migration;
  const TW = (window.TW = { D, P, A, M, pages: {}, state: {} });

  /* ---------- 基本工具 ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nf0 = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat('zh-TW', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fmt = (v, d) => (v == null || isNaN(v) ? '—' : d === 1 ? nf1.format(v) : d === 2 ? v.toFixed(2) : nf0.format(v));
  const sign = (v, d) => (v == null || isNaN(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v), d));
  const pct = (v, d) => (v == null || isNaN(v) ? '—' : sign(v, d == null ? 1 : d) + '%');
  const wan = (v) => (v == null ? '—' : Math.abs(v) >= 10000 ? (v / 10000).toFixed(Math.abs(v) >= 100000 ? 1 : 2) + ' 萬' : nf0.format(v));
  const cls = (v) => (v == null || isNaN(v) || v === 0 ? 'mut' : v > 0 ? 'up' : 'down');
  const sum = (a, i0, i1) => { let s = 0; for (let i = i0 == null ? 0 : i0; i <= (i1 == null ? a.length - 1 : i1); i++) s += a[i] || 0; return s; };
  const last = (a) => a[a.length - 1];
  const yoy = (arr, i, lag) => { const b = arr[i - (lag || 4)], a = arr[i]; return a != null && b ? (a / b - 1) * 100 : null; };
  Object.assign(TW, { $, $$, h, esc, fmt, sign, pct, wan, cls, sum, last, yoy });

  /* ---------- 統計 ---------- */
  TW.pearson = (xs, ys) => {
    const n = xs.length; if (n < 3) return null;
    const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
    return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
  };
  const rank = (a) => { const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]); const r = []; idx.forEach(([, i], k) => (r[i] = k + 1)); return r; };
  TW.spearman = (xs, ys) => TW.pearson(rank(xs), rank(ys));
  TW.linreg = (xs, ys) => {
    const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
    const b = sxx ? sxy / sxx : 0; return { a: my - b * mx, b };
  };
  TW.rDesc = (r) => { const a = Math.abs(r); return (a >= .7 ? '強' : a >= .4 ? '中度' : a >= .2 ? '弱' : '幾乎無') + (a >= .2 ? (r > 0 ? '正相關' : '負相關') : '相關'); };

  /* ---------- 資料輔助 ---------- */
  const Q = P.quarters, MO = M.months;
  TW.C = P.counties;                               // 22 縣市 (北→南)
  TW.C21 = TW.C.filter((c) => c !== '連江縣');      // 連江成交太少，價格圖表略過
  TW.MUNI = ['台北市', '新北市', '桃園市', '台中市', '台南市', '高雄市'];
  TW.LQ = Q.length - 2;                            // 最新「資料大致齊全」季度；最後一季登錄尚未齊
  /* 2020 全年 → 近四季 的單價漲幅 (%)，用四季合併中位數，樣本少的縣市較穩 */
  TW.chg20 = (c) => { const m = P.q[c].med4; return m[3] && m[TW.LQ] ? (m[TW.LQ] / m[3] - 1) * 100 : null; };
  TW.qLabel = (q) => q.replace('Q', ' Q');
  TW.short = (c) => c.replace(/[縣市]$/, '');
  TW.isMuni = (c) => TW.MUNI.includes(c);
  // 期間 (月份索引) 工具
  TW.yearRange = (y) => { const i0 = MO.findIndex((m) => m.startsWith(y + '-')); let i1 = i0; while (i1 + 1 < MO.length && MO[i1 + 1].startsWith(y + '-')) i1++; return [i0, i1]; };
  TW.rangeLabel = (i0, i1) => (i0 === 0 && i1 === MO.length - 1 ? '2020/01–' + MO[i1].replace('-', '/') : MO[i0].replace('-', '/') + '–' + MO[i1].replace('-', '/'));
  TW.popOf = (c, y) => { const p = M.pop[c] || {}; const ys = Object.keys(p).map(Number).sort(); if (!ys.length) return null; const k = Math.max(ys[0], Math.min(last(ys), y)); return p[k] != null ? p[k] : p[last(ys)]; };
  const fullIdx = {}; M.fullMonths.forEach((m, k) => (fullIdx[m] = k));
  /* ODRP094 (完整 22×22) 在期間內的月份涵蓋率 */
  TW.fullCov = (i0, i1) => { let n = 0; for (let i = i0; i <= i1; i++) if (MO[i] in fullIdx) n++; return n / (i1 - i0 + 1); };
  TW.hasFull = (i0, i1) => TW.fullCov(i0, i1) >= 0.9;
  /* a -> b 的遷徙人數。六都相關的流向 2020 起每月都有；
     非六都之間只有 ODRP094 有資料的月份 (涵蓋率 ≥ 90% 才採用)，否則回傳 null */
  TW.flow = (a, b, i0, i1) => {
    if (a === b) return 0;
    if (M.odm[a]) return sum(M.odm[a][b].to, i0, i1);
    if (M.odm[b]) return sum(M.odm[b][a].from, i0, i1);
    if (!TW.hasFull(i0, i1)) return null;
    const arr = (M.full[a] || {})[b]; if (!arr) return null;
    let s = 0; for (let i = i0; i <= i1; i++) { const k = fullIdx[MO[i]]; if (k != null) s += arr[k] || 0; } return s;
  };
  TW.mig = (c, key, i0, i1) => sum(M.m[c][key], i0, i1);
  TW.netDom = (c, i0, i1) => TW.mig(c, 'din', i0, i1) - TW.mig(c, 'dout', i0, i1);
  /* 年化國內淨遷入率 (‰) */
  TW.netRate = (c, i0, i1) => { const y = +MO[Math.round((i0 + i1) / 2)].slice(0, 4); const p = TW.popOf(c, y); return p ? (TW.netDom(c, i0, i1) / p) * 1000 * (12 / (i1 - i0 + 1)) : null; };

  /* ---------- 主題 ---------- */
  let T = {};
  const readTheme = () => {
    const cs = getComputedStyle(document.documentElement);
    const v = (n) => cs.getPropertyValue(n).trim();
    T = { text: v('--text'), text2: v('--text-2'), muted: v('--muted'), grid: v('--grid'), line: v('--line-2'), panel: v('--panel'), panel2: v('--panel-2'), bg: v('--bg'),
      accent: v('--accent'), deal: v('--c-deal'), ask: v('--c-ask'), pre: v('--c-pre'), in: v('--c-in'), out: v('--c-out'), up: v('--up'), down: v('--down'),
      series: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => v('--s' + i)), dark: document.documentElement.dataset.theme === 'dark' };
    TW.T = T;
  };
  TW.setTheme = (t) => { document.documentElement.dataset.theme = t; try { localStorage.setItem('tw-theme', t); } catch (e) {} readTheme(); TW.render(); };
  /* 發散色 (藍 = 淨遷入 / 紅 = 淨遷出)，中點為中性灰 */
  TW.diverge = (t) => { // t ∈ [-1, 1]
    const mid = T.dark ? [56, 62, 84] : [226, 229, 238], pos = T.dark ? [57, 150, 255] : [30, 110, 215], neg = T.dark ? [255, 82, 82] : [215, 48, 48];
    const k = Math.min(1, Math.abs(t)), e = t >= 0 ? pos : neg;
    return 'rgb(' + mid.map((m, i) => Math.round(m + (e[i] - m) * k)).join(',') + ')';
  };
  TW.seq = (t, hue) => { // 單一色相由淺到深 (t ∈ [0,1])
    const lo = T.dark ? [30, 42, 78] : [222, 232, 250], hi = hue === 'warm' ? (T.dark ? [255, 150, 60] : [200, 90, 10]) : (T.dark ? [90, 170, 255] : [20, 80, 170]);
    const k = Math.max(0, Math.min(1, t));
    return 'rgb(' + lo.map((m, i) => Math.round(m + (hi[i] - m) * k)).join(',') + ')';
  };

  /* ---------- ECharts 共用 ---------- */
  let charts = [];
  TW.chart = (el, option) => {
    const dom = typeof el === 'string' ? $(el) : el; if (!dom) return null;
    const c = echarts.init(dom, null, { renderer: 'canvas' });
    c.setOption(option); charts.push(c); return c;
  };
  const disposeCharts = () => { charts.forEach((c) => { try { c.dispose(); } catch (e) {} }); charts = []; };
  window.addEventListener('resize', () => charts.forEach((c) => c.resize()));
  TW.resizeCharts = () => charts.forEach((c) => c.resize());
  TW.tipBox = () => ({ backgroundColor: T.panel2, borderColor: T.line, borderWidth: 1, padding: [8, 11], textStyle: { color: T.text, fontSize: 12.5 }, extraCssText: 'border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.25);' });
  TW.base = (o) => Object.assign({
    animationDuration: 500, textStyle: { fontFamily: getComputedStyle(document.body).fontFamily, color: T.text2 }, color: T.series,
    grid: { left: 8, right: 14, top: 34, bottom: 6, containLabel: true },
    tooltip: Object.assign({ trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: T.muted, type: 'dashed' } }, confine: true }, TW.tipBox()),
    legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 14, itemHeight: 4, itemGap: 14, textStyle: { color: T.text2, fontSize: 12 }, inactiveColor: T.muted, type: 'scroll', pageTextStyle: { color: T.muted }, pageIconColor: T.text2 },
  }, o || {});
  TW.xCat = (data, o) => Object.assign({ type: 'category', data, boundaryGap: false, axisLine: { lineStyle: { color: T.line } }, axisTick: { show: false }, axisLabel: { color: T.muted, fontSize: 11, hideOverlap: true } }, o || {});
  TW.yVal = (o) => Object.assign({ type: 'value', scale: true, splitLine: { lineStyle: { color: T.grid } }, axisLabel: { color: T.muted, fontSize: 11 }, axisLine: { show: false }, nameTextStyle: { color: T.muted, fontSize: 11, align: 'left' } }, o || {});
  TW.line = (name, data, color, o) => Object.assign({ name, type: 'line', data, showSymbol: false, symbol: 'circle', symbolSize: 7, smooth: .15, lineStyle: { width: 2, color }, itemStyle: { color }, emphasis: { focus: 'series' }, connectNulls: true }, o || {});
  TW.qAxisLabels = () => Q.map((q, i) => (i === Q.length - 1 ? q + '*' : q));
  /* tooltip 內容：標題 + 多列 */
  TW.tipRows = (title, rows) => '<b>' + esc(title) + '</b>' + rows.map((r) => '<div style="display:flex;justify-content:space-between;gap:18px"><span>' + (r[2] ? '<i style="display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px;background:' + r[2] + '"></i>' : '') + esc(r[0]) + '</span><b style="font-variant-numeric:tabular-nums">' + r[1] + '</b></div>').join('');

  /* 迷你走勢 (SVG) */
  TW.spark = (vals, color, w, hgt) => {
    const v = vals.filter((x) => x != null); if (v.length < 2) return '';
    w = w || 120; hgt = hgt || 36; const mn = Math.min(...v), mx = Math.max(...v), n = vals.length;
    const pts = vals.map((x, i) => (x == null ? null : [(i / (n - 1)) * w, hgt - 3 - ((x - mn) / (mx - mn || 1)) * (hgt - 6)])).filter(Boolean);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
    return '<svg viewBox="0 0 ' + w + ' ' + hgt + '" width="' + w + '" height="' + hgt + '" preserveAspectRatio="none" aria-hidden="true"><path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="' + last(pts)[0].toFixed(1) + '" cy="' + last(pts)[1].toFixed(1) + '" r="2.6" fill="' + color + '"/></svg>';
  };

  /* 共用控制元件 */
  TW.seg = (opts, cur, onPick) => {
    const el = h('<div class="seg" role="tablist"></div>');
    opts.forEach(([val, label]) => { const b = h('<button type="button" role="tab">' + esc(label) + '</button>'); if (val === cur) b.classList.add('on'); b.onclick = () => { $$('button', el).forEach((x) => x.classList.remove('on')); b.classList.add('on'); onPick(val); }; el.appendChild(b); });
    return el;
  };
  TW.chips = (items, selected, onChange, o) => {
    o = o || {}; const el = h('<div class="chips"></div>');
    const paint = () => $$('.chip', el).forEach((b) => { const on = selected.includes(b.dataset.v); b.classList.toggle('on', on); const d = $('.dot', b); if (d) d.style.background = on && o.color ? o.color(b.dataset.v) : ''; });
    items.forEach((it) => {
      const b = h('<button type="button" class="chip" data-v="' + esc(it) + '">' + (o.color ? '<i class="dot"></i>' : '') + esc(o.label ? o.label(it) : it) + '</button>');
      b.onclick = () => {
        if (o.single) { selected.length = 0; selected.push(it); }
        else { const i = selected.indexOf(it); if (i >= 0) { if (selected.length > 1) selected.splice(i, 1); } else { if (o.max && selected.length >= o.max) selected.shift(); selected.push(it); } }
        paint(); onChange(selected);
      };
      el.appendChild(b);
    });
    paint(); return el;
  };
  /* 每個縣市固定一個顏色位置 (顏色跟著縣市，不跟著排名) */
  TW.countyColor = (c, list) => T.series[Math.max(0, list.indexOf(c)) % T.series.length];
  /* 可排序表格 */
  TW.table = (wrap, cols, rows, o) => {
    o = o || {}; let sortK = o.sort == null ? 0 : o.sort, asc = !!o.asc;
    const draw = () => {
      const c = cols[sortK]; const data = rows.slice().sort((a, b) => { const x = c.val(a), y = c.val(b); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (typeof x === 'string' ? x.localeCompare(y, 'zh-TW') : x - y) * (asc ? 1 : -1); });
      wrap.innerHTML = '<table class="tbl"><thead><tr>' + cols.map((c2, i) => '<th data-i="' + i + '" class="' + (c2.left ? 'l ' : '') + (i === sortK ? 'sorted' + (asc ? ' asc' : '') : '') + '">' + c2.name + '</th>').join('') + '</tr></thead><tbody>' +
        data.slice(0, o.limit || 500).map((r) => '<tr data-k="' + esc(o.key ? o.key(r) : '') + '">' + cols.map((c2) => '<td class="' + (c2.left ? 'l ' : '') + (c2.cls ? c2.cls(r) : '') + '">' + (c2.html ? c2.html(r) : esc(c2.val(r) == null ? '—' : c2.val(r))) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
      $$('th', wrap).forEach((th) => (th.onclick = () => { const i = +th.dataset.i; if (i === sortK) asc = !asc; else { sortK = i; asc = !!cols[i].left; } draw(); }));
      if (o.onRow) $$('tbody tr', wrap).forEach((tr) => (tr.onclick = () => o.onRow(tr.dataset.k, tr)));
    };
    draw(); return { redraw: (r) => { rows = r; draw(); } };
  };
  /* 浮動提示 */
  const tipEl = () => $('#tip');
  TW.tip = { show: (html, ev) => { const t = tipEl(); t.innerHTML = html; t.hidden = false; TW.tip.move(ev); }, move: (ev) => { const t = tipEl(); const x = Math.min(window.innerWidth - t.offsetWidth - 12, ev.clientX + 14), y = Math.min(window.innerHeight - t.offsetHeight - 12, ev.clientY + 14); t.style.left = x + 'px'; t.style.top = y + 'px'; }, hide: () => (tipEl().hidden = true) };

  /* ---------- 圖示 ---------- */
  const IC = {
    grid: '<path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z"/>', trend: '<path d="M3 17l6-6 4 4 8-9"/><path d="M15 6h6v6"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="8" cy="9" r="1.4"/>', pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 005 9.500C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.500" r="2.500"/>',
    flow: '<path d="M4 19c7-1 11-5 13-12"/><path d="M12 6l5 1-1 5"/><circle cx="4" cy="19" r="1.500"/>', swap: '<path d="M4 8h14l-4-4M20 16H6l4 4"/>',
    scatter: '<path d="M4 4v16h16"/><circle cx="9" cy="14" r="1.600"/><circle cx="13" cy="10" r="1.600"/><circle cx="17" cy="7" r="1.600"/><circle cx="16" cy="14" r="1.600"/>',
    db: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.700 3.100 3 7 3s7-1.300 7-3V6M5 12v6c0 1.700 3.100 3 7 3s7-1.300 7-3v-6"/>',
    chev: '<path d="M14 6l-6 6 6 6"/>', menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', search: '<circle cx="11" cy="11" r="6.500"/><path d="M16 16l4.500 4.500"/>',
    full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', moon: '<path d="M20 14.500A8 8 0 019.500 4 8 8 0 1020 14.500z"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
    play: '<path d="M7 5l12 7-12 7z" fill="currentColor"/>', pause: '<path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor"/>',
  };
  TW.icon = (n) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.800" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[n] || '') + '</svg>';
  const paintIcons = (root) => $$('i[data-ic]', root).forEach((i) => (i.innerHTML = TW.icon(i.dataset.ic)));
  TW.paintIcons = paintIcons;

  /* ---------- 路由 ---------- */
  let cleanup = null, lastRoute = null;
  TW.route = () => (location.hash.replace(/^#\/?/, '').split('?')[0] || 'overview');
  TW.render = () => {
    const r = TW.pages[TW.route()] ? TW.route() : 'overview';
    if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
    disposeCharts(); TW.tip.hide();
    const view = $('#view'); view.innerHTML = '';
    $$('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === r));
    cleanup = TW.pages[r](view) || null;
    if (r !== lastRoute) { window.scrollTo(0, 0); lastRoute = r; }
    paintIcons(view);
    document.title = ($('#nav a.active span') || {}).textContent + '｜台灣房價與人口遷徙觀測站';
  };
  TW.head = (crumb, title, desc, asof) => '<div class="page-head"><div><div class="crumb">' + esc(crumb) + '</div><h1>' + esc(title) + '</h1><p>' + desc + '</p></div><span class="spacer"></span>' + (asof ? '<span class="asof">' + asof + '</span>' : '') + '</div>';
  TW.go = (r) => { if (TW.route() === r) TW.render(); else location.hash = '#/' + r; };

  /* ---------- 啟動 ---------- */
  TW.start = () => {
    let theme = 'dark'; try { theme = localStorage.getItem('tw-theme') || 'dark'; } catch (e) {}
    document.documentElement.dataset.theme = theme; readTheme();
    let fc = '台北市'; try { fc = localStorage.getItem('tw-focus') || fc; } catch (e) {}
    TW.state.county = TW.C.includes(fc) ? fc : '台北市';
    paintIcons(document);
    $('#builtAt').textContent = D.built.slice(0, 10);
    const sel = $('#focusCounty');
    sel.innerHTML = TW.C.map((c) => '<option>' + c + '</option>').join(''); sel.value = TW.state.county;
    sel.onchange = () => TW.setCounty(sel.value);
    const themeBtn = $('#themeBtn');
    const paintTheme = () => (themeBtn.innerHTML = '<i>' + TW.icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon') + '</i>');
    paintTheme(); themeBtn.onclick = () => { TW.setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); paintTheme(); };
    $('#fsBtn').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}));
    const app = $('#app');
    try { if (localStorage.getItem('tw-collapsed') === '1') app.classList.add('collapsed'); } catch (e) {}
    $('#collapseBtn').onclick = () => { app.classList.toggle('collapsed'); try { localStorage.setItem('tw-collapsed', app.classList.contains('collapsed') ? '1' : '0'); } catch (e) {} setTimeout(() => { TW.resizeCharts(); window.dispatchEvent(new Event('resize')); }, 60); };
    $('#menuBtn').onclick = () => app.classList.toggle('menu-open');
    $('#nav').addEventListener('click', () => app.classList.remove('menu-open'));
    initSearch();
    window.addEventListener('hashchange', TW.render);
    TW.render();
  };
  TW.setCounty = (c, silent) => { TW.state.county = c; $('#focusCounty').value = c; try { localStorage.setItem('tw-focus', c); } catch (e) {} if (!silent) TW.render(); };

  /* ---------- 搜尋 (縣市 / 行政區) ---------- */
  function initSearch() {
    const input = $('#search'), pop = $('#searchPop');
    const index = [];
    TW.C.forEach((c) => { index.push({ c, t: null, key: c + TW.short(c) }); Object.keys(P.towns[c] || {}).forEach((t) => index.push({ c, t, key: c + t })); });
    let items = [], cur = 0;
    const pick = (it) => { pop.hidden = true; input.value = ''; input.blur(); TW.setCounty(it.c, true); if (it.t) { TW.state.town = it.t; TW.go('districts'); } else TW.render(); };
    const draw = () => { pop.innerHTML = items.map((it, i) => '<button type="button" class="' + (i === cur ? 'on' : '') + '" data-i="' + i + '"><b>' + esc(it.t || it.c) + '</b>' + (it.t ? '<span class="mut">' + it.c + '</span>' : '') + '<small>' + (it.t ? '行政區' : '縣市') + '</small></button>').join('') || '<div class="note" style="padding:8px 10px">找不到符合的縣市或行政區</div>'; pop.hidden = false; $$('button', pop).forEach((b) => (b.onmousedown = (e) => { e.preventDefault(); pick(items[+b.dataset.i]); })); };
    input.oninput = () => { const q = input.value.trim().replace(/臺/g, '台'); if (!q) { pop.hidden = true; return; } items = index.filter((it) => it.key.includes(q)).sort((a, b) => (a.t ? 1 : 0) - (b.t ? 1 : 0)).slice(0, 12); cur = 0; draw(); };
    input.onkeydown = (e) => { if (pop.hidden) return; if (e.key === 'ArrowDown') { cur = Math.min(items.length - 1, cur + 1); draw(); e.preventDefault(); } else if (e.key === 'ArrowUp') { cur = Math.max(0, cur - 1); draw(); e.preventDefault(); } else if (e.key === 'Enter' && items[cur]) pick(items[cur]); else if (e.key === 'Escape') { pop.hidden = true; input.blur(); } };
    input.onblur = () => setTimeout(() => (pop.hidden = true), 120);
    document.addEventListener('keydown', (e) => { if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); } });
  }
})();
