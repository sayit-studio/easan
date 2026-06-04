const state = {
  imageFile: null,
  results: [],
  operator: {
    name: "LINE 使用者",
    userId: "",
    allowed: false,
  },
};

const CONFIG = {
  liffUrl: "https://liff.line.me/2010295228-FaJJlXg9",
  ocrWebhook: "https://sayitstudio.zeabur.app/webhook/easan-html-ocr",
};

const els = {
  cameraInput: document.querySelector("#cameraInput"),
  fileInput: document.querySelector("#fileInput"),
  previewShell: document.querySelector("#previewShell"),
  imagePreview: document.querySelector("#imagePreview"),
  runOcrBtn: document.querySelector("#runOcrBtn"),
  mobileRunOcrBtn: document.querySelector("#mobileRunOcrBtn"),
  resultBody: document.querySelector("#resultBody"),
  totalCount: document.querySelector("#totalCount"),
  passedCount: document.querySelector("#passedCount"),
  abnormalCount: document.querySelector("#abnormalCount"),
  orderNo: document.querySelector("#orderNo"),
  batchStatus: document.querySelector("#batchStatus"),
  notionStatus: document.querySelector("#notionStatus"),
  operatorName: document.querySelector("#operatorName"),
  operatorId: document.querySelector("#operatorId"),
  permissionBadge: document.querySelector("#permissionBadge"),
  mobilePermissionBadge: document.querySelector("#mobilePermissionBadge"),
  loadDemoBtn: document.querySelector("#loadDemoBtn"),
};

const demoResults = [
  {
    status: "OK",
    partNo: "I010615019009",
    spec: "(面版須有150PC MULTIPURPOSE TOOL SET)(2024版 有QR CODE) 未裝鐵扣",
    defectiveQty: 0,
    requestQty: 12,
    receivedQty: 12,
    note: "主檔比對通過",
  },
  {
    status: "異常",
    partNo: "I010621619001",
    spec: "未裝鐵扣",
    defectiveQty: 0,
    requestQty: 8,
    receivedQty: 7,
    note: "實領數量與需領數量不同",
  },
  {
    status: "異常",
    partNo: "",
    spec: "",
    defectiveQty: 0,
    requestQty: 0,
    receivedQty: 0,
    note: "品號無法判讀",
  },
];

function renderOperator() {
  els.operatorName.textContent = state.operator.name;
  els.operatorId.textContent = state.operator.userId || "等待 LIFF 識別";
  els.permissionBadge.textContent = state.operator.allowed ? "已開通" : "待授權";
  els.permissionBadge.className = `badge ${state.operator.allowed ? "allowed" : "pending"}`;
  els.mobilePermissionBadge.textContent = state.operator.allowed ? "已開通" : "待授權";
  els.mobilePermissionBadge.className = `badge ${state.operator.allowed ? "allowed" : "pending"}`;
}

function renderSummary(orderNo = "未判讀") {
  const total = state.results.length;
  const abnormal = state.results.filter((item) => item.status !== "OK").length;
  els.totalCount.textContent = String(total);
  els.passedCount.textContent = String(total - abnormal);
  els.abnormalCount.textContent = String(abnormal);
  els.orderNo.textContent = orderNo;
}

function renderResults() {
  if (!state.results.length) {
    els.resultBody.innerHTML = '<tr class="empty-row"><td colspan="7">等待 OCR 結果</td></tr>';
    renderSummary();
    return;
  }

  els.resultBody.innerHTML = state.results.map((item) => `
    <tr>
      <td><span class="state ${item.status === "OK" ? "ok" : "bad"}">${item.status}</span></td>
      <td><span class="cell-text">${escapeHtml(item.partNo || "未判讀")}</span></td>
      <td><span class="cell-text">${escapeHtml(item.spec || "未判讀")}</span></td>
      <td><span class="cell-text">${escapeHtml(item.defectiveQty)}</span></td>
      <td><span class="cell-text">${escapeHtml(item.requestQty)}</span></td>
      <td><span class="cell-text">${escapeHtml(item.receivedQty)}</span></td>
      <td><span class="cell-text">${escapeHtml(item.note || "")}</span></td>
    </tr>
  `).join("");

  renderSummary(state.orderNo || "未判讀");
}

function escapeAttr(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function runOcr() {
  const webhook = CONFIG.ocrWebhook;
  els.batchStatus.textContent = "OCR 中";
  els.notionStatus.textContent = "尚未寫入";

  const form = new FormData();
  form.append("image", state.imageFile);
  form.append("operator", JSON.stringify(state.operator));

  const response = await fetch(webhook, { method: "POST", body: form });
  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(responseText || `OCR webhook failed: ${response.status}`);
  }

  let payload;
  try {
    payload = JSON.parse(responseText);
  } catch (error) {
    throw new Error(responseText || "OCR webhook 沒有回傳 JSON，請檢查 n8n 執行紀錄");
  }

  state.results = payload.results || [];
  state.orderNo = payload.order_no || "未判讀";
  els.batchStatus.textContent = "已寫入";
  els.notionStatus.textContent = payload.first_notion_url ? "已寫入 Notion" : "已完成";
  renderResults();
}

function handleImageInput(input) {
  const file = input.files?.[0];
  if (!file) return;
  state.imageFile = file;
  els.imagePreview.src = URL.createObjectURL(file);
  els.previewShell.classList.add("has-image");
  els.runOcrBtn.disabled = false;
  els.mobileRunOcrBtn.disabled = false;
}

[els.cameraInput, els.fileInput].forEach((input) => {
  input.addEventListener("change", () => handleImageInput(input));
});

els.runOcrBtn.addEventListener("click", () => {
  runOcr().catch((error) => {
    els.batchStatus.textContent = "失敗";
    els.notionStatus.textContent = error.message;
  });
});

els.mobileRunOcrBtn.addEventListener("click", () => {
  runOcr().catch((error) => {
    els.batchStatus.textContent = "失敗";
    els.notionStatus.textContent = error.message;
  });
});

els.loadDemoBtn.addEventListener("click", () => {
  state.operator = {
    name: "王小明",
    userId: "U-demo-operator",
    allowed: true,
  };
  state.results = structuredClone(demoResults);
  state.orderNo = "510A-20230420093";
  els.batchStatus.textContent = "待確認";
  els.notionStatus.textContent = "尚未寫入";
  renderOperator();
  renderResults();
});

renderOperator();
renderResults();
