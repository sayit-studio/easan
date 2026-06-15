# easan

現場補料單 OCR 核對工具。此 repo 目前放置 LIFF/HTML 前端與 n8n workflow 匯入檔。

## Files

- `index.html`：LIFF 入口頁，提供圖片上傳、OCR 結果顯示與 webhook 設定。
- `styles.css`：RWD 樣式，支援手機 LIFF 操作。
- `app.js`：前端流程邏輯，將圖片送到 n8n OCR Webhook。
- `admin.html`：管理者統計頁，需輸入密碼並透過 n8n webhook 讀取資料。
- `admin.js`：管理統計頁邏輯，顯示正確率、執行次數、人員成效與近期批次。
- `n8n_easan_html_ocr_notion_nodes.json`：n8n workflow 匯入檔，使用 Gemini OCR 與 n8n Notion 節點讀寫 Notion。
- `n8n_easan_operator_permission.json`：n8n 開通查詢 workflow，供 LIFF 以 LINE userId 查詢是否可使用。
- `n8n_easan_admin_permissions.json`：n8n 管理後台人員權限 workflow，供管理頁切換人員狀態與 OCR 使用權限。
- `n8n_easan_admin_stats.json`：n8n 管理後台成效統計 workflow，供管理頁讀取正確率、批次與人員成效。
- `n8n_easan_master_import.json`：n8n 品項主檔匯入 workflow，供管理頁「主檔匯入」分頁上傳 CSV/Excel，預覽或正式 upsert 寫入 OCR品項主檔。

## LIFF Endpoint

Cloudflare Pages 部署後，LIFF Endpoint 使用：

`https://easan.pages.dev/`

OCR 頁面的 LIFF 入口與 n8n production webhook 已寫入前端設定，現場頁面不顯示設定欄位。

## LIFF User Permission

每次進入 LIFF 頁面會先透過 LIFF `getProfile()` 擷取 `userId`，再以 `POST` 查詢開通資格：

```json
{
  "userId": "LINE userId",
  "displayName": "LINE 顯示名稱"
}
```

開通查詢 webhook 需回傳：

```json
{
  "ok": true,
  "allowed": true,
  "name": "使用者名稱"
}
```

只有 `allowed: true` 的使用者可上傳圖片與執行 OCR。n8n OCR webhook 也應在後端再次查詢同一份開通資料庫，避免未開通者繞過前端直接呼叫 webhook。

`n8n_easan_operator_permission.json` 已依目前 Notion schema 設定為內部人員權限資料庫：

`374b3ad1d1cd80c6a923fd022abc0305`

- `LINE userId`：文字欄位，存放 LINE profile userId。
- `姓名`：文字或標題欄位。
- `狀態`：select 欄位，值需為 `已開通`。
- `可使用功能`：multi-select 欄位，需包含 `OCR補料單`。

## Admin Permission Management

管理頁的人員權限分頁會呼叫：

`https://sayitstudio.zeabur.app/webhook/easan-admin-permissions`

`n8n_easan_admin_permissions.json` 使用同一個內部人員權限資料庫，可列出人員、更新 `狀態`，並切換 `可使用功能` 是否包含 `OCR補料單`。目前 workflow 使用固定管理密碼 `gundam`。

管理頁網址：

`https://easan.pages.dev/admin.html`

## Admin Stats Webhook

`n8n_easan_admin_stats.json` 已依目前 Notion schema 設定資料庫：

- 掃描批次紀錄：`374b3ad1d1cd80eeb5dff6b5991e1d29`
- OCR 明細結果資料庫：`2f6b3ad1d1cd8068a597e0994b74654c`

目前 workflow 使用固定管理密碼 `gundam`。

管理頁會以 `POST` 傳送：

```json
{
  "password": "管理者輸入的密碼",
  "range": "7 | 30 | all"
}
```

n8n 驗證成功後回傳（已擴充數據分析欄位）：

```json
{
  "ok": true,
  "summary": {
    "accuracy_rate": 0.95,
    "total_items": 100,
    "passed_items": 95,
    "abnormal_items": 5,
    "total_batches": 20,
    "today_batches": 2,
    "failed_batches": 1,
    "corrected_items": 4,
    "correction_rate": 0.04,
    "ocr_complete_rate": 0.92,
    "avg_processing_seconds": 7.4
  },
  "operators": [],
  "recent": [],
  "daily": [],
  "errorTypes": [],
  "ocrStatus": [],
  "problemParts": [],
  "notify": [],
  "details": []
}
```

管理頁「執行成效」分頁據此呈現：每日趨勢圖（每日筆數長條 + 正確率折線）、錯誤類型分布、OCR 辨識狀態分布、問題品號排行、LINE 通知狀況，以及可點開展開明細的近期批次表。`details` 為近期明細（上限 1000 筆）供批次鑽取使用。

## 掃描紀錄與分析欄位

OCR 主流程（`n8n_easan_html_ocr_notion_nodes.json`）除既有欄位外，另寫入：

- 掃描批次紀錄：`處理秒數`、`通知狀態`（HTML/LIFF 路徑預設 `前端回傳`）、`圖片ID`（`檔名|大小`，供未來防重複與追溯）、`正確率`（Notion formula 自動計算）。
- Easan現場補料單明細：`錯誤類型`（multi_select：製令單號未判讀／品號未判讀／品號開頭非英文／主檔查無品號／規格未判讀／規格不符／字跡模糊），供錯誤類型分布與問題品號分析。

「LINE 執行狀況」目前以掃描批次的 `通知狀態` 欄位記錄；尚未建置 LINE OA bot 推播流程，待後續評估。

## 主檔匯入 Webhook

`n8n_easan_master_import.json`（path：`easan-master-import`）供管理頁「主檔匯入」分頁使用。

管理頁以 `multipart/form-data` 傳送：`password`、`mode`（`preview` 或 `import`）、`category`、`file`（CSV 或 Excel）。

流程：驗證密碼（`gundam`）→ 依副檔名分流讀取 CSV/Excel → 整理去重並驗證品號 → 讀取現有 OCR品項主檔比對 → 既有品號 `update`、新品號 `create`、無效列 `skip`；`preview` 模式只回報不寫入。寫入欄位：品號(title)、品名、規格、類別名稱、單位、分類(select)、狀態=啟用、匯入批次ID、最後匯入時間。

回傳：

```json
{
  "ok": true,
  "mode": "import",
  "summary": { "total": 0, "valid": 0, "created": 0, "updated": 0, "skipped": 0, "failed": 0 },
  "rows": []
}
```

匯入後需在 n8n 為兩個 Notion 節點指定 Notion credential，並先以小檔 `preview` 測試。CSV 大量 upsert 也可改用 `import_items_to_notion.py`（需 `NOTION_TOKEN`）。
