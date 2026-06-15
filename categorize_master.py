"""一次性批次補齊 OCR品項主檔的「分類」與「狀態」。

用途：早期用 import_items_to_notion.py 匯入 OMBRA 主檔時只寫了「類別名稱」，
未設定 select 欄位「分類」，導致 2297 筆全為「未分類」。此腳本將所有
分類不在 (OMBRA, 吹氣盒) 的品項補上分類並設為啟用，避免後續資料紊亂。

執行（PowerShell）：
    $env:NOTION_TOKEN = "你的 Notion integration token"
    # 可選：$env:DEFAULT_CATEGORY = "OMBRA"   # 預設 OMBRA
    # 可選：$env:DRY_RUN = "1"                # 只試算不寫入
    python categorize_master.py

idempotent：已是 OMBRA/吹氣盒 的品項會跳過，可重複執行。
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

NOTION_VERSION = "2022-06-28"
MASTER_DB_ID = "33eb3ad1d1cd80fc9674e730c3c87469"
VALID_CATEGORIES = {"OMBRA", "吹氣盒"}


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


def select_name(prop):
    sel = (prop or {}).get("select")
    return sel.get("name", "") if sel else ""


def text_value(prop):
    parts = (prop or {}).get("rich_text", [])
    return "".join(p.get("plain_text", "") for p in parts).strip()


def load_all_pages(token):
    url = f"https://api.notion.com/v1/databases/{MASTER_DB_ID}/query"
    pages = []
    cursor = None
    while True:
        payload = {"page_size": 100}
        if cursor:
            payload["start_cursor"] = cursor
        data = notion_request("POST", url, token, payload)
        pages.extend(data.get("results", []))
        if not data.get("has_more"):
            break
        cursor = data.get("next_cursor")
    return pages


def main():
    token = os.environ.get("NOTION_TOKEN")
    if not token:
        print("Missing NOTION_TOKEN environment variable.", file=sys.stderr)
        return 2
    default_category = (os.environ.get("DEFAULT_CATEGORY") or "OMBRA").strip()
    dry_run = os.environ.get("DRY_RUN", "").strip() == "1"

    pages = load_all_pages(token)
    print(f"Loaded {len(pages)} master pages. default_category={default_category} dry_run={dry_run}")

    updated = skipped = failed = 0
    for index, page in enumerate(pages, start=1):
        props = page.get("properties", {})
        current = select_name(props.get("分類"))
        if current in VALID_CATEGORIES:
            skipped += 1
            continue
        category_name = text_value(props.get("類別名稱"))
        target = category_name if category_name in VALID_CATEGORIES else default_category
        if dry_run:
            updated += 1
            continue
        try:
            notion_request("PATCH", f"https://api.notion.com/v1/pages/{page['id']}", token, {
                "properties": {
                    "分類": {"select": {"name": target}},
                    "狀態": {"select": {"name": "啟用"}},
                }
            })
            updated += 1
            time.sleep(0.12)
        except Exception as exc:  # noqa: BLE001
            failed += 1
            print(f"FAILED {page.get('id')}: {exc}", file=sys.stderr)
        if index % 100 == 0:
            print(f"{index}/{len(pages)} processed; updated={updated}, skipped={skipped}, failed={failed}", flush=True)

    print(json.dumps({
        "total": len(pages),
        "updated": updated,
        "skipped": skipped,
        "failed": failed,
        "dry_run": dry_run,
    }, ensure_ascii=False, indent=2))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
