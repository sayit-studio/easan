const adminState = {
  password: "",
  range: "30",
  data: null,
  activeTab: "stats",
  permissions: [],
  masterImportResult: null,
};

const ADMIN_CONFIG = {
  statsWebhook: "https://sayitstudio.zeabur.app/webhook/easan-admin-stats",
  permissionsWebhook: "https://sayitstudio.zeabur.app/webhook/easan-admin-permissions",
  masterImportWebhook: "https://sayitstudio.zeabur.app/webhook/easan-master-import",
};

const adminEls = {
  loginPanel: document.querySelector("#loginPanel"),
  dashboardPanel: document.querySelector("#dashboardPanel"),
  loginForm: document.querySelector("#loginForm"),
  adminPasswordInput: document.querySelector("#adminPasswordInput"),
  rangeInput: document.querySelector("#rangeInput"),
  loginMessage: document.querySelector("#loginMessage"),
  refreshBtn: document.querySelector("#refreshBtn"),
  statsTabBtn: document.querySelector("#statsTabBtn"),
  permissionsTabBtn: document.querySelector("#permissionsTabBtn"),
  masterImportTabBtn: document.querySelector("#masterImportTabBtn"),
  statsView: document.querySelector("#statsView"),
  permissionsView: document.querySelector("#permissionsView"),
  masterImportView: document.querySelector("#masterImportView"),
  permissionsRefreshBtn: document.querySelector("#permissionsRefreshBtn"),
  permissionMessage: document.querySelector("#permissionMessage"),
  permissionList: document.querySelector("#permissionList"),
  masterImportForm: document.querySelector("#masterImportForm"),
  masterFileInput: document.querySelector("#masterFileInput"),
  masterCategoryInput: document.querySelector("#masterCategoryInput"),
  masterModeInput: document.querySelector("#masterModeInput"),
  masterImportBtn: document.querySelector("#masterImportBtn"),
  masterImportMessage: document.querySelector("#masterImportMessage"),
  masterImportResultPanel: document.querySelector("#masterImportResultPanel"),
  masterImportSummary: document.querySelector("#masterImportSummary"),
  masterImportBody: document.querySelector("#masterImportBody"),
  masterImportResetBtn: document.querySelector("#masterImportResetBtn"),
  mobileMenuBtn: document.querySelector("#mobileMenuBtn"),
  mobileMenu: document.querySelector("#mobileMenu"),
  accuracyRate: document.querySelector("#accuracyRate"),
  totalItems: document.querySelector("#totalItems"),
  passedItems: document.querySelector("#passedItems"),
  abnormalItems: document.querySelector("#abnormalItems"),
  totalBatches: document.querySelector("#totalBatches"),
  todayBatches: document.querySelector("#todayBatches"),
  operatorList: document.querySelector("#operatorList"),
  recentBody: document.querySelector("#recentBody"),
};

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatPercent(value) {
  const number = toNumber(value);
  if (number <= 1 && number > 0) return `${Math.round(number * 1000) / 10}%`;
  return `${Math.round(number * 10) / 10}%`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function featureList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item?.name || item).trim()).filter(Boolean);
  const text = String(value ?? "").trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed.map((item) => String(item?.name || item).trim()).filter(Boolean);
  } catch (error) {
    // Keep parsing permissive because Notion multi-select may arrive as text.
  }
  return text.split(/[,，、]/).map((item) => item.trim()).filter(Boolean);
}

function setActiveTab(tab) {
  adminState.activeTab = tab;
  adminEls.statsTabBtn.classList.toggle("active", tab === "stats");
  adminEls.permissionsTabBtn.classList.toggle("active", tab === "permissions");
  adminEls.masterImportTabBtn.classList.toggle("active", tab === "masterImport");
  adminEls.statsView.classList.toggle("hidden", tab !== "stats");
  adminEls.permissionsView.classList.toggle("hidden", tab !== "permissions");
  adminEls.masterImportView.classList.toggle("hidden", tab !== "masterImport");
}

async function readJsonResponse(response, fallbackMessage) {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`${fallbackMessage}：後端沒有回傳 JSON，請確認 n8n workflow 的 Respond to Webhook 節點已設定 responseBody。`);
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${fallbackMessage}：後端回傳格式不是 JSON`);
  }
}

async function fetchStats() {
  const webhook = ADMIN_CONFIG.statsWebhook;

  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      password: adminState.password,
      range: adminState.range,
    }),
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("管理密碼錯誤或沒有權限");
  }
  if (!response.ok) {
    throw new Error(`統計資料讀取失敗：${response.status}`);
  }

  const payload = await readJsonResponse(response, "統計資料讀取失敗");
  if (payload.ok === false) {
    throw new Error(payload.message || "統計資料讀取失敗");
  }
  return payload;
}

async function fetchPermissions(action = "list", data = {}) {
  const response = await fetch(ADMIN_CONFIG.permissionsWebhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      password: adminState.password,
      action,
      ...data,
    }),
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("管理密碼錯誤或沒有權限");
  }
  if (!response.ok) {
    throw new Error(`人員權限讀取失敗：${response.status}`);
  }

  const payload = await readJsonResponse(response, "人員權限處理失敗");
  if (payload.ok === false) {
    throw new Error(payload.message || "人員權限處理失敗");
  }
  return payload;
}

async function submitMasterImport(mode, file, category) {
  const form = new FormData();
  form.append("password", adminState.password);
  form.append("mode", mode);
  form.append("category", category);
  form.append("file", file);

  const response = await fetch(ADMIN_CONFIG.masterImportWebhook, {
    method: "POST",
    body: form,
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("管理密碼錯誤或沒有權限");
  }
  if (!response.ok) {
    throw new Error(`主檔匯入失敗：${response.status}`);
  }

  const payload = await readJsonResponse(response, "主檔匯入失敗");
  if (payload.ok === false) {
    throw new Error(payload.message || "主檔匯入失敗");
  }
  return payload;
}

function normalizeStats(payload) {
  const summary = payload.summary || payload;
  const totalItems = toNumber(summary.total_items ?? summary.totalItems);
  const passedItems = toNumber(summary.passed_items ?? summary.passedItems);
  const abnormalItems = toNumber(summary.abnormal_items ?? summary.abnormalItems);
  const accuracyRate = summary.accuracy_rate ?? summary.accuracyRate ??
    (totalItems ? passedItems / totalItems : 0);

  return {
    summary: {
      accuracyRate,
      totalItems,
      passedItems,
      abnormalItems,
      totalBatches: toNumber(summary.total_batches ?? summary.totalBatches),
      todayBatches: toNumber(summary.today_batches ?? summary.todayBatches),
    },
    operators: payload.operators || payload.operator_stats || [],
    recent: payload.recent || payload.recent_batches || [],
  };
}

function renderDashboard(payload) {
  const data = normalizeStats(payload);
  const summary = data.summary;

  adminEls.accuracyRate.textContent = formatPercent(summary.accuracyRate);
  adminEls.totalItems.textContent = String(summary.totalItems);
  adminEls.passedItems.textContent = String(summary.passedItems);
  adminEls.abnormalItems.textContent = String(summary.abnormalItems);
  adminEls.totalBatches.textContent = String(summary.totalBatches);
  adminEls.todayBatches.textContent = String(summary.todayBatches);

  if (!data.operators.length) {
    adminEls.operatorList.innerHTML = '<p class="result-note">尚無人員統計資料</p>';
  } else {
    adminEls.operatorList.innerHTML = data.operators.map((operator) => {
      const total = toNumber(operator.total ?? operator.total_items);
      const passed = toNumber(operator.passed ?? operator.passed_items);
      const abnormal = toNumber(operator.abnormal ?? operator.abnormal_items);
      const accuracy = operator.accuracy ?? operator.accuracy_rate ?? (total ? passed / total : 0);
      return `
        <article class="operator-card">
          <div>
            <strong>${escapeHtml(operator.name || operator.operator || "未命名")}</strong>
            <span>${escapeHtml(operator.userId || operator.user_id || "")}</span>
          </div>
          <div class="operator-stats">
            <span>總數 ${total}</span>
            <span>通過 ${passed}</span>
            <span>異常 ${abnormal}</span>
            <strong>${formatPercent(accuracy)}</strong>
          </div>
        </article>
      `;
    }).join("");
  }

  if (!data.recent.length) {
    adminEls.recentBody.innerHTML = '<tr class="empty-row"><td colspan="8">尚無近期批次</td></tr>';
  } else {
    adminEls.recentBody.innerHTML = data.recent.map((batch) => {
      const total = toNumber(batch.total ?? batch.total_items);
      const passed = toNumber(batch.passed ?? batch.passed_items);
      const abnormal = toNumber(batch.abnormal ?? batch.abnormal_items);
      const accuracy = batch.accuracy ?? batch.accuracy_rate ?? (total ? passed / total : 0);
      return `
        <tr>
          <td>${escapeHtml(batch.time || batch.created_at || "")}</td>
          <td>${escapeHtml(batch.batchId || batch.batch_id || "")}</td>
          <td>${escapeHtml(batch.operator || batch.operator_name || "")}</td>
          <td>${escapeHtml(batch.orderNo || batch.order_no || "")}</td>
          <td>${total}</td>
          <td>${passed}</td>
          <td>${abnormal}</td>
          <td>${formatPercent(accuracy)}</td>
        </tr>
      `;
    }).join("");
  }
}

function renderPermissions(operators) {
  adminState.permissions = operators || [];

  if (!adminState.permissions.length) {
    adminEls.permissionList.innerHTML = "";
    adminEls.permissionMessage.textContent = "尚無人員權限資料";
    return;
  }

  adminEls.permissionMessage.textContent = "";
  adminEls.permissionList.innerHTML = adminState.permissions.map((operator) => {
    const features = featureList(operator.features || operator["可使用功能"]);
    const ocrEnabled = features.includes("OCR補料單");
    const pageId = escapeHtml(operator.pageId || operator.id || "");
    const status = operator.status || "待審核";
    return `
      <article class="permission-card" data-page-id="${pageId}">
        <div class="permission-person">
          <strong>${escapeHtml(operator.name || "未命名")}</strong>
          <span>${escapeHtml(operator.userId || "")}</span>
          <small>${escapeHtml(operator.displayName || "")}</small>
        </div>
        <label>
          狀態
          <select class="permission-status">
            <option value="待審核" ${status === "待審核" ? "selected" : ""}>待審核</option>
            <option value="已開通" ${status === "已開通" ? "selected" : ""}>已開通</option>
            <option value="停用" ${status === "停用" ? "selected" : ""}>停用</option>
          </select>
        </label>
        <label class="permission-toggle">
          <input class="permission-ocr" type="checkbox" ${ocrEnabled ? "checked" : ""}>
          <span>OCR補料單</span>
        </label>
        <button class="primary-btn permission-save-btn" type="button">儲存</button>
      </article>
    `;
  }).join("");
}

function renderImportMetric(label, value, tone = "") {
  return `
    <div class="metric ${tone}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function normalizeImportRows(payload) {
  return payload.rows || payload.items || payload.results || payload.errors || [];
}

function renderMasterImportResult(payload) {
  adminState.masterImportResult = payload;
  const summary = payload.summary || payload;
  const total = toNumber(summary.total ?? summary.total_rows ?? summary.totalRows);
  const valid = toNumber(summary.valid ?? summary.valid_rows ?? summary.validRows);
  const created = toNumber(summary.created);
  const updated = toNumber(summary.updated);
  const skipped = toNumber(summary.skipped);
  const failed = toNumber(summary.failed ?? summary.errors);
  const mode = payload.mode || adminEls.masterModeInput.value;

  adminEls.masterImportResultPanel.classList.remove("hidden");
  adminEls.masterImportSummary.innerHTML = [
    renderImportMetric("模式", mode === "import" ? "正式匯入" : "預覽檢查"),
    renderImportMetric("總筆數", total),
    renderImportMetric("有效筆數", valid),
    renderImportMetric("新增", created, "ok"),
    renderImportMetric("更新", updated),
    renderImportMetric("略過", skipped),
    renderImportMetric("失敗", failed, failed ? "danger" : ""),
  ].join("");

  const rows = normalizeImportRows(payload);
  if (!rows.length) {
    adminEls.masterImportBody.innerHTML = '<tr class="empty-row"><td colspan="5">沒有明細結果</td></tr>';
    return;
  }

  adminEls.masterImportBody.innerHTML = rows.slice(0, 100).map((row) => {
    const status = row.status || row.result || (row.ok === false ? "失敗" : "OK");
    const action = row.action || row.operation || "";
    const message = row.message || row.note || row.error || "";
    return `
      <tr>
        <td>${escapeHtml(row.partNo || row.part_no || row["品號"] || "")}</td>
        <td>${escapeHtml(row.category || row["分類"] || row["類別名稱"] || "")}</td>
        <td>${escapeHtml(action)}</td>
        <td>${escapeHtml(status)}</td>
        <td>${escapeHtml(message)}</td>
      </tr>
    `;
  }).join("");
}

async function loadPermissions() {
  adminEls.permissionMessage.textContent = "讀取人員權限中...";
  const payload = await fetchPermissions("list");
  renderPermissions(payload.operators || []);
}

async function loadStats() {
  adminEls.loginMessage.textContent = "讀取統計資料中...";
  const payload = await fetchStats();
  adminState.data = payload;
  renderDashboard(payload);
  adminEls.loginPanel.classList.add("hidden");
  adminEls.dashboardPanel.classList.remove("hidden");
  adminEls.refreshBtn.disabled = false;
  adminEls.loginMessage.textContent = "";
  loadPermissions().catch((error) => {
    adminEls.permissionMessage.textContent = error.message;
  });
}

adminEls.loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  adminState.password = adminEls.adminPasswordInput.value;
  adminState.range = adminEls.rangeInput.value;
  loadStats().catch((error) => {
    adminEls.loginMessage.textContent = error.message;
  });
});

adminEls.refreshBtn.addEventListener("click", () => {
  adminState.range = adminEls.rangeInput.value;
  loadStats().catch((error) => {
    adminEls.loginPanel.classList.remove("hidden");
    adminEls.dashboardPanel.classList.add("hidden");
    adminEls.refreshBtn.disabled = true;
    adminEls.loginMessage.textContent = error.message;
  });
});

adminEls.statsTabBtn.addEventListener("click", () => {
  setActiveTab("stats");
});

adminEls.permissionsTabBtn.addEventListener("click", () => {
  setActiveTab("permissions");
  if (!adminState.permissions.length) {
    loadPermissions().catch((error) => {
      adminEls.permissionMessage.textContent = error.message;
    });
  }
});

adminEls.masterImportTabBtn.addEventListener("click", () => {
  setActiveTab("masterImport");
});

adminEls.permissionsRefreshBtn.addEventListener("click", () => {
  loadPermissions().catch((error) => {
    adminEls.permissionMessage.textContent = error.message;
  });
});

adminEls.masterImportForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const file = adminEls.masterFileInput.files?.[0];
  if (!file) {
    adminEls.masterImportMessage.textContent = "請先選擇主檔檔案";
    return;
  }

  const mode = adminEls.masterModeInput.value;
  const category = adminEls.masterCategoryInput.value;
  adminEls.masterImportBtn.disabled = true;
  adminEls.masterImportBtn.textContent = mode === "import" ? "匯入中" : "檢查中";
  adminEls.masterImportMessage.textContent = mode === "import" ? "正在匯入主檔..." : "正在預覽檢查主檔...";

  submitMasterImport(mode, file, category)
    .then((payload) => {
      renderMasterImportResult(payload);
      adminEls.masterImportMessage.textContent = mode === "import" ? "主檔匯入完成" : "主檔預覽完成";
    })
    .catch((error) => {
      adminEls.masterImportMessage.textContent = error.message;
    })
    .finally(() => {
      adminEls.masterImportBtn.disabled = false;
      adminEls.masterImportBtn.textContent = "送出";
    });
});

adminEls.masterImportResetBtn.addEventListener("click", () => {
  adminState.masterImportResult = null;
  adminEls.masterImportResultPanel.classList.add("hidden");
  adminEls.masterImportSummary.innerHTML = "";
  adminEls.masterImportBody.innerHTML = '<tr class="empty-row"><td colspan="5">尚未執行匯入</td></tr>';
  adminEls.masterImportMessage.textContent = "支援 CSV 與 Excel 主檔。欄位需包含品號、品名、規格，可用分類或類別名稱欄位指定分類。";
});

adminEls.permissionList.addEventListener("click", (event) => {
  const button = event.target.closest(".permission-save-btn");
  if (!button) return;

  const card = button.closest(".permission-card");
  const pageId = card.dataset.pageId;
  const status = card.querySelector(".permission-status").value;
  const ocrEnabled = card.querySelector(".permission-ocr").checked;

  button.disabled = true;
  button.textContent = "儲存中";
  fetchPermissions("update", { pageId, status, ocrEnabled })
    .then((payload) => {
      renderPermissions(payload.operators || []);
      adminEls.permissionMessage.textContent = "權限已更新";
    })
    .catch((error) => {
      adminEls.permissionMessage.textContent = error.message;
    })
    .finally(() => {
      button.disabled = false;
      button.textContent = "儲存";
    });
});

adminEls.mobileMenuBtn?.addEventListener("click", () => {
  const willOpen = adminEls.mobileMenu.classList.contains("hidden");
  adminEls.mobileMenu.classList.toggle("hidden", !willOpen);
  adminEls.mobileMenuBtn.classList.toggle("active", willOpen);
  adminEls.mobileMenuBtn.setAttribute("aria-expanded", String(willOpen));
});

adminEls.mobileMenu?.addEventListener("click", (event) => {
  if (event.target.closest("a")) {
    adminEls.mobileMenu.classList.add("hidden");
    adminEls.mobileMenuBtn.classList.remove("active");
    adminEls.mobileMenuBtn.setAttribute("aria-expanded", "false");
  }
});
