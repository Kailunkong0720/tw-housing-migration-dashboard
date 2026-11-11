# 島內移動｜台灣房市 × 人口遷徙戰情室

全台房地產「開價與成交」以及「戶籍遷入遷出」的互動式儀表板，資料涵蓋 2020 年至今，用來觀察房價與人口流動的關係。

## 頁面

- **全台總覽**：KPI、開價 vs 成交、各縣市房價與淨遷入排行
- **成交行情**：各縣市單價、總價、成交量、年增率熱力圖
- **開價 vs 成交**：議價空間與議價率
- **行政區探索**：355 個鄉鎮市區的房價、成交量、淨遷入率
- **遷徙流向地圖**：OpenStreetMap 底圖，點縣市以箭頭顯示遷出去向與遷入來源
- **遷入遷出趨勢**：每月淨遷入、六都對各縣市的淨流動
- **房價 × 遷徙**：房價與人口流動的相關分析
- **資料來源與方法**

## 如何開啟

需要 Python 3。Windows 直接雙擊 `start.bat`，或執行：

```bash
python serve.py --open
```

然後開啟 http://localhost:8765 。

## 資料來源

| 用途 | 來源 |
|---|---|
| 成交價、成交量 | [內政部不動產交易實價查詢服務網 開放資料](https://plvr.land.moi.gov.tw/DownloadOpenData) |
| 開價、議價率 | [國泰房地產指數季報](https://www.cathay-red.com.tw/tw/About/House)（國泰建設 × 政治大學台灣房地產研究中心） |
| 戶籍遷入遷出、人口數 | [內政部戶政司 開放資料 API](https://www.ris.gov.tw/rs-opendata/api/Main/docs/v1)（ODRP011、ODRP094、ODRP019） |
| 底圖 | © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors |
| 縣市界線 | 內政部國土測繪中心，經 [taiwan-atlas](https://github.com/dkaoster/taiwan-atlas) 簡化 |

各來源的處理方式與限制寫在儀表板的「資料來源與方法」頁。

## 更新資料

```bash
pip install pypdf
python scripts/update_all.py
```

會下載新的月份與季度到 `data_raw/`（未納入版本控制），重新彙整並產生 `data/bundle.js`。
