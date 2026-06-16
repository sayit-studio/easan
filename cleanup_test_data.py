"""一次性清除測試殘留資料（archive 到 Notion 垃圾桶）。

清除對象：
1. 人員權限庫中 LINE userId = UAUTOTEST20260615 的「自動建檔測試」人員。
2. 掃描批次紀錄中 狀態 = 待授權 的批次（測試未授權 OCR 產生的「未授權-…」）。

執行（PowerShell）：
    $env:NOTION_TOKEN = "你的 Notion integration token"
    # 可選：$env:DRY_RUN = "1"   # 只列出將被清除的項目，不實際 archive
    python cleanup_test_data.py
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

NOTION_VERSION = "2022-06-28"
PEOPLE_DB = "374b3ad1d1cd80c6a923fd022abc0305"
BATCH_DB = "374b3ad1d1cd80eeb5dff6b5991e1d29"
TEST_USER_ID = "UAUTOTEST20260615"


def notion_request(method, url, token, payload=None):
    headers = {
        "Authorization": f"Bearer {token}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
    }
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8") if payload is not None else None
    last_error = None
    for attempt in range(1, 6):
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                body = resp.read().decode("utf-8")
                return json.loads(body) if body else {}
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            if exc.code not in (429, 500, 502, 503, 504):
                raise RuntimeError(f"Notion API {exc.code}: {body}") from exc
            last_error = RuntimeError(f"Notion API {exc.code}: {body}")
        except Exception as exc:  # noqa: BLE001
            last_error = exc
        time.sleep(min(20, attempt * 2))
    raise RuntimeError(str(last_error))


def query_all(token, db_id):
    url = f"https://api.notion.com/v1/databases/{db_id}/query"
    results = []
    cursor = None
    while True:
        payload = {"page_size": 100}
        if cursor:
            payload["start_cursor"] = cursor
        data = notion_request("POST", url, token, payload)
        results.extend(data.get("results", []))
        if not data.get("has_more"):
            break
        cursor = data.get("next_cursor")
    return results


def text_value(prop):
    parts = (prop or {}).get("rich_text", [])
    return "".join(p.get("plain_text", "") for p in parts).strip()


def title_value(prop):
    parts = (prop or {}).get("title", [])
    return "".join(p.get("plain_text", "") for p in parts).strip()


def select_name(prop):
    sel = (prop or {}).get("select")
    return sel.get("name", "") if sel else ""


def archive(token, page_id):
    return notion_request("PATCH", f"https://api.notion.com/v1/pages/{page_id}", token, {"archived": True})


def main():
    token = os.environ.get("NOTION_TOKEN")
    if not token:
        print("Missing NOTION_TOKEN environment variable.", file=sys.stderr)
        return 2
    dry_run = os.environ.get("DRY_RUN", "").strip() == "1"

    targets = []  # (label, page_id)

    for page in query_all(token, PEOPLE_DB):
        props = page.get("properties", {})
        if text_value(props.get("LINE userId")) == TEST_USER_ID:
            targets.append((f"人員 {title_value(props.get('名稱'))} ({TEST_USER_ID})", page["id"]))

    for page in query_all(token, BATCH_DB):
        props = page.get("properties", {})
        if select_name(props.get("狀態")) == "待授權":
            targets.append((f"批次 {title_value(props.get('名稱'))} [待授權]", page["id"]))

    if not targets:
        print("沒有找到符合的測試殘留資料。")
        return 0

    print(f"找到 {len(targets)} 筆要清除（dry_run={dry_run}）：")
    for label, _ in targets:
        print("  -", label)

    if dry_run:
        return 0

    archived = 0
    for label, page_id in targets:
        try:
            archive(token, page_id)
            archived += 1
            time.sleep(0.15)
        except Exception as exc:  # noqa: BLE001
            print(f"FAILED {label}: {exc}", file=sys.stderr)
    print(f"已 archive {archived}/{len(targets)} 筆。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
