/* 頁面：全台總覽 / 成交行情 / 開價 vs 成交 / 行政區探索 */
(function () {
  'use strict';
  const TW = window.TW, { P, A, M, $, $$, h, esc, fmt, sign, pct, wan, cls, sum, last, yoy } = TW;
  const Q = P.quarters, MO = M.months, AQ = Object.keys(A.quarters);
  const LQ = TW.LQ;

  TW.card = (span, title, sub, body, right) => '<section class="card ' + span + '"><div class="card-head"><div><h3>' + title + '</h3>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' + (right ? '<div class="right">' + right + '</div>' : '') + '</div>' + body + '</section>';
  TW.tt = (formatter, o) => Object.assign({}, TW.base().tooltip, { formatter }, o || {});
  TW.slotter = () => { const slots = {}; return (c, selected) => { Object.keys(slots).forEach((k) => { if (!selected.includes(k)) delete slots[k]; }); if (slots[c] == null) { const used = Object.values(slots); let s = 0; while (used.includes(s)) s++; slots[c] = s % 8; } return TW.T.series[slots[c]]; }; };
  const PRELIM = '<b>＊</b> ' + TW.qLabel(last(Q)) + ' 登錄尚未齊全（實價登錄從簽約到揭露約落後 1–3 個月），成交量之後還會增加。';
  const mark2022 = () => ({ symbol: 'none', silent: true, lineStyle: { color: TW.T.muted, type: 'dashed', width: 1 }, label: { formatter: '2022Q1 模型改版', color: TW.T.muted, fontSize: 10, position: 'insideEndTop' }, data: [{ xAxis: '2022Q1' }] });

  /* 開價 vs 成交 (國泰)：兩條線 + 中間的議價空間色帶 */
  TW.askDealOption = (region) => {
    const T = TW.T, ask = AQ.map((q) => A.quarters[q][region].ask), deal = AQ.map((q) => A.quarters[q][region].deal), nego = AQ.map((q) => A.quarters[q][region].nego);
    return TW.base({
      legend: Object.assign({}, TW.base().legend, { data: ['開價', '可能成交價'] }),
      xAxis: TW.xCat(AQ), yAxis: TW.yVal({ name: '萬元/坪' }),
      tooltip: TW.tt((ps) => { const i = ps[0].dataIndex; return TW.tipRows(TW.qLabel(AQ[i]) + '｜' + region + ' 新推案', [['開價', fmt(ask[i], 1) + ' 萬/坪', T.ask], ['可能成交價', fmt(deal[i], 1) + ' 萬/坪', T.deal], ['議價空間', fmt(ask[i] - deal[i], 1) + ' 萬（' + fmt(nego[i], 1) + '%）']]); }),
      series: [
        { type: 'line', name: '_b', data: deal, stack: 'band', lineStyle: { opacity: 0 }, showSymbol: false, silent: true },
        { type: 'line', name: '_g', data: ask.map((a, i) => +(a - deal[i]).toFixed(2)), stack: 'band', lineStyle: { opacity: 0 }, showSymbol: false, silent: true, areaStyle: { color: T.ask, opacity: .2 } },
        TW.line('開價', ask, T.ask, { endLabel: { show: true, formatter: '開價', color: T.text2, fontSize: 11 } }),
        TW.line('可能成交價', deal, T.deal, { markLine: mark2022(), endLabel: { show: true, formatter: '成交', color: T.text2, fontSize: 11 } }),
      ],
      grid: { left: 8, right: 44, top: 34, bottom: 6, containLabel: true },
    });
  };

  /* ================= 全台總覽 ================= */
  TW.pages.overview = (root) => {
    const T = TW.T, nat = P.q['全國'], n = MO.length;
    const aL = A.quarters[last(AQ)]['全國'], aP = A.quarters[AQ[AQ.length - 5]]['全國'];
    const vol4 = sum(nat.n, LQ - 3, LQ), vol4p = sum(nat.n, LQ - 7, LQ - 4);
    const tpNet = TW.netDom('台北市', n - 12, n - 1), tpPrev = TW.netDom('台北市', n - 24, n - 13);
    const medYoY = yoy(nat.med, LQ);
    const kpi = (k, label, val, unit, tag, sub, spark) => '<section class="card kpi ' + k + ' c3"><div class="k-label">' + label + '</div><div class="k-val num">' + val + '<small>' + unit + '</small></div><div class="k-sub"><b>' + tag + '</b>' + sub + '</div><div class="k-spark">' + TW.spark(spark, '#fff', 150, 44) + '</div></section>';

    // 洞察
    const tpAll = TW.netDom('台北市', 0, n - 1);
    const tpDest = TW.C.filter((c) => c !== '台北市').map((c) => ({ c, net: TW.flow('台北市', c, 0, n - 1) - TW.flow(c, '台北市', 0, n - 1) })).sort((a, b) => b.net - a.net);
    const tpOut = tpDest.filter((d) => d.net > 0), tpOutSum = tpOut.reduce((s, d) => s + d.net, 0);
    const chg = TW.MUNI.concat(['新竹縣', '新竹市']).map((c) => ({ c, v: TW.chg20(c) })).filter((x) => x.v != null).sort((a, b) => b.v - a.v);
    const rates = TW.C21.map((c) => ({ c, r: TW.netRate(c, 0, n - 1), p: P.q[c].med[LQ] })).filter((x) => x.p != null);
    const r = TW.pearson(rates.map((x) => x.p), rates.map((x) => x.r));
    const top = rates.slice().sort((a, b) => b.r - a.r);
    const a0 = A.quarters[AQ[0]]['全國'];
    const insights = [
      '<b>台北市</b> 自 2020 年以來國內淨遷出 <b>' + wan(-tpAll) + ' 人</b>；淨流出最多的去向是 ' + tpOut.slice(0, 3).map((d) => '<b>' + d.c + '</b>（' + fmt(d.net / tpOutSum * 100) + '%）').join('、') + '。',
      '全國成屋單價中位數從 2020 年的 ' + fmt(nat.med4[3], 1) + ' 漲到近四季的 <b>' + fmt(nat.med4[LQ], 1) + ' 萬/坪</b>（' + pct(TW.chg20('全國'), 0) + '）；主要都會中漲最多的是 <b>' + chg[0].c + '</b> ' + pct(chg[0].v, 0) + '、<b>' + chg[1].c + '</b> ' + pct(chg[1].v, 0) + '。',
      '新推案議價率從 2020Q1 的 ' + fmt(a0.nego, 1) + '% 縮到 <b>' + fmt(aL.nego, 1) + '%</b>：開價與成交價的距離變小，代表賣方讓價空間縮水。',
      '人口淨流入最快的是 <b>' + top[0].c + '</b>（每年 ' + sign(top[0].r, 1) + '‰）、<b>' + top[1].c + '</b>（' + sign(top[1].r, 1) + '‰）；流出最快的是 <b>' + last(top).c + '</b>（' + sign(last(top).r, 1) + '‰）。',
      '縣市房價水準與淨遷入率的相關係數 r = <b>' + fmt(r, 2) + '</b>（' + TW.rDesc(r) + '）— 詳見 <a href="#/relation" style="color:var(--accent)">房價 × 遷徙</a>。',
    ];

    root.innerHTML = TW.head('總覽', '全台房市與人口流動，一頁看完', '房價是「成交」還是「開價」在漲？人往哪裡搬？以 2020 年至今的官方登錄資料交叉觀察。', '成交 ' + TW.qLabel(Q[LQ]) + '　·　遷徙 ' + last(MO).replace('-', '/')) +
      '<div class="grid">' +
      kpi('k1', '全國成屋單價中位數（實價登錄）', fmt(nat.med[LQ], 1), '萬/坪', pct(medYoY) + ' 年增', TW.qLabel(Q[LQ]), nat.med.slice(0, LQ + 1)) +
      kpi('k2', '全國新推案開價（國泰指數）', fmt(aL.ask, 1), '萬/坪', '議價率 ' + fmt(aL.nego, 1) + '%', '成交 ' + fmt(aL.deal, 1) + ' 萬', AQ.map((q) => A.quarters[q]['全國'].ask)) +
      kpi('k3', '近四季住宅成交量（成屋）', wan(vol4), '件', pct((vol4 / vol4p - 1) * 100) + ' 年增', '截至 ' + TW.qLabel(Q[LQ]), nat.n.slice(0, LQ + 1)) +
      kpi('k4', '台北市近 12 個月國內淨遷出', fmt(-tpNet), '人', '較前期 ' + (tpPrev ? pct((tpNet / tpPrev - 1) * 100, 0) : '—'), '前 12 個月 ' + fmt(-tpPrev), (() => { const o = []; for (let i = 11; i < n; i++) o.push(-TW.netDom('台北市', i - 11, i)); return o; })()) +
      '</div>' +
      '<div class="tiles">' + [['deals', 'trend', '成交行情', '各縣市單價、總價、成交量'], ['asking', 'tag', '開價 vs 成交', '議價率與議價空間'], ['districts', 'pin', '行政區探索', '355 個鄉鎮市區一次比'], ['map', 'flow', '遷徙流向地圖', '點縣市看箭頭往哪走'], ['migration', 'swap', '遷入遷出趨勢', '每月淨遷入與排行'], ['relation', 'scatter', '房價 × 遷徙', '太貴真的會把人推走嗎']].map((t) => '<a class="tile" href="#/' + t[0] + '"><i>' + TW.icon(t[1]) + '</i><b>' + t[2] + '</b><span>' + t[3] + '</span></a>').join('') + '</div>' +
      '<div class="grid">' +
      TW.card('c7', '開價 vs 成交：全國新推案', '色帶 = 議價空間（開價 − 可能成交價）｜國泰房地產指數', '<div class="chart h340" id="ovAsk"></div>', '<a class="more" href="#/asking">七都比較 →</a>') +
      TW.card('c5', '重點觀察', '依最新資料自動計算', '<div class="insights">' + insights.map((t, i) => '<div class="insight"><span class="n">' + (i + 1) + '</span><p>' + t + '</p></div>').join('') + '</div>') +
      '</div><div class="grid">' +
      TW.card('c6', '各縣市成屋單價中位數', TW.qLabel(Q[LQ]) + '｜大樓・華廈・公寓・套房｜右側為年增率', '<div class="chart h520" id="ovRank"></div>', '<a class="more" href="#/deals">成交行情 →</a>') +
      TW.card('c6', '各縣市國內淨遷入率', '近 12 個月，每千人淨遷入人數（‰）｜藍 = 人口流入、紅 = 流出', '<div class="chart h520" id="ovMig"></div>', '<a class="more" href="#/map">看流向地圖 →</a>') +
      '</div>';

    TW.chart('#ovAsk', TW.askDealOption('全國'));

    const rank = TW.C21.map((c) => ({ c, v: P.q[c].med[LQ], y: yoy(P.q[c].med, LQ) })).filter((x) => x.v != null).sort((a, b) => a.v - b.v);
    const rk = TW.chart('#ovRank', TW.base({
      grid: { left: 8, right: 64, top: 6, bottom: 6, containLabel: true },
      tooltip: TW.tt((p) => { const d = rank[p.dataIndex]; return TW.tipRows(d.c + '｜' + TW.qLabel(Q[LQ]), [['單價中位數', fmt(d.v, 1) + ' 萬/坪'], ['年增率', pct(d.y)], ['成交件數', fmt(P.q[d.c].n[LQ])]]); }, { trigger: 'item' }),
      xAxis: TW.yVal({ scale: false, axisLabel: { color: T.muted, fontSize: 11 } }), yAxis: { type: 'category', data: rank.map((x) => x.c), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: T.text2, fontSize: 12 } },
      series: [{ type: 'bar', data: rank.map((x) => ({ value: x.v, itemStyle: { color: x.c === TW.state.county ? T.ask : T.deal } })), barWidth: 12, itemStyle: { borderRadius: [0, 4, 4, 0] },
        label: { show: true, position: 'right', formatter: (p) => '{v|' + fmt(p.value, 1) + '} {' + (rank[p.dataIndex].y > 0 ? 'u' : 'd') + '|' + pct(rank[p.dataIndex].y, 0) + '}', rich: { v: { color: T.text, fontSize: 11.5 }, u: { color: T.up, fontSize: 10.5 }, d: { color: T.down, fontSize: 10.5 } } } }],
    }));
    rk.on('click', (p) => { TW.setCounty(rank[p.dataIndex].c, true); TW.go('deals'); });

    const mig = TW.C.map((c) => ({ c, r: TW.netRate(c, n - 12, n - 1), v: TW.netDom(c, n - 12, n - 1) })).sort((a, b) => a.r - b.r);
    const mx = Math.max(...mig.map((x) => Math.abs(x.r)));
    const mg = TW.chart('#ovMig', TW.base({
      grid: { left: 8, right: 30, top: 6, bottom: 6, containLabel: true },
      tooltip: TW.tt((p) => { const d = mig[p.dataIndex]; return TW.tipRows(d.c + '｜近 12 個月', [['國內淨遷入', sign(d.v) + ' 人'], ['淨遷入率', sign(d.r, 1) + ' ‰']]); }, { trigger: 'item' }),
      xAxis: TW.yVal({ scale: false, min: -Math.ceil(mx), max: Math.ceil(mx), axisLabel: { color: T.muted, fontSize: 11, formatter: (v) => (v > 0 ? '+' : '') + v } }),
      yAxis: { type: 'category', data: mig.map((x) => x.c), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: T.text2, fontSize: 12 } },
      series: [{ type: 'bar', barWidth: 12, data: mig.map((x) => ({ value: +x.r.toFixed(2), itemStyle: { color: x.r >= 0 ? T.in : T.out, borderRadius: x.r >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4] } })),
        label: { show: true, position: 'right', color: T.text2, fontSize: 11, formatter: (p) => sign(p.value, 1) }, markLine: { symbol: 'none', silent: true, lineStyle: { color: T.line, type: 'solid' }, label: { show: false }, data: [{ xAxis: 0 }] } }],
    }));
    mg.on('click', (p) => { TW.setCounty(mig[p.dataIndex].c, true); TW.go('map'); });
  };

  /* ================= 成交行情 ================= */
  TW.pages.deals = (root) => {
    const T = TW.T, st = (TW.state.deals = TW.state.deals || { metric: 'med', kind: 'a', sel: ['台北市', '新北市', '桃園市', '台中市', '台南市', '高雄市'], color: TW.slotter() });
    const fc = TW.state.county, fcp = fc === '連江縣' ? '台北市' : fc;
    if (!st.sel.includes(fcp)) { if (st.sel.length >= 8) st.sel.shift(); st.sel.push(fcp); }
    const METRIC = { med: ['單價中位數', '萬/坪', 1], total: ['總價中位數', '萬元', 0], n: ['成交件數', '件', 0] };
    const key = () => (st.kind === 'b' ? 'p' : '') + st.metric;
    const qx = TW.qAxisLabels();

    root.innerHTML = TW.head('房市行情', '成交行情', '內政部實價登錄的住宅買賣，依「交易日」歸到各季度。單價只計大樓、華廈、公寓、套房（透天單價含土地，不可比）。', '資料至 ' + TW.qLabel(last(Q)) + '（初步）') +
      '<div class="controls"><span class="ctl-label">指標</span><span id="dMetric"></span><span class="ctl-label">類型</span><span id="dKind"></span></div>' +
      '<div class="controls"><span class="ctl-label">縣市（最多 8 個）</span><span id="dChips"></span></div>' +
      '<div class="grid">' + TW.card('c12', '<span id="dTitle"></span>', '點上方縣市加入比較；滑過看各季數值', '<div class="chart h380" id="dLine"></div><p class="note">' + PRELIM + '</p>') + '</div>' +
      '<div class="grid">' + TW.card('c12', '房價年增率熱力圖', '各縣市成屋單價中位數，與去年同季相比（%）｜紅 = 漲、藍 = 跌｜該季成交少於 30 件留白', '<div class="chart h520" id="dHeat"></div>') + '</div>' +
      '<div class="grid">' +
      TW.card('c6', fcp + '：單價分布與預售', '色帶 = 成屋第 25–75 百分位；線 = 中位數', '<div class="chart h340" id="dBand"></div>') +
      TW.card('c6', fcp + '：成交量與建物類型', '每季住宅成交件數（成屋），依建物型態堆疊', '<div class="chart h340" id="dType"></div>') +
      '</div>' +
      '<div class="grid">' + TW.card('c12', '縣市總表', '點欄位排序；點列可切換關注縣市', '<div class="tbl-wrap" id="dTbl"></div>') + '</div>';

    let lineChart;
    const drawLine = () => {
      const [name, unit, d] = METRIC[st.metric];
      $('#dTitle').textContent = (st.kind === 'b' ? '預售屋' : '成屋') + name + '（' + unit + '）';
      if (lineChart) lineChart.dispose();
      lineChart = echarts.init($('#dLine'));
      lineChart.setOption(TW.base({
        xAxis: TW.xCat(qx), yAxis: TW.yVal({ name: unit, scale: st.metric !== 'n' }),
        tooltip: TW.tt((ps) => TW.tipRows(TW.qLabel(Q[ps[0].dataIndex]) + (ps[0].dataIndex === Q.length - 1 ? '（初步）' : ''), ps.slice().sort((a, b) => (b.value || 0) - (a.value || 0)).map((p) => [p.seriesName, fmt(p.value, d) + ' ' + unit, p.color]))),
        series: st.sel.map((c) => TW.line(c, P.q[c][key()], st.color(c, st.sel), { endLabel: st.sel.length <= 4 ? { show: true, formatter: '{a}', color: T.text2, fontSize: 11 } : undefined })),
        grid: { left: 8, right: st.sel.length <= 4 ? 54 : 14, top: 34, bottom: 6, containLabel: true },
      }));
    };
    $('#dMetric').appendChild(TW.seg([['med', '單價中位數'], ['total', '總價中位數'], ['n', '成交量']], st.metric, (v) => { st.metric = v; drawLine(); }));
    $('#dKind').appendChild(TW.seg([['a', '成屋（中古＋新成屋）'], ['b', '預售屋']], st.kind, (v) => { st.kind = v; drawLine(); }));
    $('#dChips').appendChild(TW.chips(TW.C21, st.sel, drawLine, { max: 8, color: (c) => st.color(c, st.sel) }));
    drawLine();
    const onResize = () => lineChart && lineChart.resize(); window.addEventListener('resize', onResize);

    // 熱力圖
    const heat = [];
    const rows = TW.C21.slice().reverse();
    rows.forEach((c, yi) => Q.forEach((q, xi) => { if (xi >= 4 && P.q[c].nApt[xi] >= 30 && P.q[c].nApt[xi - 4] >= 30) { const v = yoy(P.q[c].med, xi); if (v != null) heat.push([xi - 4, yi, +v.toFixed(1)]); } }));
    const hc = TW.chart('#dHeat', TW.base({
      grid: { left: 8, right: 14, top: 8, bottom: 46, containLabel: true },
      tooltip: TW.tt((p) => TW.tipRows(rows[p.value[1]] + '｜' + TW.qLabel(Q[p.value[0] + 4]), [['單價年增率', pct(p.value[2])], ['單價中位數', fmt(P.q[rows[p.value[1]]].med[p.value[0] + 4], 1) + ' 萬/坪']]), { trigger: 'item' }),
      xAxis: TW.xCat(qx.slice(4), { boundaryGap: true, splitArea: { show: false } }), yAxis: { type: 'category', data: rows, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: T.text2, fontSize: 12 } },
      visualMap: { min: -25, max: 25, calculable: false, orient: 'horizontal', left: 'center', bottom: 0, itemWidth: 10, itemHeight: 160, text: ['+25% 漲', '跌 −25%'], textStyle: { color: T.muted, fontSize: 11 }, inRange: { color: [TW.diverge(1), TW.diverge(.5), TW.diverge(0), TW.diverge(-.5), TW.diverge(-1)] } },
      series: [{ type: 'heatmap', data: heat, itemStyle: { borderColor: T.panel, borderWidth: 2, borderRadius: 3 }, emphasis: { itemStyle: { borderColor: T.text, borderWidth: 1 } } }],
    }));
    hc.on('click', (p) => { TW.setCounty(rows[p.value[1]]); });

    // 關注縣市：分布帶
    const e = P.q[fcp];
    TW.chart('#dBand', TW.base({
      legend: Object.assign({}, TW.base().legend, { data: ['成屋中位數', '預售中位數'] }),
      xAxis: TW.xCat(qx), yAxis: TW.yVal({ name: '萬/坪' }),
      tooltip: TW.tt((ps) => { const i = ps[0].dataIndex; return TW.tipRows(fcp + '｜' + TW.qLabel(Q[i]), [['預售中位數', fmt(e.pmed[i], 1) + ' 萬', T.pre], ['成屋 P75', fmt(e.p75[i], 1) + ' 萬'], ['成屋中位數', fmt(e.med[i], 1) + ' 萬', T.deal], ['成屋 P25', fmt(e.p25[i], 1) + ' 萬'], ['預售溢價', e.pmed[i] && e.med[i] ? pct((e.pmed[i] / e.med[i] - 1) * 100, 0) : '—']]); }),
      series: [
        { type: 'line', name: '_b', data: e.p25, stack: 'band', lineStyle: { opacity: 0 }, showSymbol: false, silent: true, connectNulls: true },
        { type: 'line', name: '_g', data: e.p75.map((v, i) => (v != null && e.p25[i] != null ? +(v - e.p25[i]).toFixed(1) : null)), stack: 'band', lineStyle: { opacity: 0 }, showSymbol: false, silent: true, connectNulls: true, areaStyle: { color: T.deal, opacity: .18 } },
        TW.line('成屋中位數', e.med, T.deal), TW.line('預售中位數', e.pmed, T.pre),
      ],
    }));
    // 關注縣市：類型堆疊
    const types = Object.keys(e.types);
    TW.chart('#dType', TW.base({
      xAxis: TW.xCat(qx, { boundaryGap: true }), yAxis: TW.yVal({ name: '件', scale: false }),
      tooltip: TW.tt((ps) => { const i = ps[0].dataIndex; return TW.tipRows(fcp + '｜' + TW.qLabel(Q[i]) + (i === Q.length - 1 ? '（初步）' : ''), ps.slice().reverse().map((p) => [p.seriesName, fmt(p.value) + ' 件', p.color]).concat([['合計', fmt(e.n[i]) + ' 件']])); }, { axisPointer: { type: 'shadow' } }),
      series: types.map((t, i) => ({ name: t, type: 'bar', stack: 'n', data: e.types[t], itemStyle: { color: T.series[i], borderColor: T.panel, borderWidth: 1 }, barMaxWidth: 22, emphasis: { focus: 'series' } })),
    }));

    // 總表
    const data = TW.C21.map((c) => { const x = P.q[c]; return { c, med: x.med[LQ], yoy: yoy(x.med, LQ), chg: TW.chg20(c), total: x.total[LQ], n4: sum(x.n, LQ - 3, LQ), n4y: (sum(x.n, LQ - 3, LQ) / sum(x.n, LQ - 7, LQ - 4) - 1) * 100, pmed: x.pmed[LQ], prem: x.pmed[LQ] && x.med[LQ] ? (x.pmed[LQ] / x.med[LQ] - 1) * 100 : null, sp: x.med.slice(0, LQ + 1) }; });
    const maxMed = Math.max(...data.map((d) => d.med || 0));
    TW.table($('#dTbl'), [
      { name: '縣市', left: true, val: (r) => r.c, html: (r) => '<b>' + r.c + '</b>' },
      { name: '成屋單價 萬/坪', val: (r) => r.med, cls: () => 'bar-cell', html: (r) => '<i style="left:0;width:' + ((r.med || 0) / maxMed * 60) + '%;background:var(--c-deal)"></i><span>' + fmt(r.med, 1) + '</span>' },
      { name: '年增率', val: (r) => r.yoy, cls: (r) => cls(r.yoy), html: (r) => pct(r.yoy) },
      { name: '2020 年至今', val: (r) => r.chg, cls: (r) => cls(r.chg), html: (r) => pct(r.chg, 0) },
      { name: '走勢', val: (r) => r.chg, html: (r) => TW.spark(r.sp, 'var(--c-deal)', 90, 24) },
      { name: '總價中位數 萬', val: (r) => r.total, html: (r) => fmt(r.total) },
      { name: '近四季成交 件', val: (r) => r.n4, html: (r) => fmt(r.n4) },
      { name: '量年增', val: (r) => r.n4y, cls: (r) => cls(r.n4y), html: (r) => pct(r.n4y, 0) },
      { name: '預售單價 萬/坪', val: (r) => r.pmed, html: (r) => fmt(r.pmed, 1) },
      { name: '預售溢價', val: (r) => r.prem, html: (r) => pct(r.prem, 0) },
    ], data, { sort: 1, key: (r) => r.c, onRow: (k) => TW.setCounty(k) });
    $$('#dTbl tr[data-k="' + fcp + '"]').forEach((tr) => tr.classList.add('sel-row'));
    return () => { window.removeEventListener('resize', onResize); if (lineChart) lineChart.dispose(); };
  };

  /* ================= 開價 vs 成交 ================= */
  TW.pages.asking = (root) => {
    const T = TW.T, R = A.regions, st = (TW.state.asking = TW.state.asking || { region: '全國' });
    const mapR = { 台北市: '台北市', 新北市: '新北市', 桃園市: '桃園市', 新竹市: '新竹縣市', 新竹縣: '新竹縣市', 台中市: '台中市', 台南市: '台南市', 高雄市: '高雄市' };
    if (TW.state.askingFollow !== TW.state.county) { TW.state.askingFollow = TW.state.county; if (mapR[TW.state.county]) st.region = mapR[TW.state.county]; }
    const LA = last(AQ), color = (r) => T.series[R.indexOf(r) % 8];

    root.innerHTML = TW.head('房市行情', '開價 vs 成交', '建商「開價」和實際「可能成交價」差多少？議價率 =（開價 − 成交價）÷ 開價。來源為國泰房地產指數，調查對象是新推案（預售＋新成屋），涵蓋全國與七大都會。', '資料至 ' + TW.qLabel(LA)) +
      '<div class="controls"><span class="ctl-label">地區</span><span id="aChips"></span></div>' +
      '<div id="aStats" class="stat-row"></div>' +
      '<div class="grid">' +
      TW.card('c7', '<span id="aT1"></span>', '色帶越窄 = 議價空間越小（賣方越強勢）', '<div class="chart h380" id="aBand"></div><p class="note">2022Q1 起國泰指數的價格模型改版（加入時間變數），前後數字有落差，跨越該季的漲幅請保守解讀。</p>') +
      TW.card('c5', '議價率：八個地區', '粗線 = 目前選的地區', '<div class="chart h380" id="aNego"></div>') +
      '</div><div class="grid">' +
      TW.card('c7', '<span id="aT2"></span>', '同一地區、三種口徑的單價（萬/坪）：建商開價、新案成交、實價登錄預售與成屋', '<div class="chart h340" id="aCmp"></div>') +
      TW.card('c5', '<span id="aT3"></span>', '新推案 30 天銷售率（%）— 越高代表買氣越熱', '<div class="chart h340" id="aSale"></div>') +
      '</div><div class="grid">' + TW.card('c12', '最新一季總表（' + TW.qLabel(LA) + '）', '年變動以去年同季為基準', '<div class="tbl-wrap" id="aTbl"></div>') + '</div>';

    let cs = [];
    const draw = () => {
      cs.forEach((c) => c.dispose()); cs = [];
      const r = st.region, cur = A.quarters[LA][r], prev = A.quarters[AQ[AQ.length - 5]][r], first = A.quarters[AQ[0]][r];
      $('#aT1').textContent = r + '：開價與可能成交價'; $('#aT2').textContent = r + '：開價、新案成交、實價登錄'; $('#aT3').textContent = r + '：買氣';
      $('#aStats').innerHTML = [['開價', fmt(cur.ask, 1), '萬/坪', pct((cur.ask / prev.ask - 1) * 100) + ' 年增'], ['可能成交價', fmt(cur.deal, 1), '萬/坪', pct((cur.deal / prev.deal - 1) * 100) + ' 年增'], ['議價空間', fmt(cur.ask - cur.deal, 1), '萬/坪', '每坪可議'], ['議價率', fmt(cur.nego, 1), '%', '2020Q1 為 ' + fmt(first.nego, 1) + '%'], ['30 天銷售率', fmt(cur.sale30, 1), '%', '去年同季 ' + fmt(prev.sale30, 1) + '%']].map((s) => '<div class="stat"><small>' + s[0] + '</small><b>' + s[1] + '<small>' + s[2] + '</small></b><small>' + s[3] + '</small></div>').join('');
      const mk = (id, opt) => { const c = echarts.init($(id)); c.setOption(opt); cs.push(c); return c; };
      mk('#aBand', TW.askDealOption(r));
      mk('#aNego', TW.base({
        xAxis: TW.xCat(AQ), yAxis: TW.yVal({ name: '%', scale: false }),
        tooltip: TW.tt((ps) => TW.tipRows(TW.qLabel(AQ[ps[0].dataIndex]) + ' 議價率', ps.slice().sort((a, b) => b.value - a.value).map((p) => [p.seriesName, fmt(p.value, 1) + '%', p.color]))),
        series: R.map((x) => TW.line(x, AQ.map((q) => A.quarters[q][x].nego), color(x), { lineStyle: { width: x === r ? 3.5 : 1.3, color: color(x), opacity: x === r ? 1 : .55 }, z: x === r ? 5 : 2 })),
      })).on('click', (p) => { if (p.seriesName) { st.region = p.seriesName; paintChips(); draw(); } });
      // 三種口徑
      const cty = r === '新竹縣市' ? ['新竹縣', '新竹市'] : [r];
      const toA = (arr) => AQ.map((q) => { const i = Q.indexOf(q); return i >= 0 && i <= LQ + 1 ? arr[i] : null; });
      const series = [TW.line('建商開價（國泰）', AQ.map((q) => A.quarters[q][r].ask), T.ask), TW.line('新案成交（國泰）', AQ.map((q) => A.quarters[q][r].deal), T.series[1])];
      cty.forEach((c, i) => { const sfx = cty.length > 1 ? '・' + c : ''; series.push(TW.line('預售中位數（實價）' + sfx, toA(P.q[c].pmed), T.pre, { lineStyle: { width: 2, color: T.pre, type: i ? 'dashed' : 'solid' } })); series.push(TW.line('成屋中位數（實價）' + sfx, toA(P.q[c].med), T.deal, { lineStyle: { width: 2, color: T.deal, type: i ? 'dashed' : 'solid' } })); });
      mk('#aCmp', TW.base({ xAxis: TW.xCat(AQ), yAxis: TW.yVal({ name: '萬/坪' }), tooltip: TW.tt((ps) => TW.tipRows(TW.qLabel(AQ[ps[0].dataIndex]) + '｜' + r, ps.map((p) => [p.seriesName, fmt(p.value, 1) + ' 萬', p.color]))), series }));
      mk('#aSale', TW.base({
        xAxis: TW.xCat(AQ, { boundaryGap: true }), yAxis: TW.yVal({ name: '%', scale: false }),
        tooltip: TW.tt((ps) => TW.tipRows(TW.qLabel(AQ[ps[0].dataIndex]) + '｜' + r, [['30 天銷售率', fmt(ps[0].value, 1) + '%', T.series[2]]]), { axisPointer: { type: 'shadow' } }),
        series: [{ type: 'bar', data: AQ.map((q) => A.quarters[q][r].sale30), itemStyle: { color: T.series[2], borderRadius: [4, 4, 0, 0] }, barMaxWidth: 16 }],
      }));
    };
    const sel = [st.region];
    const chipEl = TW.chips(R, sel, (s) => { st.region = s[0]; draw(); }, { single: true });
    const paintChips = () => { sel[0] = st.region; $$('.chip', chipEl).forEach((b) => b.classList.toggle('on', b.dataset.v === st.region)); };
    $('#aChips').appendChild(chipEl);
    draw();
    const onResize = () => cs.forEach((c) => c.resize()); window.addEventListener('resize', onResize);

    const rows = R.map((r) => { const c = A.quarters[LA][r], p = A.quarters[AQ[AQ.length - 5]][r]; return { r, ask: c.ask, deal: c.deal, gap: c.ask - c.deal, nego: c.nego, dn: c.nego - p.nego, ya: (c.ask / p.ask - 1) * 100, yd: (c.deal / p.deal - 1) * 100, sale: c.sale30 }; });
    const mxA = Math.max(...rows.map((x) => x.ask));
    TW.table($('#aTbl'), [
      { name: '地區', left: true, val: (x) => x.r, html: (x) => '<b>' + x.r + '</b>' },
      { name: '開價 萬/坪', val: (x) => x.ask, cls: () => 'bar-cell', html: (x) => '<i style="left:0;width:' + (x.ask / mxA * 60) + '%;background:var(--c-ask)"></i><span>' + fmt(x.ask, 1) + '</span>' },
      { name: '開價年增', val: (x) => x.ya, cls: (x) => cls(x.ya), html: (x) => pct(x.ya) },
      { name: '可能成交價 萬/坪', val: (x) => x.deal, cls: () => 'bar-cell', html: (x) => '<i style="left:0;width:' + (x.deal / mxA * 60) + '%;background:var(--c-deal)"></i><span>' + fmt(x.deal, 1) + '</span>' },
      { name: '成交年增', val: (x) => x.yd, cls: (x) => cls(x.yd), html: (x) => pct(x.yd) },
      { name: '議價空間 萬/坪', val: (x) => x.gap, html: (x) => fmt(x.gap, 1) },
      { name: '議價率', val: (x) => x.nego, html: (x) => fmt(x.nego, 1) + '%' },
      { name: '議價率年變動', val: (x) => x.dn, html: (x) => sign(x.dn, 1) + ' 百分點' },
      { name: '30 天銷售率', val: (x) => x.sale, html: (x) => fmt(x.sale, 1) + '%' },
    ], rows, { sort: 1, key: (x) => x.r, onRow: (k) => { st.region = k; paintChips(); draw(); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
    return () => { window.removeEventListener('resize', onResize); cs.forEach((c) => c.dispose()); };
  };

  /* ================= 行政區探索 ================= */
  TW.townRows = () => {
    if (TW._townRows) return TW._townRows;
    const yrs = P.years, months = MO.length, rows = [];
    TW.C.forEach((c) => Object.keys(P.towns[c] || {}).forEach((t) => {
      const p = P.towns[c][t], m = (M.towns[c] || {})[t];
      const first = p.med.find((v) => v != null);
      const net = m ? sum(m.in) - sum(m.out) : null;
      rows.push({ c, t, key: c + '|' + t, med: p.cur[1], n: p.cur[0], yoy: p.cur[1] && p.prev[1] ? (p.cur[1] / p.prev[1] - 1) * 100 : null, first, chg: p.cur[1] && p.med[0] ? (p.cur[1] / p.med[0] - 1) * 100 : null,
        pmed: last(p.pmed.filter((v) => v != null)) || null, pop: m ? m.pop : null, net, rate: m && m.pop ? (net / m.pop) * 1000 * (12 / months) : null, sp: p.med, yrs });
    }));
    return (TW._townRows = rows);
  };
  TW.pages.districts = (root) => {
    const T = TW.T, all = TW.townRows(), st = (TW.state.dist = TW.state.dist || { county: '全部', q: '', minN: 20 });
    if (TW.state.town) { st.q = TW.state.town; st.county = TW.state.county; st.minN = 0; TW.state.pick = TW.state.county + '|' + TW.state.town; TW.state.town = null; }
    root.innerHTML = TW.head('房市行情', '行政區探索', '全台 ' + all.length + ' 個鄉鎮市區的成屋單價、漲幅、成交量，以及 2020 年以來的人口淨遷入率，可排序、可篩選。', '單價為近四季（至 ' + TW.qLabel(last(Q)) + '）') +
      '<div class="controls"><span class="ctl-label">縣市</span><select class="sel" id="xCounty"><option>全部</option>' + TW.C.map((c) => '<option>' + c + '</option>').join('') + '</select>' +
      '<span class="ctl-label">行政區</span><input class="sel" id="xQ" placeholder="輸入名稱篩選" style="width:150px">' +
      '<span class="ctl-label">近四季成交至少</span><select class="sel" id="xMin"><option value="0">不限</option><option value="20">20 件</option><option value="100">100 件</option><option value="300">300 件</option></select>' +
      '<span class="ctl-label" id="xCount"></span></div>' +
      '<div class="grid" id="xDetail"></div>' +
      '<div class="grid">' + TW.card('c12', '行政區總表', '點欄位排序；點列看該區歷年走勢', '<div class="tbl-wrap" id="xTbl" style="max-height:640px"></div><p class="note">淨遷入率 = 2020/01 至今（遷入 − 遷出）÷ 人口，換算成每年每千人；鄉鎮層級的遷入遷出包含同縣市內跨區搬家與國外。成交少於 5 件的單價不顯示。</p>') + '</div>';
    $('#xCounty').value = st.county; $('#xQ').value = st.q; $('#xMin').value = String(st.minN);
    let dc = [];
    const detail = (key) => {
      dc.forEach((c) => c.dispose()); dc = [];
      const r = all.find((x) => x.key === key); if (!r) { $('#xDetail').innerHTML = ''; return; }
      const p = P.towns[r.c][r.t], m = (M.towns[r.c] || {})[r.t], yrs = P.years.map(String);
      $('#xDetail').innerHTML = TW.card('c6', r.c + ' ' + r.t + '：歷年單價', '成屋與預售單價中位數（萬/坪）', '<div class="chart h260" id="xP"></div>') + TW.card('c6', r.c + ' ' + r.t + '：歷年淨遷入', '遷入 − 遷出（人）｜' + last(yrs) + ' 年至 ' + last(MO).slice(5) + ' 月', '<div class="chart h260" id="xM"></div>');
      const a = echarts.init($('#xP')); a.setOption(TW.base({ xAxis: TW.xCat(yrs, { boundaryGap: true }), yAxis: TW.yVal({ name: '萬/坪' }), tooltip: TW.tt((ps) => TW.tipRows(ps[0].axisValue + ' 年', ps.map((x) => [x.seriesName, fmt(x.value, 1) + ' 萬', x.color]).concat([['成屋成交', fmt(p.n[ps[0].dataIndex]) + ' 件']]))), series: [TW.line('成屋中位數', p.med, T.deal, { showSymbol: true }), TW.line('預售中位數', p.pmed, T.pre, { showSymbol: true })] })); dc.push(a);
      if (m) { const net = m.in.map((v, i) => v - m.out[i]); const b = echarts.init($('#xM')); b.setOption(TW.base({ xAxis: TW.xCat(M.years.map(String), { boundaryGap: true }), yAxis: TW.yVal({ name: '人', scale: false }), tooltip: TW.tt((ps) => { const i = ps[0].dataIndex; return TW.tipRows(ps[0].axisValue + ' 年', [['遷入', fmt(m.in[i])], ['遷出', fmt(m.out[i])], ['淨遷入', sign(net[i])]]); }, { axisPointer: { type: 'shadow' } }), series: [{ type: 'bar', barMaxWidth: 30, data: net.map((v) => ({ value: v, itemStyle: { color: v >= 0 ? T.in : T.out, borderRadius: v >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4] } })) }] })); dc.push(b); }
    };
    const maxMed = Math.max(...all.map((x) => x.med || 0)), maxRate = 30;
    const cols = [
      { name: '縣市', left: true, val: (r) => r.c },
      { name: '行政區', left: true, val: (r) => r.t, html: (r) => '<b>' + esc(r.t) + '</b>' },
      { name: '成屋單價 萬/坪', val: (r) => r.med, cls: () => 'bar-cell', html: (r) => '<i style="left:0;width:' + ((r.med || 0) / maxMed * 60) + '%;background:var(--c-deal)"></i><span>' + fmt(r.med, 1) + '</span>' },
      { name: '年增率', val: (r) => r.yoy, cls: (r) => cls(r.yoy), html: (r) => pct(r.yoy) },
      { name: '2020 至今', val: (r) => r.chg, cls: (r) => cls(r.chg), html: (r) => pct(r.chg, 0) },
      { name: '歷年走勢', val: (r) => r.chg, html: (r) => TW.spark(r.sp, 'var(--c-deal)', 80, 22) },
      { name: '近四季成交', val: (r) => r.n, html: (r) => fmt(r.n) },
      { name: '預售單價', val: (r) => r.pmed, html: (r) => fmt(r.pmed, 1) },
      { name: '人口', val: (r) => r.pop, html: (r) => fmt(r.pop) },
      { name: '淨遷入率 ‰/年', val: (r) => r.rate, cls: () => 'bar-cell', html: (r) => r.rate == null ? '—' : '<i style="' + (r.rate >= 0 ? 'left:50%' : 'right:50%') + ';width:' + Math.min(50, Math.abs(r.rate) / maxRate * 50) + '%;background:var(' + (r.rate >= 0 ? '--c-in' : '--c-out') + ')"></i><span>' + sign(r.rate, 1) + '</span>' },
    ];
    let tbl;
    const apply = () => {
      const q = st.q.trim().replace(/臺/g, '台');
      const rows = all.filter((r) => (st.county === '全部' || r.c === st.county) && (!q || r.t.includes(q) || r.c.includes(q)) && (r.n || 0) >= st.minN);
      $('#xCount').textContent = '共 ' + rows.length + ' 區';
      const o = { sort: 2, key: (r) => r.key, limit: 400, onRow: (k, tr) => { $$('#xTbl tr').forEach((x) => x.classList.remove('sel-row')); tr.classList.add('sel-row'); TW.state.pick = k; detail(k); } };
      if (tbl) tbl.redraw(rows); else tbl = TW.table($('#xTbl'), cols, rows, o);
    };
    $('#xCounty').onchange = (e) => { st.county = e.target.value; apply(); };
    $('#xQ').oninput = (e) => { st.q = e.target.value; apply(); };
    $('#xMin').onchange = (e) => { st.minN = +e.target.value; apply(); };
    apply();
    if (TW.state.pick) detail(TW.state.pick);
    const onResize = () => dc.forEach((c) => c.resize()); window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); dc.forEach((c) => c.dispose()); };
  };
})();
