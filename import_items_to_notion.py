import csv
import json
import os
import sys
import time
import urllib.error
import urllib.request


NOTION_VERSION = "2022-06-28"
MASTER_DB_ID = "33eb3ad1d1cd80fc9674e730c3c87469"
DEFAULT_CSV = os.path.join("outputs", "品項主檔_OMBRA_匯入.csv")


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
        except Exception as exc:
            last_error = exc
        time.sleep(min(20, attempt * 2))
    raise RuntimeError(str(last_error))


def text_prop(value):
    value = str(value or "")[:1900]
    return {"rich_text": [{"type": "text", "text": {"content": value}}]} if value else {"rich_text": []}


def title_prop(value):
    value = str(value or "未命名")[:1900]
    return {"title": [{"type": "text", "text": {"content": value}}]}


def load_rows(path):
    with open(path, "r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        rows = []
        seen = set()
        for row in reader:
            part_no = (row.get("品號") or "").strip()
            if not part_no or part_no in seen:
                continue
            seen.add(part_no)
            rows.append({
                "品號": part_no,
                "品名": (row.get("品名") or "").strip(),
                "規格": (row.get("規格") or "").strip(),
                "類別名稱": (row.get("類別名稱") or "").strip(),
                "單位": (row.get("單位") or "").strip(),
            })
        return rows


def find_existing_page(token, part_no):
    url = f"https://api.notion.com/v1/databases/{MASTER_DB_ID}/query"
    payload = {
        "filter": {"property": "品號", "title": {"equals": part_no}},
        "page_size": 1,
    }
    data = notion_request("POST", url, token, payload)
    results = data.get("results") or []
    return results[0] if results else None


def extract_title(page, prop_name):
    title = page.get("properties", {}).get(prop_name, {}).get("title", [])
    return "".join(part.get("plain_text", "") for part in title).strip()


def load_existing_pages(token):
    url = f"https://api.notion.com/v1/databases/{MASTER_DB_ID}/query"
    existing = {}
    cursor = None
    while True:
        payload = {"page_size": 100}
        if cursor:
            payload["start_cursor"] = cursor
        data = notion_request("POST", url, token, payload)
        for page in data.get("results", []):
            part_no = extract_title(page, "品號")
            if part_no:
                existing[part_no] = page["id"]
        if not data.get("has_more"):
            break
        cursor = data.get("next_cursor")
    return existing


def page_properties(row):
    return {
        "品號": title_prop(row["品號"]),
        "品名": text_prop(row["品名"]),
        "規格": text_prop(row["規格"]),
        "類別名稱": text_prop(row["類別名稱"]),
        "單位": text_prop(row["單位"]),
    }


def create_page(token, row):
    return notion_request("POST", "https://api.notion.com/v1/pages", token, {
        "parent": {"database_id": MASTER_DB_ID},
        "properties": page_properties(row),
    })


def update_page(token, page_id, row):
    return notion_request("PATCH", f"https://api.notion.com/v1/pages/{page_id}", token, {
        "properties": page_properties(row),
    })


def main():
    token = os.environ.get("NOTION_TOKEN")
    if not token:
        print("Missing NOTION_TOKEN environment variable.", file=sys.stderr)
        return 2

    path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CSV
    skip_existing = os.environ.get("SKIP_EXISTING", "").strip() == "1"
    rows = load_rows(path)
    existing_pages = load_existing_pages(token)
    created = 0
    updated = 0
    skipped = 0
    failed = 0

    for index, row in enumerate(rows, start=1):
        try:
            existing_page_id = existing_pages.get(row["品號"])
            if existing_page_id:
                if skip_existing:
                    skipped += 1
                else:
                    update_page(token, existing_page_id, row)
                    updated += 1
            else:
                page = create_page(token, row)
                existing_pages[row["品號"]] = page["id"]
                created += 1
            if index % 25 == 0:
                print(f"{index}/{len(rows)} processed; created={created}, updated={updated}, skipped={skipped}, failed={failed}", flush=True)
            time.sleep(0.12)
        except Exception as exc:
            failed += 1
            print(f"FAILED {row['品號']}: {exc}", file=sys.stderr)

    print(json.dumps({
        "source": path,
        "total": len(rows),
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "failed": failed,
    }, ensure_ascii=False, indent=2))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
