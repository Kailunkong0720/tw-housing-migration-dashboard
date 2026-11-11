/* 頁面：遷徙流向地圖 / 遷入遷出趨勢 */
(function () {
  'use strict';
  const TW = window.TW, { P, M, $, $$, h, esc, fmt, sign, pct, wan, cls, sum, last } = TW;
  const MO = M.months, YEARS = M.years, Q = P.quarters, LQ = TW.LQ;
  const periodRange = (p) => (p === 'all' ? [0, MO.length - 1] : TW.yearRange(p));
  const periodLabel = (p) => (p === 'all' ? '2020/01–' + last(MO).replace('-', '/') : p + ' 年' + (p === last(YEARS) ? '（至 ' + +last(MO).slice(5) + ' 月）' : ''));
  TW.periodRange = periodRange; TW.periodLabel = periodLabel;

  /* ================= 遷徙流向地圖 ================= */
  TW.pages.map = (root) => {
    const T = TW.T, st = (TW.state.map = TW.state.map || { mode: 'out', period: 'all', topN: 8, scope: 'one', dim: true });
    root.innerHTML = TW.head('人口遷徙', '遷徙流向地圖', '點地圖上任一縣市，看戶籍從這裡遷出後去了哪、遷入的人從哪來。箭頭越粗代表人數越多；底色是該縣市整體的國內淨遷入率。', '戶籍登記 · 至 ' + last(MO).replace('-', '/')) +
      '<div class="map-layout"><section class="card map-card"><div id="flowMap"></div>' +
      '<div class="map-top"><span id="mMode"></span><span id="mScope"></span><select class="sel" id="mTop" title="箭頭數量">' + [5, 8, 12, 16, 21].map((n) => '<option value="' + n + '">前 ' + n + ' 大</option>').join('') + '</select><button class="btn" id="mHome" type="button">回到全台</button><button class="btn" id="mDim" type="button">底圖：暗化</button></div>' +
      '<div class="map-legend"><div>底色｜淨遷出 <span class="ramp" id="mRamp"></span> 淨遷入</div><div style="margin-top:4px" class="legend"><span><i style="background:var(--c-out);height:6px"></i>遷出</span><span><i style="background:var(--c-in);height:6px"></i>遷入</span><span>箭頭粗細 = 人數</span></div></div>' +
      '<div class="map-bottom"><button class="btn primary" id="mPlay" type="button" title="逐年播放"></button><div class="yr" id="mYears"></div></div></section>' +
      '<aside class="card side-panel" id="mPanel"></aside></div>';
    $('#mRamp').style.background = 'linear-gradient(90deg,' + [-1, -.5, 0, .5, 1].map(TW.diverge).join(',') + ')';
    $('#mTop').value = String(st.topN);

    const fm = TW.flowMap($('#flowMap'), {
      onSelect: (name) => { st.scope = 'one'; TW.setCounty(name, true); paintScope(); update(true); },
      onHover: (key) => $$('#mPanel .dest').forEach((d) => d.classList.toggle('hl', d.dataset.key === key)),
      focusColor: () => (st.mode === 'in' ? TW.T.in : TW.T.out),
    });

    const update = (focusChanged) => {
      const focus = st.scope === 'one' ? TW.state.county : null;
      const [i0, i1] = periodRange(st.period), months = i1 - i0 + 1, hasFull = TW.hasFull(i0, i1);
      // 底色：各縣市國內淨遷入率
      const rates = {}; TW.C.forEach((c) => (rates[c] = TW.netRate(c, i0, i1)));
      fm.setChoropleth(rates, 12, (c) => TW.tipRows(c, [['國內淨遷入', sign(TW.netDom(c, i0, i1)) + ' 人'], ['淨遷入率', sign(rates[c], 1) + ' ‰/年'], ['成屋單價', fmt(P.q[c] && P.q[c].med[LQ], 1) + ' 萬/坪']]) + '<div class="mut" style="margin-top:4px">點一下看這裡的流向</div>');
      const price = (c) => (P.q[c] ? P.q[c].med[LQ] : null);
      let flows = [], html = '';
      if (focus) {
        const rows = TW.C.filter((c) => c !== focus).map((c) => ({ c, out: TW.flow(focus, c, i0, i1), inn: TW.flow(c, focus, i0, i1) })).filter((r) => r.out != null && r.inn != null);
        rows.forEach((r) => (r.net = r.out - r.inn));
        const val = (r) => (st.mode === 'out' ? r.out : st.mode === 'in' ? r.inn : Math.abs(r.net));
        rows.sort((a, b) => val(b) - val(a));
        const total = rows.reduce((s, r) => s + val(r), 0) || 1;
        const outwards = (r) => st.mode === 'out' || (st.mode === 'net' && r.net > 0);
        flows = rows.slice(0, st.topN).filter((r) => val(r) > 0).map((r) => {
          const o = outwards(r);
          return { key: r.c, from: o ? focus : r.c, to: o ? r.c : focus, value: val(r), color: o ? T.out : T.in, color2: o ? '#ffb38a' : '#9be4ff', labelAt: o ? 'head' : 'tail', label: TW.short(r.c) + ' ' + wan(val(r)),
            tip: TW.tipRows((o ? focus + ' → ' + r.c : r.c + ' → ' + focus), [[focus + ' 遷往 ' + r.c, fmt(r.out) + ' 人', T.out], [r.c + ' 遷入 ' + focus, fmt(r.inn) + ' 人', T.in], [focus + ' 淨流' + (r.net >= 0 ? '出' : '入'), fmt(Math.abs(r.net)) + ' 人'], [r.c + ' 成屋單價', fmt(price(r.c), 1) + ' 萬/坪']]),
            onClick: () => { TW.setCounty(r.c, true); update(true); } };
        });
        const din = TW.mig(focus, 'din', i0, i1), dout = TW.mig(focus, 'dout', i0, i1), pf = price(focus);
        const wRows = rows.filter((r) => price(r.c) != null && (st.mode === 'in' ? r.inn : st.mode === 'out' ? r.out : Math.max(r.net, 0)) > 0);
        const wv = (r) => (st.mode === 'in' ? r.inn : st.mode === 'out' ? r.out : Math.max(r.net, 0));
        const wsum = wRows.reduce((s, r) => s + wv(r), 0), wavg = wsum ? wRows.reduce((s, r) => s + wv(r) * price(r.c), 0) / wsum : null;
        const title = { out: '遷出去向', in: '遷入來源', net: '淨流向' }[st.mode];
        html = '<div><div class="crumb">' + periodLabel(st.period) + '</div><h3>' + focus + '</h3></div>' +
          '<div class="stat-row"><div class="stat"><small>國內遷出</small><b class="num" style="color:var(--c-out)">' + wan(dout) + '</b></div><div class="stat"><small>國內遷入</small><b class="num" style="color:var(--c-in)">' + wan(din) + '</b></div><div class="stat"><small>淨遷入</small><b class="num">' + sign(din - dout) + '</b><small>' + sign(rates[focus], 1) + ' ‰/年</small></div></div>' +
          (wavg && pf ? '<div class="insight"><span class="n">$</span><p>' + (st.mode === 'in' ? '遷入者的來源地' : st.mode === 'out' ? '遷出者的去向' : '淨流出的去向') + '，依人數加權的平均單價是 <b>' + fmt(wavg, 1) + ' 萬/坪</b>，為 ' + focus + '（' + fmt(pf, 1) + ' 萬）的 <b>' + fmt(wavg / pf * 100) + '%</b>。</p></div>' : '') +
          '<div><div class="card-head" style="margin-bottom:4px"><div><h3 style="font-size:14px">' + title + '排行</h3><p>' + (st.mode === 'net' ? '紅 = ' + focus + ' 淨流出到該縣市；藍 = 淨流入' : '占比為占跨縣市' + (st.mode === 'out' ? '遷出' : '遷入') + '的比例') + '</p></div></div><div class="dest-list">' +
          rows.map((r, i) => { const o = outwards(r), v = val(r), pr = price(r.c); return '<div class="dest" data-key="' + r.c + '" title="點一下改看 ' + r.c + '"><span class="rk">' + (i + 1) + '</span><span>' + r.c + '</span><span class="bar"><i style="width:' + (v / val(rows[0]) * 100) + '%;background:var(' + (o ? '--c-out' : '--c-in') + ')"></i></span><span class="v">' + (st.mode === 'net' ? (r.net >= 0 ? '−' : '+') : '') + fmt(v) + '<small>' + (st.mode === 'net' ? (pr && pf ? '房價 ' + fmt(pr / pf * 100) + '%' : '') : fmt(v / total * 100, 1) + '%') + '</small></span></div>'; }).join('') + '</div></div>' +
          (!TW.isMuni(focus) && !hasFull ? '<p class="note"><span class="pill warn">資料限制</span> ' + focus + ' 不是直轄市：戶政司在這段期間只公布它與<b>六都</b>之間的流向，所以只有 6 個方向。縣市對縣市的完整矩陣自 <b>2025/02</b> 起才有，請切到 2025 或 2026 年查看。</p>' : '') +
          '<p class="note">戶籍遷徙 ≠ 實際居住地（例如學區、福利、租屋未遷籍）。資料：內政部戶政司。</p>';
      } else {
        const pairs = [];
        for (let a = 0; a < TW.C.length; a++) for (let b = a + 1; b < TW.C.length; b++) {
          const A = TW.C[a], B = TW.C[b], f1 = TW.flow(A, B, i0, i1), f2 = TW.flow(B, A, i0, i1); if (f1 == null || f2 == null) continue;
          const net = f1 - f2; if (net) pairs.push(net > 0 ? { from: A, to: B, v: net, gross: f1 + f2 } : { from: B, to: A, v: -net, gross: f1 + f2 });
        }
        pairs.sort((x, y) => y.v - x.v);
        flows = pairs.slice(0, st.topN).map((p) => ({ key: p.from + '>' + p.to, from: p.from, to: p.to, value: p.v, color: T.out, color2: '#ffc37a', labelAt: 'mid', label: wan(p.v),
          tip: TW.tipRows(p.from + ' → ' + p.to, [['淨流動', fmt(p.v) + ' 人', T.out], ['雙向合計', fmt(p.gross) + ' 人'], [p.from + ' 單價', fmt(price(p.from), 1) + ' 萬/坪'], [p.to + ' 單價', fmt(price(p.to), 1) + ' 萬/坪']]) }));
        html = '<div><div class="crumb">' + periodLabel(st.period) + '</div><h3>全台最大的淨流向</h3></div><p class="note" style="margin:0">兩縣市互相遷徙相抵後的「淨」人數，箭頭由淨流出的一方指向淨流入的一方。</p>' +
          '<div class="dest-list">' + pairs.slice(0, 30).map((p, i) => { const pf = price(p.from), pt = price(p.to); return '<div class="dest" data-key="' + p.from + '>' + p.to + '" data-c="' + p.from + '" style="grid-template-columns:22px 1fr auto"><span class="rk">' + (i + 1) + '</span><span>' + p.from + ' <span style="color:var(--c-out)">→</span> ' + p.to + '</span><span class="v">' + fmt(p.v) + '<small>' + (pf && pt ? '房價 ' + fmt(pt / pf * 100) + '%' : '') + '</small></span></div>'; }).join('') + '</div>' +
          (!hasFull ? '<p class="note"><span class="pill warn">資料限制</span> 這段期間只有「至少一端是六都」的流向；非六都之間（例如新竹縣↔新竹市）自 2025/02 起才有資料。</p>' : '') +
          '<p class="note">「房價 xx%」= 目的地成屋單價 ÷ 出發地單價。資料：內政部戶政司、實價登錄。</p>';
      }
      fm.setFlows(flows, focus);
      $('#mPanel').innerHTML = html;
      $$('#mPanel .dest').forEach((d) => {
        d.onmouseenter = () => fm.highlight(d.dataset.key); d.onmouseleave = () => fm.highlight(null);
        d.onclick = () => { const c = d.dataset.c || d.dataset.key; st.scope = 'one'; TW.setCounty(c, true); paintScope(); update(true); };
      });
      $$('#mYears button').forEach((b) => b.classList.toggle('on', b.dataset.p === String(st.period)));
      if (focusChanged && focus && ['金門縣', '連江縣', '澎湖縣'].includes(focus)) fm.fit([focus].concat(flows.map((f) => (f.from === focus ? f.to : f.from))));
    };

    // 控制
    $('#mMode').appendChild(TW.seg([['out', '遷出去向'], ['in', '遷入來源'], ['net', '淨流向']], st.mode, (v) => { st.mode = v; update(); }));
    const scopeHost = $('#mScope');
    const paintScope = () => { scopeHost.innerHTML = ''; scopeHost.appendChild(TW.seg([['one', TW.state.county], ['all', '全台 Top 流向']], st.scope, (v) => { st.scope = v; update(true); })); };
    paintScope();
    $('#mTop').onchange = (e) => { st.topN = +e.target.value; update(); };
    $('#mHome').onclick = () => fm.home();
    const paintDim = () => { $('#mDim').textContent = '底圖：' + (st.dim ? '暗化' : '原色'); fm.dim(st.dim); };
    $('#mDim').onclick = () => { st.dim = !st.dim; paintDim(); }; paintDim();
    $('#mYears').innerHTML = [['all', '全期']].concat(YEARS.map((y) => [y, y])).map((p) => '<button type="button" data-p="' + p[0] + '">' + p[1] + '</button>').join('');
    $$('#mYears button').forEach((b) => (b.onclick = () => { stop(); st.period = b.dataset.p === 'all' ? 'all' : +b.dataset.p; update(); }));
    let timer = null;
    const playBtn = $('#mPlay');
    const paintPlay = () => (playBtn.innerHTML = '<i style="width:14px;height:14px;display:inline-grid">' + TW.icon(timer ? 'pause' : 'play') + '</i>' + (timer ? '暫停' : '逐年播放'));
    const stop = () => { if (timer) { clearInterval(timer); timer = null; paintPlay(); } };
    playBtn.onclick = () => {
      if (timer) return stop();
      let k = st.period === 'all' || st.period === last(YEARS) ? 0 : YEARS.indexOf(st.period) + 1;
      const step = () => { st.period = YEARS[k]; update(); k++; if (k >= YEARS.length) stop(); };
      step(); if (k < YEARS.length) { timer = setInterval(step, 1900); paintPlay(); }
    };
    paintPlay();
    const sel = $('#focusCounty'), onSel = () => { st.scope = 'one'; paintScope(); };
    sel.addEventListener('change', onSel);
    update(true);
    return () => { stop(); sel.removeEventListener('change', onSel); fm.destroy(); };
  };

  /* ================= 遷入遷出趨勢 ================= */
  TW.pages.migration = (root) => {
    const T = TW.T, fc = TW.state.county;
    const st = (TW.state.mig = TW.state.mig || { sel: ['台北市', '新北市', '桃園市', '台中市', '台南市', '高雄市'], measure: 'dom', smooth: 12, period: 'all', color: TW.slotter() });
    if (!st.sel.includes(fc)) { if (st.sel.length >= 8) st.sel.shift(); st.sel.push(fc); }
    root.innerHTML = TW.head('人口遷徙', '遷入遷出趨勢', '戶籍遷入與遷出的月資料。「國內」只算跨縣市搬家；「含國外」再加上自國外遷入、初設戶籍、除籍等（2020–2023 受疫情出入境影響很大）。', '2020/01–' + last(MO).replace('-', '/')) +
      '<div class="controls"><span class="ctl-label">口徑</span><span id="gMeasure"></span><span class="ctl-label">平滑</span><span id="gSmooth"></span></div>' +
      '<div class="controls"><span class="ctl-label">縣市（最多 8 個）</span><span id="gChips"></span></div>' +
      '<div class="grid">' + TW.card('c12', '<span id="gT1"></span>', '零線以上 = 人口淨流入；以下 = 淨流出', '<div class="chart h380" id="gLine"></div>') + '</div>' +
      '<div class="controls"><span class="ctl-label">期間</span><span id="gPeriod"></span></div>' +
      '<div class="grid">' +
      TW.card('c5', '各縣市國內淨遷入（人）', '<span id="gT2"></span>', '<div class="chart h520" id="gRank"></div>') +
      TW.card('c7', '六都從各縣市「淨吸」或「淨流失」多少人', '<span id="gT3"></span>｜藍 = 該直轄市從左側縣市淨遷入；紅 = 淨流失到該縣市', '<div class="chart h520" id="gHeat"></div>') +
      '</div><div class="grid">' +
      TW.card('c6', fc + '：每年淨遷入的組成', '國內跨縣市 vs 國際及其他（自國外遷入、初設戶籍、除籍）', '<div class="chart h340" id="gComp"></div>') +
      TW.card('c6', fc + '：每年跨縣市遷入與遷出', '兩者差距就是國內淨遷入', '<div class="chart h340" id="gIO"></div>') +
      '</div><div class="grid">' +
      TW.card('c6', '人口淨遷入最多的行政區', '2020/01 至今，遷入 − 遷出（含縣內跨區）', '<div class="tbl-wrap" id="gTop" style="max-height:440px"></div>') +
      TW.card('c6', '人口淨遷出最多的行政區', '2020/01 至今，遷入 − 遷出（含縣內跨區）', '<div class="tbl-wrap" id="gBot" style="max-height:440px"></div>') +
      '</div>';

    let cs = {};
    const mk = (id, opt) => { if (cs[id]) cs[id].dispose(); const c = echarts.init($(id)); c.setOption(opt); cs[id] = c; return c; };
    const series = (c) => { const m = M.m[c], a = st.measure === 'dom' ? m.din.map((v, i) => v - m.dout[i]) : m.tin.map((v, i) => v - m.tout[i]); if (st.smooth === 1) return a; return a.map((_, i) => (i < 11 ? null : sum(a, i - 11, i))); };
    const drawLine = () => {
      $('#gT1').textContent = (st.measure === 'dom' ? '國內淨遷入' : '淨遷入（含國外）') + (st.smooth === 12 ? '：近 12 個月累計（人）' : '：單月（人）');
      mk('#gLine', TW.base({
        xAxis: TW.xCat(MO.map((m) => m.replace('-', '/'))), yAxis: TW.yVal({ name: '人', scale: false }),
        tooltip: TW.tt((ps) => TW.tipRows(ps[0].axisValue + (st.smooth === 12 ? '（近 12 個月）' : ''), ps.slice().sort((a, b) => (b.value || 0) - (a.value || 0)).map((p) => [p.seriesName, sign(p.value) + ' 人', p.color]))),
        series: st.sel.map((c, i) => TW.line(c, series(c), st.color(c, st.sel), { endLabel: st.sel.length <= 6 ? { show: true, formatter: '{a}', color: T.text2, fontSize: 11 } : undefined, markLine: i === 0 ? { symbol: 'none', silent: true, lineStyle: { color: T.muted, type: 'solid', width: 1 }, label: { show: false }, data: [{ yAxis: 0 }] } : undefined })),
        grid: { left: 8, right: st.sel.length <= 6 ? 54 : 14, top: 34, bottom: 6, containLabel: true },
      }));
    };
    const drawPeriod = () => {
      const [i0, i1] = periodRange(st.period), lab = periodLabel(st.period);
      $('#gT2').textContent = lab; $('#gT3').textContent = lab;
      const rank = TW.C.map((c) => ({ c, v: TW.netDom(c, i0, i1), r: TW.netRate(c, i0, i1) })).sort((a, b) => a.v - b.v);
      mk('#gRank', TW.base({
        grid: { left: 8, right: 56, top: 6, bottom: 6, containLabel: true },
        tooltip: TW.tt((p) => { const d = rank[p.dataIndex]; return TW.tipRows(d.c + '｜' + lab, [['國內淨遷入', sign(d.v) + ' 人'], ['淨遷入率', sign(d.r, 1) + ' ‰/年'], ['國內遷入', fmt(TW.mig(d.c, 'din', i0, i1))], ['國內遷出', fmt(TW.mig(d.c, 'dout', i0, i1))]]); }, { trigger: 'item' }),
        xAxis: TW.yVal({ scale: false, axisLabel: { color: T.muted, fontSize: 11, formatter: (v) => (Math.abs(v) >= 10000 ? v / 10000 + '萬' : v) } }),
        yAxis: { type: 'category', data: rank.map((x) => x.c), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: T.text2, fontSize: 12 } },
        series: [{ type: 'bar', barWidth: 12, data: rank.map((x) => ({ value: x.v, itemStyle: { color: x.v >= 0 ? T.in : T.out, borderRadius: x.v >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4] } })), label: { show: true, position: 'right', color: T.text2, fontSize: 11, formatter: (p) => sign(p.value) } }],
      })).on('click', (p) => TW.setCounty(rank[p.dataIndex].c));
      // 六都 × 縣市 淨流動
      const rows = TW.C.slice().reverse(), cols = TW.MUNI, cells = []; let mx = 1;
      rows.forEach((c, yi) => cols.forEach((mu, xi) => { if (c === mu) return; const v = TW.flow(c, mu, i0, i1) - TW.flow(mu, c, i0, i1); cells.push([xi, yi, v]); mx = Math.max(mx, Math.abs(v)); }));
      const cap = mx * .6;
      mk('#gHeat', TW.base({
        grid: { left: 8, right: 14, top: 30, bottom: 6, containLabel: true },
        tooltip: TW.tt((p) => { const c = rows[p.value[1]], mu = cols[p.value[0]], v = p.value[2]; return TW.tipRows(mu + ' ↔ ' + c + '｜' + lab, [[c + ' → ' + mu, fmt(TW.flow(c, mu, i0, i1)) + ' 人'], [mu + ' → ' + c, fmt(TW.flow(mu, c, i0, i1)) + ' 人'], [mu + (v >= 0 ? ' 淨遷入' : ' 淨流失'), fmt(Math.abs(v)) + ' 人']]); }, { trigger: 'item' }),
        xAxis: { type: 'category', data: cols, position: 'top', axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: T.text, fontSize: 12, fontWeight: 600 } },
        yAxis: { type: 'category', data: rows, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: T.text2, fontSize: 12 } },
        visualMap: { show: false, min: -cap, max: cap, inRange: { color: [TW.diverge(-1), TW.diverge(-.5), TW.diverge(0), TW.diverge(.5), TW.diverge(1)] } },
        series: [{ type: 'heatmap', data: cells, itemStyle: { borderColor: T.panel, borderWidth: 2, borderRadius: 3 }, label: { show: true, fontSize: 10.5, color: T.dark ? '#fff' : '#101830', formatter: (p) => (Math.abs(p.value[2]) >= 10000 ? (p.value[2] / 10000).toFixed(1) + '萬' : Math.abs(p.value[2]) >= 1000 ? (p.value[2] / 1000).toFixed(1) + 'k' : p.value[2]) }, emphasis: { itemStyle: { borderColor: T.text, borderWidth: 1 } } }],
      }));
    };
    const drawFocus = () => {
      const ys = YEARS.map(String), m = M.m[fc];
      const by = (arr) => YEARS.map((y) => { const [a, b] = TW.yearRange(y); return sum(arr, a, b); });
      const din = by(m.din), dout = by(m.dout), fnet = by(m.fin).map((v, i) => v - by(m.fout)[i]), dnet = din.map((v, i) => v - dout[i]);
      mk('#gComp', TW.base({
        xAxis: TW.xCat(ys, { boundaryGap: true }), yAxis: TW.yVal({ name: '人', scale: false }),
        tooltip: TW.tt((ps) => { const i = ps[0].dataIndex; return TW.tipRows(fc + '｜' + ys[i] + ' 年', [['國內跨縣市', sign(dnet[i]) + ' 人', T.series[0]], ['國際及其他', sign(fnet[i]) + ' 人', T.series[1]], ['合計淨遷入', sign(dnet[i] + fnet[i]) + ' 人']]); }, { axisPointer: { type: 'shadow' } }),
        series: [{ name: '國內跨縣市', type: 'bar', data: dnet, itemStyle: { color: T.series[0], borderRadius: 3 }, barMaxWidth: 22, barGap: '15%' }, { name: '國際及其他', type: 'bar', data: fnet, itemStyle: { color: T.series[1], borderRadius: 3 }, barMaxWidth: 22 }],
      }));
      mk('#gIO', TW.base({
        xAxis: TW.xCat(ys, { boundaryGap: true }), yAxis: TW.yVal({ name: '人', scale: false }),
        tooltip: TW.tt((ps) => { const i = ps[0].dataIndex; return TW.tipRows(fc + '｜' + ys[i] + ' 年', [['跨縣市遷入', fmt(din[i]) + ' 人', T.in], ['跨縣市遷出', fmt(dout[i]) + ' 人', T.out], ['淨遷入', sign(dnet[i]) + ' 人']]); }, { axisPointer: { type: 'shadow' } }),
        series: [{ name: '跨縣市遷入', type: 'bar', data: din, itemStyle: { color: T.in, borderRadius: [4, 4, 0, 0] }, barMaxWidth: 22, barGap: '15%' }, { name: '跨縣市遷出', type: 'bar', data: dout, itemStyle: { color: T.out, borderRadius: [4, 4, 0, 0] }, barMaxWidth: 22 }],
      }));
    };
    $('#gMeasure').appendChild(TW.seg([['dom', '國內跨縣市'], ['all', '含國外・初設・除籍']], st.measure, (v) => { st.measure = v; drawLine(); }));
    $('#gSmooth').appendChild(TW.seg([[12, '近 12 個月累計'], [1, '單月']], st.smooth, (v) => { st.smooth = v; drawLine(); }));
    $('#gChips').appendChild(TW.chips(TW.C, st.sel, drawLine, { max: 8, color: (c) => st.color(c, st.sel) }));
    $('#gPeriod').appendChild(TW.seg([['all', '全期']].concat(YEARS.map((y) => [y, String(y)])), st.period, (v) => { st.period = v; drawPeriod(); }));
    drawLine(); drawPeriod(); drawFocus();

    const towns = TW.townRows().filter((r) => r.net != null && r.pop >= 3000);
    const cols = (color) => [
      { name: '行政區', left: true, val: (r) => r.c + r.t, html: (r) => '<span class="mut">' + r.c + '</span> <b>' + esc(r.t) + '</b>' },
      { name: '淨遷入 人', val: (r) => r.net, html: (r) => '<b style="color:var(' + color + ')">' + sign(r.net) + '</b>' },
      { name: '‰/年', val: (r) => r.rate, html: (r) => sign(r.rate, 1) },
      { name: '人口', val: (r) => r.pop, html: (r) => fmt(r.pop) },
      { name: '成屋單價', val: (r) => r.med, html: (r) => fmt(r.med, 1) },
    ];
    const goTown = (k) => { const [c, t] = k.split('|'); TW.setCounty(c, true); TW.state.town = t; TW.go('districts'); };
    TW.table($('#gTop'), cols('--c-in'), towns.slice().sort((a, b) => b.net - a.net).slice(0, 25), { sort: 1, key: (r) => r.key, onRow: goTown });
    TW.table($('#gBot'), cols('--c-out'), towns.slice().sort((a, b) => a.net - b.net).slice(0, 25), { sort: 1, asc: true, key: (r) => r.key, onRow: goTown });
    const onResize = () => Object.values(cs).forEach((c) => c.resize()); window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); Object.values(cs).forEach((c) => c.dispose()); };
  };
})();
