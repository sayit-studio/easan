const adminState = {
  password: "",
  range: "30",
  data: null,
};

const adminEls = {
  loginPanel: document.querySelector("#loginPanel"),
  dashboardPanel: document.querySelector("#dashboardPanel"),
  loginForm: document.querySelector("#loginForm"),
  statsWebhookInput: document.querySelector("#statsWebhookInput"),
  adminPasswordInput: document.querySelector("#adminPasswordInput"),
  rangeInput: document.querySelector("#rangeInput"),
  loginMessage: document.querySelector("#loginMessage"),
  refreshBtn: document.querySelector("#refreshBtn"),
  accuracyRate: document.querySelector("#accuracyRate"),
  totalItems: document.querySelector("#totalItems"),
  passedItems: document.querySelector("#passedItems"),
  abnormalItems: document.querySelector("#abnormalItems"),
  totalBatches: document.querySelector("#totalBatches"),
  todayBatches: document.querySelector("#todayBatches"),
  operatorList: document.querySelector("#operatorList"),
  recentBody: document.querySelector("#recentBody"),
};

function loadAdminSettings() {
  const settings = JSON.parse(localStorage.getItem("ocrAdminSettings") || "{}");
  adminEls.statsWebhookInput.value = settings.statsWebhook || "";
}

function saveAdminSettings() {
  localStorage.setItem("ocrAdminSettings", JSON.stringify({
    statsWebhook: adminEls.statsWebhookInput.value.trim(),
  }));
}

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

async function fetchStats() {
  const webhook = adminEls.statsWebhookInput.value.trim();
  if (!webhook) throw new Error("請先填入管理統計 Webhook");

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
    throw new Error(`統計 Webhook 失敗：${response.status}`);
  }

  const payload = await response.json();
  if (payload.ok === false) {
    throw new Error(payload.message || "統計資料讀取失敗");
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

async function loadStats() {
  adminEls.loginMessage.textContent = "讀取統計資料中...";
  const payload = await fetchStats();
  adminState.data = payload;
  renderDashboard(payload);
  adminEls.loginPanel.classList.add("hidden");
  adminEls.dashboardPanel.classList.remove("hidden");
  adminEls.refreshBtn.disabled = false;
  adminEls.loginMessage.textContent = "";
}

adminEls.loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  adminState.password = adminEls.adminPasswordInput.value;
  adminState.range = adminEls.rangeInput.value;
  saveAdminSettings();
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

loadAdminSettings();
