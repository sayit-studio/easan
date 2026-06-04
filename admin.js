const adminState = {
  password: "",
  range: "30",
  data: null,
  activeTab: "stats",
  permissions: [],
};

const ADMIN_CONFIG = {
  statsWebhook: "https://sayitstudio.zeabur.app/webhook/easan-admin-stats",
  permissionsWebhook: "https://sayitstudio.zeabur.app/webhook/easan-admin-permissions",
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
  statsView: document.querySelector("#statsView"),
  permissionsView: document.querySelector("#permissionsView"),
  permissionsRefreshBtn: document.querySelector("#permissionsRefreshBtn"),
  permissionMessage: document.querySelector("#permissionMessage"),
  permissionList: document.querySelector("#permissionList"),
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
  adminEls.statsView.classList.toggle("hidden", tab !== "stats");
  adminEls.permissionsView.classList.toggle("hidden", tab !== "permissions");
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

adminEls.permissionsRefreshBtn.addEventListener("click", () => {
  loadPermissions().catch((error) => {
    adminEls.permissionMessage.textContent = error.message;
  });
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
