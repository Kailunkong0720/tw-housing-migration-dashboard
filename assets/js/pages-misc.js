/* 頁面：房價 × 遷徙 / 資料來源與方法 */
(function () {
  'use strict';
  const TW = window.TW, { P, A, M, D, $, $$, esc, fmt, sign, pct, wan, sum, last } = TW;
  const MO = M.months, Q = P.quarters, LQ = TW.LQ, n = MO.length;

  /* ================= 房價 × 遷徙 ================= */
  TW.pages.relation = (root) => {
    const T = TW.T, fc = TW.state.county, fcp = fc === '連江縣' ? '台北市' : fc;
    const st = (TW.state.rel = TW.state.rel || { x: 'level', period: 'all' });
    root.innerHTML = TW.head('交叉分析', '房價 × 遷徙：太貴真的會把人推走嗎？', '把實價登錄的房價和戶政司的戶籍遷徙放在一起看：房價高的地方人口是否淨流出？搬走的人是不是往便宜的地方去？', '成交 ' + TW.qLabel(Q[LQ]) + '　·　遷徙 ' + last(MO).replace('-', '/')) +
      '<div class="grid">' + TW.card('c12', '結論先看', '以下數字都由目前資料即時計算', '<div class="insights" id="rSum"></div>') + '</div>' +
      '<div class="controls"><span class="ctl-label">橫軸</span><span id="rX"></span><span class="ctl-label">遷徙期間</span><span id="rP"></span></div>' +
      '<div class="grid">' +
      TW.card('c7', '縣市：房價 vs 國內淨遷入率', '<span id="rT1"></span>｜圓越大人口越多；虛線為迴歸線', '<div class="chart h440" id="rCounty"></div><div class="stat-row" id="rStat1"></div>') +
      TW.card('c5', '行政區：單價 vs 淨遷入率', '每個點是一個鄉鎮市區；亮色 = ' + fcp, '<div class="chart h440" id="rTown"></div><div class="stat-row" id="rStat2"></div>') +
      '</div><div class="grid">' +
      TW.card('c6', fcp + '：搬出去的人，往便宜的地方走？', '橫軸 = 目的地單價 ÷ ' + fcp + ' 單價；縱軸 = ' + fcp + ' 對該縣市的淨流出人數（2020/01 至今）', '<div class="chart h380" id="rDest"></div><p class="note" id="rDestNote"></p>') +
      TW.card('c6', fcp + '：房價與淨遷入的時間變化', '上：成屋單價中位數（萬/坪）｜下：每季國內淨遷入（人）', '<div class="chart h380" id="rTime"></div><p class="note" id="rTimeNote"></p>') +
      '</div>' +
      '<div class="grid">' + TW.card('c12', '怎麼讀這些圖', '', '<ul class="prose"><li><b>相關不等於因果。</b>房價高的都會區同時有就業機會、學區、交通等拉力；人口外移也可能是家庭成長換大房、退休返鄉等原因。</li><li><b>戶籍 ≠ 實際居住。</b>在台北租屋但戶籍留在老家、或為了學區與福利遷籍，都會讓戶籍遷徙和真實搬家有落差。</li><li><b>淨遷入率</b>只算「國內跨縣市」遷徙，已排除疫情期間因出入境造成的除籍與恢復戶籍。</li><li>行政區層級的遷入遷出包含同縣市內跨區搬家與國外遷徙，和縣市層級口徑不同。</li></ul>') + '</div>';

    let cs = {};
    const mk = (id, opt) => { if (cs[id]) cs[id].dispose(); const c = echarts.init($(id)); c.setOption(opt); cs[id] = c; return c; };
    const statBox = (items) => items.map((s) => '<div class="stat"><small>' + s[0] + '</small><b>' + s[1] + '</b><small>' + s[2] + '</small></div>').join('');

    const drawCounty = () => {
      const [i0, i1] = TW.periodRange(st.period);
      const pts = TW.C21.map((c) => ({ c, x: st.x === 'level' ? P.q[c].med[LQ] : TW.chg20(c), y: TW.netRate(c, i0, i1), pop: TW.popOf(c, 2025) })).filter((p) => p.x != null && p.y != null);
      const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y), r = TW.pearson(xs, ys), rho = TW.spearman(xs, ys), lr = TW.linreg(xs, ys);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), xu = st.x === 'level' ? '萬/坪' : '%';
      $('#rT1').textContent = (st.x === 'level' ? '橫軸 = 成屋單價中位數（' + TW.qLabel(Q[LQ]) + '）' : '橫軸 = 2020 年至今單價漲幅') + '；縱軸 = ' + TW.periodLabel(st.period) + ' 年化淨遷入率';
      mk('#rCounty', TW.base({
        grid: { left: 8, right: 26, top: 16, bottom: 26, containLabel: true },
        tooltip: TW.tt((p) => { const d = pts[p.dataIndex]; return p.seriesType === 'scatter' ? TW.tipRows(d.c, [[st.x === 'level' ? '成屋單價' : '單價漲幅', fmt(d.x, 1) + ' ' + xu], ['國內淨遷入率', sign(d.y, 1) + ' ‰/年'], ['人口', wan(d.pop)]]) : ''; }, { trigger: 'item' }),
        xAxis: TW.yVal({ name: st.x === 'level' ? '成屋單價（萬/坪）→' : '單價漲幅（%）→', nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: T.muted, fontSize: 11 } }),
        yAxis: TW.yVal({ name: '淨遷入率（‰/年）', scale: true }),
        series: [
          { type: 'scatter', data: pts.map((p) => ({ value: [p.x, p.y], itemStyle: { color: p.c === fcp ? T.ask : p.y >= 0 ? T.in : T.out, opacity: .85, borderColor: T.panel, borderWidth: 2 } })), symbolSize: (v, p) => 9 + Math.sqrt(pts[p.dataIndex].pop / 4e6) * 30,
            label: { show: true, formatter: (p) => TW.short(pts[p.dataIndex].c), position: 'top', color: T.text2, fontSize: 11, distance: 3 }, labelLayout: { hideOverlap: true },
            markLine: { symbol: 'none', silent: true, lineStyle: { color: T.muted, type: 'solid', width: 1 }, label: { show: false }, data: [{ yAxis: 0 }] } },
          { type: 'line', data: [[x0, lr.a + lr.b * x0], [x1, lr.a + lr.b * x1]], showSymbol: false, silent: true, lineStyle: { color: T.text2, type: 'dashed', width: 1.5 }, tooltip: { show: false } },
        ],
      })).on('click', (p) => { if (p.seriesType === 'scatter') TW.setCounty(pts[p.dataIndex].c); });
      $('#rStat1').innerHTML = statBox([['Pearson r', fmt(r, 2), TW.rDesc(r)], ['Spearman ρ', fmt(rho, 2), '排名相關'], ['迴歸斜率', sign(lr.b, 2), st.x === 'level' ? '單價每 +1 萬，淨遷入率變化（‰）' : '漲幅每 +1%，淨遷入率變化（‰）'], ['樣本', pts.length + ' 縣市', '連江縣成交過少未列']]);
      return { r, rho, pts };
    };

    // 行政區散布
    const towns = TW.townRows().filter((t) => t.med != null && t.rate != null && t.pop >= 5000 && t.n >= 20);
    const txs = towns.map((t) => t.med), tys = towns.map((t) => Math.max(-40, Math.min(60, t.rate)));
    const tr = TW.pearson(txs, towns.map((t) => t.rate)), trho = TW.spearman(txs, towns.map((t) => t.rate));
    const inF = towns.filter((t) => t.c === fcp), rF = inF.length >= 5 ? TW.pearson(inF.map((t) => t.med), inF.map((t) => t.rate)) : null;
    const tdata = (list) => list.map((t) => ({ value: [t.med, Math.max(-40, Math.min(60, t.rate))], t }));
    mk('#rTown', TW.base({
      grid: { left: 8, right: 20, top: 30, bottom: 26, containLabel: true },
      legend: Object.assign({}, TW.base().legend, { icon: 'circle', itemWidth: 9, itemHeight: 9 }),
      tooltip: TW.tt((p) => { const t = p.data.t; return TW.tipRows(t.c + ' ' + t.t, [['成屋單價', fmt(t.med, 1) + ' 萬/坪'], ['淨遷入率', sign(t.rate, 1) + ' ‰/年'], ['淨遷入', sign(t.net) + ' 人'], ['人口', wan(t.pop)]]); }, { trigger: 'item' }),
      xAxis: TW.yVal({ name: '成屋單價（萬/坪）→', nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: T.muted, fontSize: 11 } }), yAxis: TW.yVal({ name: '淨遷入率（‰/年）' }),
      series: [
        { name: '其他縣市', type: 'scatter', data: tdata(towns.filter((t) => t.c !== fcp)), symbolSize: 6, itemStyle: { color: T.muted, opacity: .45 }, markLine: { symbol: 'none', silent: true, lineStyle: { color: T.muted, type: 'solid', width: 1 }, label: { show: false }, data: [{ yAxis: 0 }] } },
        { name: fcp, type: 'scatter', data: tdata(inF), symbolSize: 10, itemStyle: { color: T.ask, borderColor: T.panel, borderWidth: 1.5 }, label: { show: true, formatter: (p) => p.data.t.t, position: 'top', color: T.text2, fontSize: 10.5, distance: 2 }, labelLayout: { hideOverlap: true }, z: 5 },
      ],
    })).on('click', (p) => { const t = p.data && p.data.t; if (t) { TW.setCounty(t.c, true); TW.state.town = t.t; TW.go('districts'); } });
    $('#rStat2').innerHTML = statBox([['全台 r', fmt(tr, 2), TW.rDesc(tr)], ['全台 ρ', fmt(trho, 2), towns.length + ' 個行政區'], [fcp + ' 內 r', rF == null ? '—' : fmt(rF, 2), rF == null ? '行政區太少' : TW.rDesc(rF)]]);

    // 去向 × 房價差
    const pf = P.q[fcp].med[LQ];
    const dest = TW.C21.filter((c) => c !== fcp).map((c) => { const o = TW.flow(fcp, c, 0, n - 1), i = TW.flow(c, fcp, 0, n - 1); return o == null || i == null ? null : { c, net: o - i, ratio: P.q[c].med[LQ] / pf * 100, pop: TW.popOf(c, 2025) }; }).filter(Boolean);
    const dr = dest.length >= 5 ? TW.spearman(dest.map((d) => d.ratio), dest.map((d) => d.net)) : null;
    mk('#rDest', TW.base({
      grid: { left: 8, right: 26, top: 16, bottom: 26, containLabel: true },
      tooltip: TW.tt((p) => { const d = dest[p.dataIndex]; return TW.tipRows(fcp + ' ↔ ' + d.c, [[fcp + (d.net >= 0 ? ' 淨流出' : ' 淨流入'), fmt(Math.abs(d.net)) + ' 人'], [d.c + ' 單價', fmt(P.q[d.c].med[LQ], 1) + ' 萬/坪'], ['相對 ' + fcp, fmt(d.ratio) + '%']]); }, { trigger: 'item' }),
      xAxis: TW.yVal({ name: '目的地單價 ÷ ' + fcp + '（%）→', nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: T.muted, fontSize: 11 }, axisLabel: { color: T.muted, fontSize: 11, formatter: '{value}%' } }),
      yAxis: TW.yVal({ name: fcp + ' 淨流出（人）', scale: false, axisLabel: { color: T.muted, fontSize: 11, formatter: (v) => (Math.abs(v) >= 10000 ? v / 10000 + '萬' : v) } }),
      series: [{ type: 'scatter', data: dest.map((d) => ({ value: [d.ratio, d.net], itemStyle: { color: d.net >= 0 ? T.out : T.in, opacity: .85, borderColor: T.panel, borderWidth: 2 } })), symbolSize: (v, p) => 9 + Math.sqrt(dest[p.dataIndex].pop / 4e6) * 30,
        label: { show: true, formatter: (p) => TW.short(dest[p.dataIndex].c), position: 'top', color: T.text2, fontSize: 11, distance: 3 }, labelLayout: { hideOverlap: true },
        markLine: { symbol: 'none', silent: true, lineStyle: { color: T.muted, width: 1 }, label: { show: true, formatter: (p) => (p.data.xAxis ? '同價位' : ''), color: T.muted, fontSize: 10 }, data: [{ yAxis: 0 }, { xAxis: 100 }] } }],
    })).on('click', (p) => TW.setCounty(dest[p.dataIndex].c));
    const cheaper = dest.filter((d) => d.ratio < 100), outC = cheaper.filter((d) => d.net > 0).reduce((s, d) => s + d.net, 0), outAll = dest.filter((d) => d.net > 0).reduce((s, d) => s + d.net, 0);
    $('#rDestNote').innerHTML = (TW.isMuni(fcp) ? '' : '<span class="pill warn">資料限制</span> ' + fcp + ' 非直轄市，2020 起的完整流向只有與六都之間的 6 個點。 ') + (outAll ? fcp + ' 的淨流出中有 <b>' + fmt(outC / outAll * 100) + '%</b> 去了單價比它低的縣市。' : fcp + ' 對這些縣市沒有淨流出。') + ' 紅點 = ' + fcp + ' 淨流出、藍點 = 淨流入。距離也是重要因素：鄰近縣市的點通常最高。';

    // 時間序列：兩個子圖共用時間軸 (不使用雙軸)
    const qn = Q.map((q) => { const y = q.slice(0, 4), k = +q[5]; let s = 0, cnt = 0; for (let m = (k - 1) * 3 + 1; m <= k * 3; m++) { const i = MO.indexOf(y + '-' + String(m).padStart(2, '0')); if (i >= 0) { s += M.m[fcp].din[i] - M.m[fcp].dout[i]; cnt++; } } return cnt === 3 ? s : null; });
    const med = P.q[fcp].med, qx = TW.qAxisLabels();
    const pair = Q.map((_, i) => [med[i], qn[i]]).filter((p) => p[0] != null && p[1] != null), rt = pair.length >= 8 ? TW.pearson(pair.map((p) => p[0]), pair.map((p) => p[1])) : null;
    mk('#rTime', TW.base({
      legend: { show: false }, axisPointer: { link: [{ xAxisIndex: 'all' }] },
      grid: [{ left: 52, right: 16, top: 14, height: '40%' }, { left: 52, right: 16, top: '60%', bottom: 26 }],
      tooltip: TW.tt((ps) => { const i = ps[0].dataIndex; return TW.tipRows(fcp + '｜' + TW.qLabel(Q[i]), [['成屋單價', fmt(med[i], 1) + ' 萬/坪', T.deal], ['國內淨遷入', qn[i] == null ? '（該季未滿）' : sign(qn[i]) + ' 人', qn[i] >= 0 ? T.in : T.out]]); }),
      xAxis: [TW.xCat(qx, { gridIndex: 0, axisLabel: { show: false } }), TW.xCat(qx, { gridIndex: 1, boundaryGap: true })],
      yAxis: [TW.yVal({ gridIndex: 0 }), TW.yVal({ gridIndex: 1, scale: false, axisLabel: { color: T.muted, fontSize: 11, formatter: (v) => (Math.abs(v) >= 10000 ? v / 10000 + '萬' : v) } })],
      series: [TW.line('成屋單價', med, T.deal, { xAxisIndex: 0, yAxisIndex: 0 }), { name: '國內淨遷入', type: 'bar', xAxisIndex: 1, yAxisIndex: 1, barMaxWidth: 14, data: qn.map((v) => (v == null ? null : { value: v, itemStyle: { color: v >= 0 ? T.in : T.out, borderRadius: v >= 0 ? [3, 3, 0, 0] : [0, 0, 3, 3] } })) }],
    }));
    $('#rTimeNote').innerHTML = rt == null ? '' : '單價與每季淨遷入的相關係數 r = <b>' + fmt(rt, 2) + '</b>（' + TW.rDesc(rt) + '，' + pair.length + ' 季）。時間序列的相關很容易被共同趨勢誤導，僅供參考。';

    const res = { cur: null };
    const summary = () => {
      const c = res.cur, tp = (a, b) => TW.flow(a, b, 0, n - 1) - TW.flow(b, a, 0, n - 1);
      const north = ['台北市', '新北市', '基隆市'], nNet = north.reduce((s, x) => s + TW.netDom(x, 0, n - 1), 0);
      const NORTH = north.concat(['桃園市', '新竹縣', '新竹市', '宜蘭縣']), northAll = NORTH.reduce((s, x) => s + TW.netDom(x, 0, n - 1), 0);
      const gain = TW.C.filter((x) => !NORTH.includes(x)).map((x) => ({ c: x, v: TW.netDom(x, 0, n - 1) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
      const tpe = TW.netDom('台北市', 0, n - 1), tpeNtp = tp('台北市', '新北市'), ntpTy = tp('新北市', '桃園市'), tpeTy = tp('台北市', '桃園市');
      const lvl = TW.C21.map((x) => ({ x: P.q[x].med[LQ], y: TW.netRate(x, 0, n - 1) })).filter((p) => p.x != null), rl = TW.pearson(lvl.map((p) => p.x), lvl.map((p) => p.y));
      const noTp = TW.C21.filter((x) => x !== '台北市').map((x) => ({ x: P.q[x].med[LQ], y: TW.netRate(x, 0, n - 1) })).filter((p) => p.x != null), rl2 = TW.pearson(noTp.map((p) => p.x), noTp.map((p) => p.y));
      $('#rSum').innerHTML = [
        '<b>最貴的台北市確實在流失人口：</b>2020 年以來國內淨遷出 <b>' + wan(-tpe) + ' 人</b>（每年約 ' + fmt(-TW.netRate('台北市', 0, n - 1), 1) + '‰），其中淨流向新北市 ' + wan(tpeNtp) + ' 人、桃園市 ' + wan(tpeTy) + ' 人。',
        '<b>外移是一層一層往外推：</b>台北 → 新北（單價約台北的 ' + fmt(P.q['新北市'].med[LQ] / P.q['台北市'].med[LQ] * 100) + '%），新北再淨流向桃園 ' + wan(ntpTy) + ' 人（單價約新北的 ' + fmt(P.q['桃園市'].med[LQ] / P.q['新北市'].med[LQ] * 100) + '%）。雙北加基隆合計國內淨遷' + (nNet < 0 ? '出' : '入') + ' <b>' + wan(Math.abs(nNet)) + ' 人</b>；但把桃園、新竹縣市、宜蘭一起算，整個北部是 <b>' + sign(northAll) + ' 人</b>。',
        '<b>但「房價高 = 人口流出」並不是全台通則：</b>21 個縣市的房價水準與淨遷入率相關係數 r = <b>' + fmt(rl, 2) + '</b>（' + TW.rDesc(rl) + '）；拿掉台北市後 r = ' + fmt(rl2, 2) + '。新竹縣市、桃園、台中房價不低卻持續吸人，因為有就業機會；房價最低的幾個農業縣反而在流失人口。',
        '<b>行政區層級更明顯是「便宜又近」吸人：</b>全台 ' + towns.length + ' 個行政區的單價與淨遷入率 r = ' + fmt(tr, 2) + '（' + TW.rDesc(tr) + '）。成長最快的多是都會外圍的重劃區，而不是最便宜的偏鄉。',
        '<b>較合理的解讀：</b>房價不是把人「推出北部」，而是決定人在<b>同一個都會圈內往哪一圈落腳</b>：台北 → 新北 → 桃園 → 新竹的同心圓擴散。' + (Math.abs(northAll) < Math.abs(nNet) * .5 ? '離開雙北的人多數仍留在北部，' : '') + '北部以外真正大量吸人的是 <b>' + gain[0].c + '</b>（' + sign(gain[0].v) + ' 人）' + (gain[1] ? '與 ' + gain[1].c + '（' + sign(gain[1].v) + ' 人）' : '') + '。',
      ].map((t, i) => '<div class="insight"><span class="n">' + (i + 1) + '</span><p>' + t + '</p></div>').join('');
    };
    $('#rX').appendChild(TW.seg([['level', '房價水準'], ['chg', '2020 至今漲幅']], st.x, (v) => { st.x = v; res.cur = drawCounty(); }));
    $('#rP').appendChild(TW.seg([['all', '全期']].concat(M.years.slice(-3).map((y) => [y, String(y)])), st.period, (v) => { st.period = v; res.cur = drawCounty(); }));
    res.cur = drawCounty(); summary();
    const onResize = () => Object.values(cs).forEach((c) => c.resize()); window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); Object.values(cs).forEach((c) => c.dispose()); };
  };

  /* ================= 資料來源與方法 ================= */
  TW.pages.sources = (root) => {
    const s = P.stats, src = (badge, bcls, title, rows) => '<section class="card c6 src"><h3>' + title + ' <span class="badge ' + bcls + '">' + badge + '</span></h3><dl>' + rows.map((r) => '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>').join('') + '</dl></section>';
    const link = (u, t) => '<a href="' + u + '" target="_blank" rel="noopener">' + (t || u) + '</a>';
    root.innerHTML = TW.head('關於', '資料來源與方法', '這個儀表板的每個數字都來自下列公開資料，沒有任何模擬或估計值。資料最後更新：' + D.built + '。', '') +
      '<div class="grid">' +
      src('政府開放資料', 'gov', '① 成交價：內政部實價登錄', [
        ['用在哪', '成交行情、行政區探索、所有「成屋／預售單價、總價、成交量」'],
        ['來源', '內政部不動產交易實價查詢服務網 — 開放資料下載<br>' + link('https://plvr.land.moi.gov.tw/DownloadOpenData')],
        ['範圍', '季度檔 ' + P.seasons[0].replace('S', ' 年第 ') + ' 季 至 ' + P.seasons[1].replace('S', ' 年第 ') + ' 季（民國），加上之後每 10 天發布的單期檔；只取交易日 2020/01/01 以後'],
        ['筆數', '讀取 ' + fmt(s.rows) + ' 筆買賣與預售紀錄，篩選後採用 ' + fmt(s.kept) + ' 筆住宅交易'],
        ['處理方式', '依「交易年月日」歸屬季度；主要用途含「住家用」；排除備註含親友、員工、特殊關係、持分、地上權等特殊交易（' + fmt(s.special) + ' 筆）；單價只用大樓・華廈・公寓・套房，並保留 2–400 萬/坪；樣本少於 5 筆不顯示中位數'],
        ['限制', '從簽約到揭露約落後 1–3 個月，所以最新一季（' + TW.qLabel(last(Q)) + '）成交量明顯偏低，圖表以「＊」標示；預售屋 2021/07 以前登錄不即時'],
      ]) +
      src('民間調查', 'pri', '② 開價與議價率：國泰房地產指數', [
        ['用在哪', '開價 vs 成交頁、總覽的開價卡片'],
        ['來源', '國泰建設 × 政治大學台灣房地產研究中心，每季新聞稿表 1<br>' + link('https://www.cathay-red.com.tw/tw/About/House')],
        ['範圍', TW.qLabel(Object.keys(A.quarters)[0]) + ' 至 ' + TW.qLabel(last(Object.keys(A.quarters))) + '，共 ' + Object.keys(A.quarters).length + ' 季；全國＋台北、新北、桃園、新竹縣市、台中、台南、高雄'],
        ['處理方式', '由 PDF 讀出「可能成交價」「議價率」「30 天銷售率」；<b>開價 = 可能成交價 ÷（1 − 議價率）</b>，依議價率定義反推'],
        ['限制', '調查對象是<b>新推案</b>（預售＋新成屋），不含中古屋；2022Q1 起價格模型改版，前後不完全可比；政府並沒有全台開價的開放資料，所以開價只有這八個地區'],
      ]) +
      src('政府開放資料', 'gov', '③ 戶籍遷入遷出：內政部戶政司', [
        ['用在哪', '遷徙流向地圖、遷入遷出趨勢、房價 × 遷徙'],
        ['來源', '戶政司人口統計資料開放 API<br>' + link('https://www.ris.gov.tw/rs-opendata/api/Main/docs/v1')],
        ['資料集', '<b>ODRP011</b> 遷入遷出統計表（村里・每月，' + MO[0].replace('-', '/') + '–' + last(MO).replace('-', '/') + '）<br><b>ODRP094</b> 各直轄市、縣市間遷徙人口數（完整 22×22，' + M.fullMonths.length + ' 個月：' + M.fullMonths[0].replace('-', '/') + '、' + M.fullMonths[1].replace('-', '/') + '–' + last(M.fullMonths).replace('-', '/') + '）<br><b>ODRP019</b> 年底人口數（計算每千人比率）'],
        ['處理方式', '村里資料加總到鄉鎮市區與縣市。國內淨遷入 = 自其他縣市遷入 − 遷往其他縣市，已扣除縣內跨區與國外・初設・除籍'],
        ['限制', 'ODRP011 只把「六都」各自列出，其他縣市合併成「臺灣省」；所以 <b>2020–2024 年的箭頭只有「至少一端是六都」的流向</b>，非六都之間（如新竹縣↔新竹市）要 2025/02 之後才有。戶籍遷徙不等於實際搬家'],
      ]) +
      src('地圖', 'map', '④ 底圖與縣市界線', [
        ['底圖', '© OpenStreetMap contributors（ODbL），圖磚由 tile.openstreetmap.org 提供<br>' + link('https://www.openstreetmap.org/copyright')],
        ['縣市界', '內政部國土測繪中心「直轄市、縣市界線」，經 taiwan-atlas 專案簡化（MIT）<br>' + link('https://github.com/dkaoster/taiwan-atlas')],
        ['箭頭', '自行繪製的 SVG 圖層；端點放在各縣市人口重心附近（相鄰縣市略為錯開），粗細與人數的平方根成正比'],
        ['函式庫', 'Leaflet 1.9.4、Apache ECharts 5.5.0'],
      ]) +
      '</div><div class="grid">' +
      '<section class="card c6"><div class="card-head"><div><h3>名詞對照</h3></div></div><ul class="prose"><li><b>成屋</b>：實價登錄「不動產買賣」，包含中古屋與新成屋。</li><li><b>預售</b>：實價登錄「預售屋買賣」。</li><li><b>議價率</b>：（開價 − 成交價）÷ 開價。數字越小，代表越難殺價。</li><li><b>淨遷入率（‰/年）</b>：期間內國內淨遷入人數 ÷ 人口 × 1000，再換算成一年。</li><li><b>年增率</b>：和去年同一季相比。</li><li>漲跌配色依台灣慣例：<span class="up">紅色為漲</span>、<span class="down">綠色為跌</span>；遷徙圖則是<span style="color:var(--c-in)">藍色流入</span>、<span style="color:var(--c-out)">紅色流出</span>。</li></ul></section>' +
      '<section class="card c6"><div class="card-head"><div><h3>如何更新資料</h3><p>所有抓取與彙整程式都在專案的 scripts 資料夾</p></div></div><div class="prose"><p>在專案資料夾執行：</p><p><code>python scripts/update_all.py</code></p><ul><li><code>fetch_lvr.py</code> 下載實價登錄季度檔與單期檔</li><li><code>fetch_migration.py</code>、<code>fetch_od.py</code> 抓戶政司 API</li><li><code>fetch_cathay.py</code> 下載並解析國泰指數新聞稿（需 <code>pip install pypdf</code>）</li><li><code>build_prices.py</code>、<code>build_migration.py</code>、<code>bundle.py</code> 彙整並產生 <code>data/bundle.js</code></li></ul><p>已下載過的檔案會略過，只補新的月份與季度。</p></div></section>' +
      '</div>';
  };
})();
