const state = {
  imageFile: null,
  results: [],
  isProcessing: false,
  operator: {
    name: "LINE 使用者",
    userId: "",
    allowed: false,
  },
};

const CONFIG = {
  liffId: "2010295228-FaJJlXg9",
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
  operatorName: document.querySelector("#operatorName"),
  operatorId: document.querySelector("#operatorId"),
  permissionBadge: document.querySelector("#permissionBadge"),
  mobilePermissionBadge: document.querySelector("#mobilePermissionBadge"),
  loadDemoBtn: document.querySelector("#loadDemoBtn"),
  processingModal: document.querySelector("#processingModal"),
  mobileMenuBtn: document.querySelector("#mobileMenuBtn"),
  mobileMenu: document.querySelector("#mobileMenu"),
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

async function initLiffProfile() {
  renderOperator();

  if (!window.liff) {
    state.operator.name = "非 LIFF 測試環境";
    renderOperator();
    return;
  }

  try {
    await window.liff.init({ liffId: CONFIG.liffId });

    if (!window.liff.isLoggedIn()) {
      window.liff.login({ redirectUri: window.location.href });
      return;
    }

    const profile = await window.liff.getProfile();
    state.operator = {
      name: profile.displayName || "LINE 使用者",
      userId: profile.userId || "",
      allowed: false,
    };
  } catch (error) {
    state.operator = {
      name: "LIFF 識別失敗",
      userId: "",
      allowed: false,
    };
  }

  renderOperator();
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

function setProcessing(isProcessing) {
  state.isProcessing = isProcessing;
  els.processingModal.classList.toggle("hidden", !isProcessing);
  els.runOcrBtn.disabled = isProcessing || !state.imageFile;
  els.mobileRunOcrBtn.disabled = isProcessing || !state.imageFile;
  els.cameraInput.disabled = isProcessing;
  els.fileInput.disabled = isProcessing;
}

async function runOcr() {
  if (state.isProcessing || !state.imageFile) return;
  const webhook = CONFIG.ocrWebhook;
  setProcessing(true);
  els.batchStatus.textContent = "OCR 中";

  try {
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
    els.batchStatus.textContent = "成功";
    renderResults();
  } catch (error) {
    els.batchStatus.textContent = "失敗";
  } finally {
    setProcessing(false);
  }
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

els.mobileMenuBtn.addEventListener("click", () => {
  const willOpen = els.mobileMenu.classList.contains("hidden");
  els.mobileMenu.classList.toggle("hidden", !willOpen);
  els.mobileMenuBtn.classList.toggle("active", willOpen);
  els.mobileMenuBtn.setAttribute("aria-expanded", String(willOpen));
});

els.mobileMenu.addEventListener("click", (event) => {
  if (event.target.closest("a")) {
    els.mobileMenu.classList.add("hidden");
    els.mobileMenuBtn.classList.remove("active");
    els.mobileMenuBtn.setAttribute("aria-expanded", "false");
  }
});

els.runOcrBtn.addEventListener("click", () => {
  runOcr();
});

els.mobileRunOcrBtn.addEventListener("click", () => {
  runOcr();
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
  renderOperator();
  renderResults();
});

initLiffProfile();
renderResults();
