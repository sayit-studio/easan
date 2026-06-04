# easan

現場補料單 OCR 核對工具。此 repo 目前放置 LIFF/HTML 前端與 n8n workflow 匯入檔。

## Files

- `index.html`：LIFF 入口頁，提供圖片上傳、OCR 結果顯示與 webhook 設定。
- `styles.css`：RWD 樣式，支援手機 LIFF 操作。
- `app.js`：前端流程邏輯，將圖片送到 n8n OCR Webhook。
- `admin.html`：管理者統計頁，需輸入密碼並透過 n8n webhook 讀取資料。
- `admin.js`：管理統計頁邏輯，顯示正確率、執行次數、人員成效與近期批次。
- `n8n_easan_html_ocr_notion_simple.json`：n8n workflow 匯入檔，負責 Gemini OCR、Notion 比對與寫入。

## LIFF Endpoint

GitHub Pages 啟用後，LIFF Endpoint 可使用：

`https://sayit-studio.github.io/easan/`

OCR 頁面的 LIFF 入口與 n8n production webhook 已寫入前端設定，現場頁面不顯示設定欄位。

管理頁網址：

`https://sayit-studio.github.io/easan/admin.html`

## Admin Stats Webhook

管理頁會以 `POST` 傳送：

```json
{
  "password": "管理者輸入的密碼",
  "range": "7 | 30 | all"
}
```

n8n 驗證成功後回傳：

```json
{
  "ok": true,
  "summary": {
    "accuracy_rate": 0.95,
    "total_items": 100,
    "passed_items": 95,
    "abnormal_items": 5,
    "total_batches": 20,
    "today_batches": 2
  },
  "operators": [],
  "recent": []
}
```
