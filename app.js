const state = {
  imageFile: null,
  results: [],
  isProcessing: false,
  permissionChecked: false,
  operator: {
    name: "LINE 使用者",
    userId: "",
    allowed: false,
  },
};

const CONFIG = {
  liffId: "2010295228-FaJJlXg9",
  liffUrl: "https://liff.line.me/2010295228-FaJJlXg9",
  liffEndpoint: "https://easan.pages.dev/",
  ocrWebhook: "https://sayitstudio.zeabur.app/webhook/easan-html-ocr",
  permissionWebhook: "https://sayitstudio.zeabur.app/webhook/easan-operator-permission",
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
  processingModal: document.querySelector("#processingModal"),
  mobileMenuBtn: document.querySelector("#mobileMenuBtn"),
  mobileMenu: document.querySelector("#mobileMenu"),
};

function renderOperator() {
  els.operatorName.textContent = state.operator.name;
  els.operatorId.textContent = state.operator.userId || "等待 LIFF 識別";
  els.permissionBadge.textContent = state.operator.allowed ? "已開通" : "待開通";
  els.permissionBadge.className = `badge ${state.operator.allowed ? "allowed" : "pending"}`;
  els.mobilePermissionBadge.textContent = state.operator.allowed ? "已開通" : "待開通";
  els.mobilePermissionBadge.className = `badge ${state.operator.allowed ? "allowed" : "pending"}`;
  renderInputState();
}

function renderInputState() {
  const canChooseImage = !state.isProcessing;
  const canRunOcr = state.operator.allowed && !state.isProcessing && Boolean(state.imageFile);
  els.cameraInput.disabled = !canChooseImage;
  els.fileInput.disabled = !canChooseImage;
  els.runOcrBtn.disabled = !canRunOcr;
  els.mobileRunOcrBtn.disabled = !canRunOcr;
}

async function checkOperatorPermission(operator) {
  if (!operator.userId) return { allowed: false };

  const response = await fetch(CONFIG.permissionWebhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: operator.userId,
      displayName: operator.name,
    }),
  });

  if (!response.ok) return { allowed: false };

  const payload = await response.json();
  return {
    allowed: payload.allowed === true || payload.ok === true,
    name: payload.name || payload.displayName || operator.name,
  };
}

async function initLiffProfile() {
  renderOperator();

  if (!window.liff) {
    state.operator.name = "非 LIFF 測試環境";
    state.permissionChecked = true;
    renderOperator();
    return;
  }

  try {
    await window.liff.init({ liffId: CONFIG.liffId });

    if (!window.liff.isLoggedIn()) {
      window.liff.login({ redirectUri: CONFIG.liffEndpoint });
      return;
    }

    const profile = await window.liff.getProfile();
    state.operator = {
      name: profile.displayName || "LINE 使用者",
      userId: profile.userId || "",
      allowed: false,
    };

    try {
      const permission = await checkOperatorPermission(state.operator);
      state.operator = {
        ...state.operator,
        name: permission.name || state.operator.name,
        allowed: permission.allowed,
      };
    } catch (error) {
      state.operator.allowed = false;
    }
  } catch (error) {
    state.operator = {
      name: "LIFF 識別失敗",
      userId: "",
      allowed: false,
    };
  } finally {
    state.permissionChecked = true;
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
  renderInputState();
}

async function runOcr() {
  if (state.isProcessing || !state.imageFile) return;
  if (!state.operator.allowed) {
    els.batchStatus.textContent = "未開通";
    return;
  }
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
  els.batchStatus.textContent = state.operator.allowed ? "待執行" : "未開通";
  renderInputState();
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

initLiffProfile();
renderResults();
