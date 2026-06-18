const adminState = {
  password: "",
  range: "7",
  data: null,
  activeTab: "dashboard",
  permissions: [],
  masterImportResult: null,
  self: { userId: "", name: "管理員", features: [], role: "", identified: false },
  statsLoaded: false,
  permsLoaded: false,
  masterCoverage: null,
  selectedOperator: "",
  loadingCount: 0,
};

const ADMIN_CONFIG = {
  statsWebhook: "https://sayitstudio.zeabur.app/webhook/easan-admin-stats",
  permissionsWebhook: "https://sayitstudio.zeabur.app/webhook/easan-admin-permissions",
  masterImportWebhook: "https://sayitstudio.zeabur.app/webhook/easan-master-import",
  masterQueryWebhook: "https://sayitstudio.zeabur.app/webhook/easan-master-query",
  operatorPermissionWebhook: "https://sayitstudio.zeabur.app/webhook/easan-operator-permission",
  liffId: "2010295228-FaJJlXg9",
  liffEndpoint: "https://easan.pages.dev/admin.html",
};

const FEATURE_OPTIONS = ["OCR補料單", "報表查看", "權限管理"];
const ROLE_OPTIONS = ["操作員", "管理員"];

function canManagePermissions() {
  // 未取得 LIFF 身分時（例如桌機瀏覽器）以密碼為準，仍允許管理；
  // 取得身分後則必須具備「權限管理」功能。
  if (!adminState.self.identified) return true;
  return adminState.self.features.includes("權限管理");
}

const adminEls = {
  loginPanel: document.querySelector("#loginPanel"),
  dashboardPanel: document.querySelector("#dashboardPanel"),
  loginForm: document.querySelector("#loginForm"),
  adminPasswordInput: document.querySelector("#adminPasswordInput"),
  rangeInput: document.querySelector("#rangeInput"),
  loginMessage: document.querySelector("#loginMessage"),
  refreshBtn: document.querySelector("#refreshBtn"),
  rangeField: document.querySelector("#rangeField"),
  tabStats: document.querySelector("#tabStats"),
  dashTabBtn: document.querySelector("#dashTabBtn"),
  rawTabBtn: document.querySelector("#rawTabBtn"),
  masterTabBtn: document.querySelector("#masterTabBtn"),
  permissionsTabBtn: document.querySelector("#permissionsTabBtn"),
  masterImportTabBtn: document.querySelector("#masterImportTabBtn"),
  dashboardView: document.querySelector("#dashboardView"),
  rawView: document.querySelector("#rawView"),
  masterView: document.querySelector("#masterView"),
  permissionsView: document.querySelector("#permissionsView"),
  masterImportView: document.querySelector("#masterImportView"),
  operatorSelect: document.querySelector("#operatorSelect"),
  operatorDetail: document.querySelector("#operatorDetail"),
  masterQueryForm: document.querySelector("#masterQueryForm"),
  masterFilterCategory: document.querySelector("#masterFilterCategory"),
  masterQueryMessage: document.querySelector("#masterQueryMessage"),
  masterItemsBody: document.querySelector("#masterItemsBody"),
  masterCoverage: document.querySelector("#masterCoverage"),
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
  operatorList: document.querySelector("#operatorList"),
  recentBody: document.querySelector("#recentBody"),
  statsMessage: document.querySelector("#statsMessage"),
  dashboardOverview: document.querySelector("#dashboardOverview"),
  dashboardRecords: document.querySelector("#dashboardRecords"),
  detailAnalysisNote: document.querySelector("#detailAnalysisNote"),
  operatorAccuracyChart: document.querySelector("#operatorAccuracyChart"),
  validationChart: document.querySelector("#validationChart"),
  trendChart: document.querySelector("#trendChart"),
  errorTypeChart: document.querySelector("#errorTypeChart"),
  problemParts: document.querySelector("#problemParts"),
  notifyStatus: document.querySelector("#notifyStatus"),
  loadingOverlay: document.querySelector("#loadingOverlay"),
  loadingMessage: document.querySelector("#loadingMessage"),
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

function showLoading(message) {
  adminState.loadingCount += 1;
  if (adminEls.loadingMessage) {
    adminEls.loadingMessage.textContent = message || "\u8acb\u52ff\u95dc\u9589\u8996\u7a97\u6216\u96e2\u958b\u9801\u9762\u3002";
  }
  adminEls.loadingOverlay?.classList.remove("hidden");
}

function hideLoading() {
  adminState.loadingCount = Math.max(0, adminState.loadingCount - 1);
  if (adminState.loadingCount === 0) {
    adminEls.loadingOverlay?.classList.add("hidden");
  }
}

async function withLoading(message, task) {
  showLoading(message);
  try {
    return await task();
  } finally {
    hideLoading();
  }
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

const TABS = ["dashboard", "raw", "master", "masterImport", "permissions"];
const TAB_BTN = {
  dashboard: "dashTabBtn",
  raw: "rawTabBtn",
  master: "masterTabBtn",
  masterImport: "masterImportTabBtn",
  permissions: "permissionsTabBtn",
};
const TAB_VIEW = {
  dashboard: "dashboardView",
  raw: "rawView",
  master: "masterView",
  masterImport: "masterImportView",
  permissions: "permissionsView",
};

function setActiveTab(tab) {
  adminState.activeTab = tab;
  for (const t of TABS) {
    adminEls[TAB_BTN[t]].classList.toggle("active", t === tab);
    adminEls[TAB_VIEW[t]].classList.toggle("hidden", t !== tab);
  }
  renderTabStats(tab);
}

function statChip(label, value, tone) {
  return `<div class="stat-chip ${tone || ""}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function renderTabStats(tab) {
  const el = adminEls.tabStats;
  if (tab === "dashboard") {
    el.innerHTML = "";
    el.classList.add("hidden");
    return;
  }
  el.classList.remove("hidden");
  if (tab === "raw") {
    const d = adminState.data ? normalizeStats(adminState.data) : null;
    if (!d) { el.innerHTML = `<div class="stat-chip"><span>狀態</span><strong>尚未載入</strong></div>`; return; }
    const s = d.summary;
    el.innerHTML = [
      statChip("今日批次", String(s.todayBatches)),
      statChip("掃描批次", String(s.totalBatches)),
      statChip("總明細數", String(s.totalItems)),
      statChip("整體正確率", formatPercent(s.accuracyRate), "ok"),
      statChip("異常筆數", String(s.abnormalItems), "danger"),
      statChip("失敗批次", String(s.failedBatches), s.failedBatches ? "danger" : ""),
      statChip("OCR完整率", formatPercent(s.ocrCompleteRate)),
      statChip("平均秒數", `${s.avgProcessingSeconds}s`),
    ].join("");
  } else if (tab === "master") {
    const c = adminState.masterCoverage;
    if (!c) { el.innerHTML = `<div class="stat-chip"><span>品項</span><strong>查詢後顯示</strong></div>`; return; }
    el.innerHTML = [
      statChip("總品項", String(c.total || 0)),
      statChip("OMBRA", String(c["OMBRA"] || 0)),
      statChip("吹氣盒", String(c["吹氣盒"] || 0)),
      statChip("未分類", String(c["未分類"] || 0), (c["未分類"] ? "danger" : "")),
    ].join("");
  } else if (tab === "permissions") {
    const ops = adminState.permissions || [];
    if (!ops.length) { el.innerHTML = `<div class="stat-chip"><span>人員</span><strong>尚未載入</strong></div>`; return; }
    const count = (pred) => ops.filter(pred).length;
    el.innerHTML = [
      statChip("總人數", String(ops.length)),
      statChip("管理員", String(count((o) => o.role === "管理員"))),
      statChip("操作員", String(count((o) => o.role === "操作員" || !o.role))),
      statChip("待審核", String(count((o) => o.status === "待審核")), count((o) => o.status === "待審核") ? "danger" : ""),
      statChip("已開通", String(count((o) => o.status === "已開通")), "ok"),
      statChip("停用", String(count((o) => o.status === "停用"))),
    ].join("");
  } else {
    el.innerHTML = "";
  }
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
  const view = adminState.activeTab === "raw" ? "raw" : "summary";

  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      password: adminState.password,
      range: adminState.range,
      view,
      includeDetails: view === "raw",
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

async function validateAdminLogin(password) {
  const response = await fetch(ADMIN_CONFIG.permissionsWebhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      password,
      action: "auth",
    }),
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error("管理密碼錯誤或沒有權限");
  }
  if (!response.ok) {
    throw new Error(`管理密碼驗證失敗：${response.status}`);
  }

  const payload = await readJsonResponse(response, "管理密碼驗證失敗");
  if (payload.ok === false) {
    throw new Error(payload.message || "管理密碼錯誤或沒有權限");
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
  const operators = payload.operators || payload.operator_stats || [];
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
      failedBatches: toNumber(summary.failed_batches ?? summary.failedBatches),
      correctionRate: summary.correction_rate ?? summary.correctionRate ?? 0,
      ocrCompleteRate: summary.ocr_complete_rate ?? summary.ocrCompleteRate ?? 0,
      avgProcessingSeconds: toNumber(summary.avg_processing_seconds ?? summary.avgProcessingSeconds),
      activeOperators: toNumber(summary.active_operators ?? summary.activeOperators) || operators.filter((op) => toNumber(op.total) > 0).length,
    },
    operators,
    recent: payload.recent || payload.recent_batches || [],
    daily: payload.daily || [],
    errorTypes: payload.errorTypes || payload.error_types || [],
    ocrStatus: payload.ocrStatus || payload.ocr_status || [],
    problemParts: payload.problemParts || payload.problem_parts || [],
    notify: payload.notify || [],
    masterCoverage: payload.masterCoverage || payload.master_coverage || payload.categoryCounts || null,
    details: payload.details || [],
  };
}

function formatNumber(value) {
  return String(toNumber(value));
}

function buildTrendChart(daily) {
  if (!daily.length) {
    return '<p class="result-note">\u5c1a\u7121\u8da8\u52e2\u8cc7\u6599</p>';
  }

  const rows = daily.slice(-7);
  const W = 320;
  const H = 120;
  const padX = 18;
  const padTop = 14;
  const padBottom = 24;
  const plotH = H - padTop - padBottom;
  const step = rows.length > 1 ? (W - padX * 2) / (rows.length - 1) : 0;
  const maxTotal = Math.max(1, ...rows.map((d) => toNumber(d.total)));

  const points = rows.map((d, i) => {
    const x = rows.length > 1 ? padX + step * i : W / 2;
    const y = padTop + plotH - (toNumber(d.total) / maxTotal) * plotH;
    return { x, y, row: d };
  });

  const areaPath = points.length
    ? `M ${points.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ')} L ${points[points.length - 1].x.toFixed(1)} ${(H - padBottom).toFixed(1)} L ${points[0].x.toFixed(1)} ${(H - padBottom).toFixed(1)} Z`
    : '';
  const linePoints = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const dots = points.map((p) => `
    <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" class="trend-dot">
      <title>${escapeHtml(p.row.date)}: ${toNumber(p.row.total)} \u7b46, \u6b63\u78ba\u7387 ${formatPercent(p.row.accuracy)}</title>
    </circle>
  `).join('');
  const labels = points.map((p, i) => {
    if (rows.length > 4 && i % 2 !== 0 && i !== rows.length - 1) return '';
    return `<text x="${p.x.toFixed(1)}" y="${H - 7}" class="trend-label" text-anchor="middle">${escapeHtml(String(p.row.date).slice(5))}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" class="trend-svg compact-trend-svg" role="img" aria-label="\u6bcf\u65e5\u8da8\u52e2\u5716"><path d="${areaPath}" class="trend-area"></path><polyline points="${linePoints}" class="trend-line" fill="none"></polyline>${dots}${labels}</svg>`;
}

function buildValidationChart(daily) {
  const rows = (daily || []).slice(-7);
  if (!rows.length) {
    return '<p class="result-note">\u5c1a\u7121\u9a57\u8b49\u6b21\u6578\u8cc7\u6599</p>';
  }
  const max = Math.max(1, ...rows.map((d) => toNumber(d.batches)));
  return `
    <div class="mini-bar-chart">
      ${rows.map((d) => {
        const count = toNumber(d.batches);
        const height = Math.max(6, (count / max) * 100);
        return `
          <div class="mini-bar-item">
            <span class="mini-bar-value">${count}</span>
            <span class="mini-bar-track"><span class="mini-bar-fill" style="height:${height.toFixed(1)}%"></span></span>
            <span class="mini-bar-label">${escapeHtml(String(d.date || "").slice(5))}</span>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function buildOperatorAccuracyChart(operators) {
  const totalWork = Math.max(1, (operators || []).reduce((sum, op) => sum + toNumber(op.total), 0));
  const rows = (operators || [])
    .map((op) => {
      const total = toNumber(op.total);
      const passed = toNumber(op.passed);
      const abnormal = toNumber(op.abnormal);
      const accuracy = op.accuracy ?? (total ? toNumber(op.passed) / total : 0);
      const avgSeconds = toNumber(op.avgProcessingSeconds ?? op.avg_processing_seconds);
      return {
        name: opDisplay(op),
        total,
        passed,
        abnormal,
        accuracy: toNumber(accuracy),
        workload: total / totalWork,
        avgSeconds,
      };
    })
    .filter((op) => op.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  if (!rows.length) {
    return '<p class="result-note">\u5c1a\u7121\u4eba\u54e1\u6b63\u78ba\u7387\u8cc7\u6599</p>';
  }

  return rows.map((op) => {
    const accuracyPct = op.accuracy <= 1 ? op.accuracy * 100 : op.accuracy;
    const workloadPct = op.workload * 100;
    return `
      <div class="efficiency-row">
        <div class="efficiency-title">
          <strong>${escapeHtml(op.name)}</strong>
          <span>${op.total} \u7b46</span>
        </div>
        <div class="efficiency-bars">
          <span>\u5de5\u4f5c\u7387</span>
          <div class="efficiency-track"><span class="efficiency-fill workload" style="width:${Math.max(0, Math.min(100, workloadPct)).toFixed(1)}%"></span></div>
          <strong>${formatPercent(op.workload)}</strong>
          <span>\u6210\u529f\u7387</span>
          <div class="efficiency-track"><span class="efficiency-fill success" style="width:${Math.max(0, Math.min(100, accuracyPct)).toFixed(1)}%"></span></div>
          <strong>${formatPercent(op.accuracy)}</strong>
        </div>
        <div class="efficiency-meta">
          <span>\u901a\u904e ${op.passed}</span>
          <span>\u7570\u5e38 ${op.abnormal}</span>
          <span>${op.avgSeconds ? `\u5e73\u5747 ${op.avgSeconds}s` : "\u672a\u8a18\u9304\u79d2\u6578"}</span>
        </div>
      </div>
    `;
  }).join("");
}

function buildBarList(items, tone) {
  if (!items.length) {
    return '<p class="result-note">尚無資料</p>';
  }
  const max = Math.max(1, ...items.map((it) => toNumber(it.count)));
  return items.map((it) => {
    const pct = (toNumber(it.count) / max) * 100;
    return `
      <div class="bar-row">
        <span class="bar-label">${escapeHtml(it.name)}</span>
        <span class="bar-track"><span class="bar-fill ${tone || ""}" style="width:${pct.toFixed(1)}%"></span></span>
        <span class="bar-value">${toNumber(it.count)}</span>
      </div>
    `;
  }).join("");
}

function buildProblemParts(parts) {
  if (!parts.length) {
    return '<p class="result-note">近期無異常品號</p>';
  }
  return parts.map((p, i) => `
    <div class="problem-row">
      <span class="problem-rank">${i + 1}</span>
      <div class="problem-info">
        <strong>${escapeHtml(p.partNo)}</strong>
        <small>${escapeHtml((p.reasons || []).join("、"))}</small>
      </div>
      <span class="problem-count">${toNumber(p.count)} 次</span>
    </div>
  `).join("");
}

function buildNotify(notify) {
  if (!notify.length) {
    return '<p class="result-note">尚無通知紀錄</p>';
  }
  const toneOf = (name) => {
    if (name.includes("失敗")) return "danger";
    if (name.includes("已通知")) return "ok";
    return "";
  };
  return notify.map((n) => `
    <div class="metric ${toneOf(n.name)}">
      <span>${escapeHtml(n.name)}</span>
      <strong>${toNumber(n.count)}</strong>
    </div>
  `).join("");
}

function renderDashboardOverview(summary) {
  const cards = [
    { label: "\u4eca\u65e5\u6279\u6b21", value: summary.todayBatches },
    { label: "\u7e3d\u7b46\u6578", value: summary.totalItems },
    { label: "\u7570\u5e38\u7b46\u6578", value: summary.abnormalItems, tone: "danger" },
    { label: "\u6b63\u78ba\u7387", value: formatPercent(summary.accuracyRate), tone: "ok" },
    { label: "\u5e73\u5747\u79d2\u6578", value: `${summary.avgProcessingSeconds}s` },
    { label: "\u6d3b\u8e8d\u4eba\u54e1", value: summary.activeOperators || 0 },
  ];

  adminEls.dashboardOverview.innerHTML = cards.map((card) => `
    <div class="metric ${card.tone || ""}">
      <span>${escapeHtml(card.label)}</span>
      <strong>${escapeHtml(card.value)}</strong>
    </div>
  `).join("");
}

function renderDashboardRecords(records) {
  if (!records.length) {
    if (!adminEls.dashboardRecords) return;
    adminEls.dashboardRecords.innerHTML = '<p class="result-note">\u5c1a\u7121\u6700\u8fd1\u6279\u6b21\u7d00\u9304</p>';
    return;
  }

  if (!adminEls.dashboardRecords) return;
  adminEls.dashboardRecords.innerHTML = records.slice(0, 20).map((batch) => {
    const total = toNumber(batch.total);
    const passed = toNumber(batch.passed);
    const abnormal = toNumber(batch.abnormal);
    const accuracy = batch.accuracy ?? (total ? passed / total : 0);
    const statusTone = abnormal ? "danger" : "ok";
    return `
      <article class="dashboard-record">
        <div>
          <strong>${escapeHtml(batch.batchId || "\u672a\u547d\u540d\u6279\u6b21")}</strong>
          <span>${escapeHtml(formatTime(batch.time || ""))}</span>
        </div>
        <div class="dashboard-record-metrics">
          <span>\u7e3d ${total}</span>
          <span>\u901a\u904e ${passed}</span>
          <span class="${statusTone}">\u7570\u5e38 ${abnormal}</span>
          <strong>${formatPercent(accuracy)}</strong>
        </div>
      </article>
    `;
  }).join("");
}

function renderDashboard(payload) {
  const data = normalizeStats(payload);

  if (data.masterCoverage) {
    adminState.masterCoverage = data.masterCoverage;
  }

  renderDashboardOverview(data.summary);
  adminEls.trendChart.innerHTML = buildTrendChart(data.daily);
  if (adminEls.operatorAccuracyChart) adminEls.operatorAccuracyChart.innerHTML = buildOperatorAccuracyChart(data.operators);
  if (adminEls.validationChart) adminEls.validationChart.innerHTML = buildValidationChart(data.daily);
  if (adminEls.errorTypeChart) adminEls.errorTypeChart.innerHTML = buildBarList(data.errorTypes, "danger");
  if (adminEls.problemParts) adminEls.problemParts.innerHTML = buildProblemParts(data.problemParts);
  adminEls.notifyStatus.innerHTML = buildNotify(data.notify);
  renderMasterCoverage();
  renderTabStats(adminState.activeTab);
}

function renderRawData(payload) {
  const data = normalizeStats(payload);

  adminState.detailsByBatch = new Map();
  for (const row of data.details) {
    const key = String(row.batchId || "");
    if (!key) continue;
    if (!adminState.detailsByBatch.has(key)) adminState.detailsByBatch.set(key, []);
    adminState.detailsByBatch.get(key).push(row);
  }

  renderOperators(data);
  renderRecent(data);
  renderTabStats(adminState.activeTab);
}

function renderMasterCoverage() {
  const c = adminState.masterCoverage;
  if (!c) {
    adminEls.masterCoverage.innerHTML = '<p class="result-note">載入中…</p>';
    return;
  }
  const items = [
    { name: "總品項", count: c.total || 0, tone: "" },
    { name: "OMBRA", count: c["OMBRA"] || 0, tone: "" },
    { name: "吹氣盒", count: c["吹氣盒"] || 0, tone: "" },
    { name: "未分類", count: c["未分類"] || 0, tone: c["未分類"] ? "danger" : "" },
  ];
  adminEls.masterCoverage.innerHTML = items.map((it) =>
    `<div class="metric ${it.tone}"><span>${escapeHtml(it.name)}</span><strong>${toNumber(it.count)}</strong></div>`
  ).join("");
}

function operatorKey(operator) {
  return operator.userId || operator.name || "";
}

function opDisplay(operator) {
  return operator.nickname || operator.name || "未命名";
}

function renderOperators(data) {
  const ops = data.operators || [];
  const current = adminState.selectedOperator;
  adminEls.operatorSelect.innerHTML = '<option value="">全部人員</option>' +
    ops.map((o) => `<option value="${escapeHtml(operatorKey(o))}" ${operatorKey(o) === current ? "selected" : ""}>${escapeHtml(opDisplay(o))}</option>`).join("");

  if (!ops.length) {
    adminEls.operatorList.innerHTML = '<p class="result-note">尚無人員統計資料</p>';
    adminEls.operatorDetail.innerHTML = "";
    return;
  }

  adminEls.operatorList.innerHTML = ops.map((operator) => {
    const total = toNumber(operator.total);
    const passed = toNumber(operator.passed);
    const abnormal = toNumber(operator.abnormal);
    const accuracy = operator.accuracy ?? (total ? passed / total : 0);
    const selected = operatorKey(operator) === current ? " selected" : "";
    return `
      <article class="operator-card${selected}" data-op="${escapeHtml(operatorKey(operator))}" tabindex="0">
        <div>
          <strong>${escapeHtml(opDisplay(operator))}</strong>
          <span>${escapeHtml(operator.userId || "")}</span>
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

  renderOperatorDetail(data);
}

function renderOperatorDetail(data) {
  const key = adminState.selectedOperator;
  if (!key) {
    adminEls.operatorDetail.innerHTML = "";
    return;
  }
  const op = (data.operators || []).find((o) => operatorKey(o) === key);
  if (!op) {
    adminEls.operatorDetail.innerHTML = "";
    return;
  }
  const batches = (data.recent || []).filter((b) => (b.operator || "") === op.name);
  adminEls.operatorDetail.innerHTML = `
    <div class="operator-detail-card">
      <strong>${escapeHtml(opDisplay(op))} 的成效</strong>
      <div class="operator-stats">
        <span>總筆數 ${toNumber(op.total)}</span>
        <span>通過 ${toNumber(op.passed)}</span>
        <span>異常 ${toNumber(op.abnormal)}</span>
        <span>正確率 ${formatPercent(op.accuracy ?? 0)}</span>
        <span>人工修正率 ${formatPercent(op.correctionRate ?? 0)}</span>
        <span>近期批次 ${batches.length}</span>
      </div>
      <p class="result-note">下方「近期批次」已篩選為此人，可點開看明細。</p>
    </div>
  `;
}

function renderRecent(data) {
  let recent = data.recent || [];
  const key = adminState.selectedOperator;
  if (key) {
    const op = (data.operators || []).find((o) => operatorKey(o) === key);
    const name = op ? op.name : key;
    recent = recent.filter((b) => (b.operator || "") === name);
  }
  if (!recent.length) {
    adminEls.recentBody.innerHTML = '<tr class="empty-row"><td colspan="9">尚無近期批次</td></tr>';
    return;
  }
  adminEls.recentBody.innerHTML = recent.map((batch) => {
    const total = toNumber(batch.total);
    const passed = toNumber(batch.passed);
    const abnormal = toNumber(batch.abnormal);
    const accuracy = batch.accuracy ?? (total ? passed / total : 0);
    const batchId = batch.batchId || "";
    const notify = batch.notifyStatus || "";
    const time = formatTime(batch.time || "");
    return `
      <tr class="batch-row" data-batch-id="${escapeHtml(batchId)}" tabindex="0">
        <td>${escapeHtml(time)}</td>
        <td><span class="batch-toggle">▸</span>${escapeHtml(batchId)}</td>
        <td>${escapeHtml(batch.operatorNick || batch.operator || "")}</td>
        <td>${escapeHtml(batch.orderNo || "")}</td>
        <td>${total}</td>
        <td>${passed}</td>
        <td>${abnormal}</td>
        <td>${formatPercent(accuracy)}</td>
        <td>${escapeHtml(notify) || "—"}</td>
      </tr>
    `;
  }).join("");
}

function reRenderOperatorViews() {
  if (!adminState.data) return;
  const data = normalizeStats(adminState.data);
  renderOperators(data);
  renderRecent(data);
}

function formatTime(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const time = new Date(raw);
  if (Number.isNaN(time.getTime())) return raw;
  const pad = (n) => String(n).padStart(2, "0");
  return `${time.getFullYear()}-${pad(time.getMonth() + 1)}-${pad(time.getDate())} ${pad(time.getHours())}:${pad(time.getMinutes())}`;
}

function buildBatchDetailRow(batchId) {
  const rows = (adminState.detailsByBatch && adminState.detailsByBatch.get(String(batchId))) || [];
  if (!rows.length) {
    return `<tr class="batch-detail-row"><td colspan="9"><p class="result-note">此批次明細未載入（可能超出統計範圍上限）</p></td></tr>`;
  }
  const body = rows.map((r) => {
    const ok = r.status === "OK";
    const types = (r.errorTypes || []).join("、");
    return `
      <tr>
        <td><span class="state ${ok ? "ok" : "bad"}">${escapeHtml(r.status || "")}</span></td>
        <td>${escapeHtml(r.partNo || "（空）")}</td>
        <td><span class="cell-text">${escapeHtml(r.spec || "")}</span></td>
        <td>${escapeHtml(r.ocrStatus || "")}</td>
        <td>${escapeHtml(types)}</td>
        <td><span class="cell-text">${escapeHtml(r.note || "")}</span></td>
      </tr>
    `;
  }).join("");
  return `
    <tr class="batch-detail-row">
      <td colspan="9">
        <table class="batch-detail-table">
          <thead><tr><th>狀態</th><th>品號</th><th>規格</th><th>OCR</th><th>錯誤類型</th><th>備註</th></tr></thead>
          <tbody>${body}</tbody>
        </table>
      </td>
    </tr>
  `;
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
    const pageId = escapeHtml(operator.pageId || operator.id || "");
    const status = operator.status || "待審核";
    const role = operator.role || "操作員";
    const featureBoxes = FEATURE_OPTIONS.map((feature) => `
          <label class="permission-toggle">
            <input class="permission-feature" type="checkbox" value="${escapeHtml(feature)}" ${features.includes(feature) ? "checked" : ""}>
            <span>${escapeHtml(feature)}</span>
          </label>
        `).join("");
    const approveInfo = operator.approvedAt
      ? `開通：${escapeHtml(formatTime(operator.approvedAt))}${operator.approvedBy ? "（" + escapeHtml(operator.approvedBy) + "）" : ""}`
      : (operator.firstSeen ? `首次進入：${escapeHtml(formatTime(operator.firstSeen))}` : "");
    return `
      <article class="permission-card" data-page-id="${pageId}">
        <div class="permission-person">
          <strong>${escapeHtml(operator.name || "未命名")}</strong>
          <span class="state ${status === "已開通" ? "ok" : (status === "停用" ? "bad" : "")}">${escapeHtml(status)}</span>
          <input class="permission-nick" type="text" placeholder="設定暱稱（統計顯示用）" value="${escapeHtml(operator.nickname || "")}">
          <span>${escapeHtml(operator.userId || "")}</span>
          <small>${escapeHtml(operator.displayName || "")}</small>
          ${approveInfo ? `<small class="muted">${approveInfo}</small>` : ""}
        </div>
        <label>
          狀態
          <select class="permission-status">
            <option value="待審核" ${status === "待審核" ? "selected" : ""}>待審核</option>
            <option value="已開通" ${status === "已開通" ? "selected" : ""}>已開通</option>
            <option value="停用" ${status === "停用" ? "selected" : ""}>停用</option>
          </select>
        </label>
        <label>
          角色
          <select class="permission-role">
            ${ROLE_OPTIONS.map((r) => `<option value="${r}" ${role === r ? "selected" : ""}>${r}</option>`).join("")}
          </select>
        </label>
        <div class="permission-features">${featureBoxes}</div>
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
  const payload = await withLoading("讀取人員權限中，請勿關閉視窗。", () => fetchPermissions("list"));
  renderPermissions(payload.operators || []);
}

function applyPermissionGate() {
  const allowed = canManagePermissions();
  adminEls.permissionsTabBtn.classList.toggle("hidden", !allowed);
  if (!allowed && adminState.activeTab === "permissions") {
    setActiveTab("dashboard");
  }
}

async function initAdminIdentity() {
  if (!window.liff) {
    adminState.self = { userId: "", name: "管理員", features: [], role: "", identified: false };
    return;
  }
  try {
    await window.liff.init({ liffId: ADMIN_CONFIG.liffId });
    if (!window.liff.isLoggedIn()) return;
    const profile = await window.liff.getProfile();
    const response = await fetch(ADMIN_CONFIG.operatorPermissionWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: profile.userId, displayName: profile.displayName }),
    });
    const payload = await response.json().catch(() => ({}));
    adminState.self = {
      userId: profile.userId || "",
      name: payload.name || profile.displayName || "管理員",
      features: Array.isArray(payload.features) ? payload.features : [],
      role: payload.role || "",
      identified: true,
    };
  } catch (error) {
    adminState.self = { userId: "", name: "管理員", features: [], role: "", identified: false };
  }
  applyPermissionGate();
}

async function loadStats() {
  adminEls.statsMessage.textContent = "讀取統計資料中...";
  const payload = await withLoading("讀取統計資料中，請勿關閉視窗。", fetchStats);
  adminState.data = payload;
  adminState.statsLoaded = true;
  renderDashboard(payload);
  if (adminState.activeTab === "raw") {
    renderRawData(payload);
  }
  adminEls.statsMessage.textContent = `已更新（範圍：${rangeLabel(adminState.range)}）`;
}

function loadStatsSafe() {
  loadStats().catch((error) => {
    adminState.statsLoaded = false;
    adminEls.statsMessage.textContent = error.message;
    if (/密碼|權限|401|403/.test(error.message)) backToLogin(error.message);
  });
}

function loadPermissionsSafe() {
  if (!canManagePermissions()) return;
  adminState.permsLoaded = true;
  loadPermissions().catch((error) => {
    adminState.permsLoaded = false;
    adminEls.permissionMessage.textContent = error.message;
    if (/密碼|權限|403/.test(error.message)) backToLogin(error.message);
  });
}

async function masterQueryRequest(payload) {
  const response = await fetch(ADMIN_CONFIG.masterQueryWebhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: adminState.password, ...payload }),
  });
  if (response.status === 401 || response.status === 403) throw new Error("管理密碼錯誤或沒有權限");
  if (!response.ok) throw new Error(`品項查詢失敗：${response.status}`);
  const data = await readJsonResponse(response, "品項查詢失敗");
  if (data.ok === false) throw new Error(data.message || "品項查詢失敗");
  return data;
}

async function loadMasterCoverage() {
  const payload = await masterQueryRequest({ action: "query", category: "" });
  adminState.masterCoverage = payload.categoryCounts || null;
  renderMasterCoverage();
  renderTabStats(adminState.activeTab);
}

function loadMasterCoverageSafe() {
  loadMasterCoverage().catch(() => {});
}

const MASTER_CATEGORIES = ["OMBRA", "吹氣盒", "未分類"];
const MASTER_STATUSES = ["啟用", "停用"];

function renderMasterItems(payload, category) {
  const items = payload.items || [];
  adminState.masterCoverage = payload.categoryCounts || adminState.masterCoverage;
  renderTabStats("master");
  adminEls.masterQueryMessage.textContent = `共 ${toNumber(payload.filteredCount)} 筆${category ? `（${category}）` : "（全部）"}${payload.filteredCount > items.length ? `，顯示前 ${items.length} 筆` : ""}`;
  if (!items.length) {
    adminEls.masterItemsBody.innerHTML = '<tr class="empty-row"><td colspan="6">查無品項</td></tr>';
    return;
  }
  adminEls.masterItemsBody.innerHTML = items.map((it) => {
    const cat = it.category || "未分類";
    const status = it.status || "啟用";
    const catSel = MASTER_CATEGORIES.map((c) => `<option value="${c}" ${c === cat ? "selected" : ""}>${c}</option>`).join("");
    const stSel = MASTER_STATUSES.map((s) => `<option value="${s}" ${s === status ? "selected" : ""}>${s}</option>`).join("");
    return `
      <tr data-page-id="${escapeHtml(it.pageId)}">
        <td>${escapeHtml(it.partNo)}</td>
        <td>${escapeHtml(it.name || "")}</td>
        <td><span class="cell-text">${escapeHtml(it.spec || "")}</span></td>
        <td><select class="master-cat">${catSel}</select></td>
        <td><select class="master-status">${stSel}</select></td>
        <td><button class="ghost-btn master-save-btn" type="button">儲存</button></td>
      </tr>
    `;
  }).join("");
}

function queryMaster() {
  const category = adminEls.masterFilterCategory.value;
  adminEls.masterQueryMessage.textContent = "查詢中…";
  withLoading("查詢品項主檔中，請勿關閉視窗。", () => masterQueryRequest({ action: "query", category }))
    .then((payload) => renderMasterItems(payload, category))
    .catch((error) => {
      adminEls.masterQueryMessage.textContent = error.message;
      if (/密碼|權限|403/.test(error.message)) backToLogin(error.message);
    });
}

function rangeLabel(range) {
  if (range === "7") return "近 7 天";
  if (range === "all") return "全部";
  return "近 30 天";
}

function backToLogin(message) {
  adminEls.loginPanel.classList.remove("hidden");
  adminEls.dashboardPanel.classList.add("hidden");
  adminEls.rangeField.classList.add("hidden");
  adminEls.refreshBtn.disabled = true;
  adminEls.loginMessage.textContent = message || "";
}

function enterDashboard() {
  adminState.password = adminEls.adminPasswordInput.value;
  adminState.range = adminEls.rangeInput.value;
  adminState.data = null;
  adminState.statsLoaded = false;
  adminState.permsLoaded = false;
  adminState.permissions = [];
  adminEls.loginPanel.classList.add("hidden");
  adminEls.dashboardPanel.classList.remove("hidden");
  adminEls.rangeField.classList.remove("hidden");
  adminEls.refreshBtn.disabled = false;
  adminEls.loginMessage.textContent = "";
  adminState.masterCoverage = null;
  adminState.selectedOperator = "";
  adminEls.statsMessage.textContent = "尚未載入，請先選擇範圍再按「載入資料」。";
  adminEls.dashboardOverview.innerHTML = '<p class="result-note">\u8acb\u9078\u64c7\u7bc4\u570d\u5f8c\u6309\u91cd\u65b0\u8f09\u5165</p>';
  if (adminEls.dashboardRecords) adminEls.dashboardRecords.innerHTML = '<p class="result-note">\u8acb\u9078\u64c7\u7bc4\u570d\u5f8c\u6309\u91cd\u65b0\u8f09\u5165</p>';
  adminEls.trendChart.innerHTML = '<p class="result-note">請選擇範圍後按重新載入</p>';
  if (adminEls.operatorAccuracyChart) adminEls.operatorAccuracyChart.innerHTML = '<p class="result-note">\u8acb\u9078\u64c7\u7bc4\u570d\u5f8c\u6309\u91cd\u65b0\u8f09\u5165</p>';
  if (adminEls.validationChart) adminEls.validationChart.innerHTML = '<p class="result-note">\u8acb\u9078\u64c7\u7bc4\u570d\u5f8c\u6309\u91cd\u65b0\u8f09\u5165</p>';
  if (adminEls.errorTypeChart) adminEls.errorTypeChart.innerHTML = '<p class="result-note">請選擇範圍後按重新載入</p>';
  if (adminEls.problemParts) adminEls.problemParts.innerHTML = '<p class="result-note">請選擇範圍後按重新載入</p>';
  adminEls.notifyStatus.innerHTML = '<p class="result-note">請選擇範圍後按重新載入</p>';
  adminEls.masterCoverage.innerHTML = '<p class="result-note">請選擇範圍後按重新載入</p>';
  adminEls.operatorSelect.innerHTML = '<option value="">全部人員</option>';
  adminEls.operatorList.innerHTML = '<p class="result-note">請選擇範圍後按重新載入</p>';
  adminEls.operatorDetail.innerHTML = "";
  adminEls.recentBody.innerHTML = '<tr class="empty-row"><td colspan="9">請選擇範圍後按重新載入</td></tr>';
  applyPermissionGate();
  setActiveTab("dashboard");
}

function openDashboard() {
  setActiveTab("dashboard");
}

adminEls.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = adminEls.adminPasswordInput.value;
  const submitBtn = adminEls.loginForm.querySelector('button[type="submit"]');
  adminEls.loginMessage.textContent = "驗證管理密碼中…";
  if (submitBtn) submitBtn.disabled = true;

  try {
    await withLoading("驗證管理密碼中，請勿關閉視窗。", () => validateAdminLogin(password));
    enterDashboard();
  } catch (error) {
    adminEls.loginMessage.textContent = error.message;
    adminEls.dashboardPanel.classList.add("hidden");
    adminEls.loginPanel.classList.remove("hidden");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
});

adminEls.refreshBtn.addEventListener("click", () => {
  adminState.range = adminEls.rangeInput.value;
  const tab = adminState.activeTab;
  if (tab === "permissions") {
    loadPermissionsSafe();
  } else if (tab === "master") {
    queryMaster();
  } else {
    adminState.statsLoaded = false;
    loadStatsSafe();
  }
});

adminEls.rangeInput.addEventListener("change", () => {
  adminState.range = adminEls.rangeInput.value;
  if (adminState.activeTab === "dashboard" || adminState.activeTab === "raw") {
    adminState.statsLoaded = false;
    adminEls.statsMessage.textContent = "日期範圍已變更，請按重新載入";
  }
});

adminEls.dashTabBtn.addEventListener("click", openDashboard);

adminEls.rawTabBtn.addEventListener("click", () => {
  setActiveTab("raw");
});

adminEls.masterTabBtn.addEventListener("click", () => {
  setActiveTab("master");
});

adminEls.permissionsTabBtn.addEventListener("click", () => {
  setActiveTab("permissions");
});

adminEls.masterImportTabBtn.addEventListener("click", () => {
  setActiveTab("masterImport");
});

adminEls.operatorSelect.addEventListener("change", () => {
  adminState.selectedOperator = adminEls.operatorSelect.value;
  reRenderOperatorViews();
});

adminEls.operatorList.addEventListener("click", (event) => {
  const card = event.target.closest(".operator-card");
  if (!card) return;
  const key = card.dataset.op || "";
  adminState.selectedOperator = adminState.selectedOperator === key ? "" : key;
  reRenderOperatorViews();
});

adminEls.masterQueryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  queryMaster();
});

adminEls.masterItemsBody.addEventListener("click", (event) => {
  const button = event.target.closest(".master-save-btn");
  if (!button) return;
  const row = button.closest("tr");
  const pageId = row.dataset.pageId;
  const newCategory = row.querySelector(".master-cat").value;
  const newStatus = row.querySelector(".master-status").value;
  button.disabled = true;
  button.textContent = "儲存中";
  withLoading("儲存品項設定中，請勿關閉視窗。", () => masterQueryRequest({ action: "update", pageId, newCategory, newStatus }))
    .then((payload) => {
      renderMasterItems(payload, adminEls.masterFilterCategory.value);
      adminEls.masterQueryMessage.textContent = "已更新分類/狀態";
    })
    .catch((error) => {
      adminEls.masterQueryMessage.textContent = error.message;
    })
    .finally(() => {
      button.disabled = false;
      button.textContent = "儲存";
    });
});

adminEls.permissionsRefreshBtn.addEventListener("click", () => {
  loadPermissions().catch((error) => {
    adminEls.permissionMessage.textContent = error.message;
    if (/密碼|權限|403/.test(error.message)) backToLogin(error.message);
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

  withLoading(mode === "import" ? "匯入主檔中，請勿關閉視窗。" : "檢查主檔中，請勿關閉視窗。", () => submitMasterImport(mode, file, category))
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
  const role = card.querySelector(".permission-role")?.value || "操作員";
  const features = [...card.querySelectorAll(".permission-feature:checked")].map((el) => el.value);
  const nickname = card.querySelector(".permission-nick")?.value || "";
  const approver = adminState.self.name || "管理員";

  button.disabled = true;
  button.textContent = "儲存中";
  withLoading("儲存人員權限中，請勿關閉視窗。", () => fetchPermissions("update", { pageId, status, role, features, nickname, approver }))
    .then((payload) => {
      renderPermissions(payload.operators || []);
      adminEls.permissionMessage.textContent = "權限已更新";
    })
    .catch((error) => {
      adminEls.permissionMessage.textContent = error.message;
      if (/密碼|權限|403/.test(error.message)) backToLogin(error.message);
    })
    .finally(() => {
      button.disabled = false;
      button.textContent = "儲存";
    });
});

function toggleBatchRow(row) {
  if (!row) return;
  const next = row.nextElementSibling;
  if (next && next.classList.contains("batch-detail-row")) {
    next.remove();
    row.classList.remove("expanded");
    return;
  }
  document.querySelectorAll(".batch-detail-row").forEach((el) => el.remove());
  document.querySelectorAll(".batch-row.expanded").forEach((el) => el.classList.remove("expanded"));
  row.insertAdjacentHTML("afterend", buildBatchDetailRow(row.dataset.batchId));
  row.classList.add("expanded");
}

adminEls.recentBody.addEventListener("click", (event) => {
  toggleBatchRow(event.target.closest(".batch-row"));
});

adminEls.recentBody.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const row = event.target.closest(".batch-row");
  if (!row) return;
  event.preventDefault();
  toggleBatchRow(row);
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

window.addEventListener("beforeunload", (event) => {
  if (adminState.loadingCount <= 0) return;
  event.preventDefault();
  event.returnValue = "";
});

initAdminIdentity();
