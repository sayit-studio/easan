# easan

現場補料單 OCR 核對工具。此 repo 目前放置 LIFF/HTML 前端與 n8n workflow 匯入檔。

## Files

- `index.html`：LIFF 入口頁，提供圖片上傳、OCR 結果顯示與 webhook 設定。
- `styles.css`：RWD 樣式，支援手機 LIFF 操作。
- `app.js`：前端流程邏輯，將圖片送到 n8n OCR Webhook。
- `n8n_easan_html_ocr_notion_simple.json`：n8n workflow 匯入檔，負責 Gemini OCR、Notion 比對與寫入。

## LIFF Endpoint

GitHub Pages 啟用後，LIFF Endpoint 可使用：

`https://sayit-studio.github.io/easan/`

進入頁面後，在設定中填入 n8n production webhook URL。
