const adminState = {
  password: "",
  range: "7",
  data: null,
  rawBatches: [],
  rawView: null,
  activeTab: "dashboard",
  permissions: [],
  masterImportResult: null,
  self: { userId: "", name: "管理員", features: [], role: "", identified: false },
  statsLoaded: false,
  permsLoaded: false,
  masterCoverage: null,
  masterItems: [],
  masterView: null,
  selectedOperator: "",
  loadingCount: 0,
  permissionAutoRefreshTimer: null,
  permissionAutoRefreshing: false,
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
  changelogTabBtn: document.querySelector("#changelogTabBtn"),
  dashboardView: document.querySelector("#dashboardView"),
  rawView: document.querySelector("#rawView"),
  masterView: document.querySelector("#masterView"),
  permissionsView: document.querySelector("#permissionsView"),
  changelogView: document.querySelector("#changelogView"),
  operatorSelect: document.querySelector("#operatorSelect"),
  operatorDetail: document.querySelector("#operatorDetail"),
  rawItemsHead: document.querySelector("#rawItemsHead"),
  rawSearchInput: document.querySelector("#rawSearchInput"),
  rawStatusFilter: document.querySelector("#rawStatusFilter"),
  rawResetViewBtn: document.querySelector("#rawResetViewBtn"),
  rawColumnControls: document.querySelector("#rawColumnControls"),
  masterQueryForm: document.querySelector("#masterQueryForm"),
  masterFilterCategory: document.querySelector("#masterFilterCategory"),
  masterQueryMessage: document.querySelector("#masterQueryMessage"),
  masterItemsHead: document.querySelector("#masterItemsHead"),
  masterItemsBody: document.querySelector("#masterItemsBody"),
  masterSearchInput: document.querySelector("#masterSearchInput"),
  masterCategoryCodeFilter: document.querySelector("#masterCategoryCodeFilter"),
  masterStatusFilter: document.querySelector("#masterStatusFilter"),
  masterResetViewBtn: document.querySelector("#masterResetViewBtn"),
  masterColumnControls: document.querySelector("#masterColumnControls"),
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
  dashboardMajorRecords: document.querySelector("#dashboardMajorRecords"),
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

const TABS = ["dashboard", "raw", "master", "changelog", "permissions"];
const TAB_BTN = {
  dashboard: "dashTabBtn",
  raw: "rawTabBtn",
  master: "masterTabBtn",
  changelog: "changelogTabBtn",
  permissions: "permissionsTabBtn",
};
const TAB_VIEW = {
  dashboard: "dashboardView",
  raw: "rawView",
  master: "masterView",
  changelog: "changelogView",
  permissions: "permissionsView",
};

function setActiveTab(tab) {
  adminState.activeTab = tab;
  for (const t of TABS) {
    adminEls[TAB_BTN[t]].classList.toggle("active", t === tab);
    adminEls[TAB_VIEW[t]].classList.toggle("hidden", t !== tab);
  }
  renderTabStats(tab);
  syncPermissionAutoRefresh();
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
  if (tab === "changelog") {
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

function buildMajorRecords(records) {
  const rows = (records || [])
    .map((record) => {
      const total = toNumber(record.total);
      const abnormal = toNumber(record.abnormal);
      const status = String(record.status || "").trim();
      const notify = String(record.notifyStatus || "").trim();
      const important = abnormal > 0 || status === "\u5931\u6557" || /失敗|異常|未/.test(notify);
      return { ...record, total, abnormal, status, notify, important };
    })
    .filter((record) => record.time || record.batchId)
    .filter((record, index) => record.important || index < 5)
    .slice(0, 8);

  if (!rows.length) {
    return '<p class="result-note">\u5c1a\u7121\u91cd\u5927\u7d00\u9304</p>';
  }

  return rows.map((record) => {
    const tone = record.abnormal > 0 || record.status === "\u5931\u6557" ? "danger" : "ok";
    const operator = record.operatorNick || record.operator || "\u672a\u8a18\u9304\u4eba\u54e1";
    const action = record.status === "\u5931\u6557" ? "\u6279\u6b21\u5931\u6557" : "\u6279\u6b21\u5beb\u5165";
    const content = [
      `${action}: ${record.batchId || "\u672a\u547d\u540d"}`,
      `\u64cd\u4f5c\u4eba ${operator}`,
      `\u7e3d\u7b46\u6578 ${record.total}`,
      record.abnormal ? `\u7570\u5e38 ${record.abnormal}` : "\u7121\u7570\u5e38",
      record.notify ? `\u901a\u77e5 ${record.notify}` : "",
    ].filter(Boolean).join(" / ");

    return `
      <article class="major-record ${tone}">
        <time>${escapeHtml(formatTime(record.time || ""))}</time>
        <div>
          <strong>${escapeHtml(action)}</strong>
          <span>${escapeHtml(content)}</span>
        </div>
      </article>
    `;
  }).join("");
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
  if (adminEls.dashboardMajorRecords) adminEls.dashboardMajorRecords.innerHTML = buildMajorRecords(data.recent);
  if (adminEls.problemParts) adminEls.problemParts.innerHTML = buildProblemParts(data.problemParts);
  adminEls.notifyStatus.innerHTML = buildNotify(data.notify);
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
  if (!adminEls.masterCoverage) return;
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


const RAW_VIEW_STORAGE_KEY = "easan.rawDatabaseView.v1";
const RAW_COLUMN_DEFS = [
  { key: "time", label: "時間", sortable: true, required: true },
  { key: "batchId", label: "批次", sortable: true, required: true },
  { key: "operator", label: "操作人", sortable: true },
  { key: "orderNo", label: "製令單號", sortable: true },
  { key: "total", label: "總數", sortable: true },
  { key: "passed", label: "通過", sortable: true },
  { key: "abnormal", label: "異常", sortable: true },
  { key: "accuracy", label: "正確率", sortable: true },
  { key: "notify", label: "通知", sortable: true },
];
const RAW_DEFAULT_VIEW = {
  columnOrder: RAW_COLUMN_DEFS.map((col) => col.key),
  hiddenColumns: [],
  sort: { key: "time", dir: "desc" },
  search: "",
  status: "",
};

function cloneRawDefaultView() {
  return {
    columnOrder: [...RAW_DEFAULT_VIEW.columnOrder],
    hiddenColumns: [],
    sort: { ...RAW_DEFAULT_VIEW.sort },
    search: "",
    status: "",
  };
}

function loadRawViewState() {
  const fallback = cloneRawDefaultView();
  try {
    const saved = JSON.parse(localStorage.getItem(RAW_VIEW_STORAGE_KEY) || "null");
    if (!saved || typeof saved !== "object") return fallback;
    const known = new Set(RAW_COLUMN_DEFS.map((col) => col.key));
    const savedOrder = Array.isArray(saved.columnOrder) ? saved.columnOrder.filter((key) => known.has(key)) : [];
    const missing = RAW_COLUMN_DEFS.map((col) => col.key).filter((key) => !savedOrder.includes(key));
    return {
      columnOrder: [...savedOrder, ...missing],
      hiddenColumns: Array.isArray(saved.hiddenColumns) ? saved.hiddenColumns.filter((key) => known.has(key)) : [],
      sort: saved.sort && known.has(saved.sort.key) ? saved.sort : fallback.sort,
      search: String(saved.search || ""),
      status: String(saved.status || ""),
    };
  } catch (error) {
    return fallback;
  }
}

function saveRawViewState() {
  if (!adminState.rawView) return;
  localStorage.setItem(RAW_VIEW_STORAGE_KEY, JSON.stringify(adminState.rawView));
}

function rawColumnDef(key) {
  return RAW_COLUMN_DEFS.find((col) => col.key === key) || RAW_COLUMN_DEFS[0];
}

function getVisibleRawColumns() {
  const view = adminState.rawView || cloneRawDefaultView();
  const hidden = new Set(view.hiddenColumns || []);
  return view.columnOrder.map(rawColumnDef).filter((col) => col.required || !hidden.has(col.key));
}

function normalizeRawBatch(batch) {
  const total = toNumber(batch.total);
  const passed = toNumber(batch.passed);
  const abnormal = toNumber(batch.abnormal);
  const accuracy = batch.accuracy ?? (total ? passed / total : 0);
  return {
    ...batch,
    time: formatTime(batch.time || ""),
    rawTime: batch.time || "",
    batchId: batch.batchId || "",
    operator: batch.operatorNick || batch.operator || "",
    orderNo: batch.orderNo || "",
    total,
    passed,
    abnormal,
    accuracy,
    notify: batch.notifyStatus || "",
  };
}

function getRawComparable(value) {
  return String(value ?? "").trim().toLocaleLowerCase("zh-Hant");
}

function getFilteredRawBatches() {
  const view = adminState.rawView || cloneRawDefaultView();
  const search = getRawComparable(view.search);
  const status = String(view.status || "");
  let rows = [...(adminState.rawBatches || [])];
  if (search) {
    rows = rows.filter((row) => [row.time, row.batchId, row.operator, row.orderNo, row.total, row.passed, row.abnormal, formatPercent(row.accuracy), row.notify]
      .some((value) => getRawComparable(value).includes(search)));
  }
  if (status === "normal") rows = rows.filter((row) => toNumber(row.abnormal) === 0);
  if (status === "abnormal") rows = rows.filter((row) => toNumber(row.abnormal) > 0);
  if (status === "notified") rows = rows.filter((row) => String(row.notify || "").trim());
  const sort = view.sort || RAW_DEFAULT_VIEW.sort;
  rows.sort((a, b) => {
    let result = 0;
    if (["total", "passed", "abnormal", "accuracy"].includes(sort.key)) {
      result = toNumber(a[sort.key]) - toNumber(b[sort.key]);
    } else if (sort.key === "time") {
      result = String(a.rawTime || a.time).localeCompare(String(b.rawTime || b.time));
    } else {
      result = getRawComparable(a[sort.key]).localeCompare(getRawComparable(b[sort.key]), "zh-Hant", { numeric: true });
    }
    return sort.dir === "desc" ? -result : result;
  });
  return rows;
}

function renderRawColumnControls() {
  if (!adminEls.rawColumnControls || !adminState.rawView) return;
  const hidden = new Set(adminState.rawView.hiddenColumns || []);
  adminEls.rawColumnControls.innerHTML = adminState.rawView.columnOrder.map((key) => {
    const col = rawColumnDef(key);
    const checked = col.required || !hidden.has(key);
    return `
      <div class="database-column-item" data-col="${escapeHtml(key)}" draggable="true">
        <span class="drag-handle" aria-hidden="true">⋮⋮</span>
        <label>
          <input type="checkbox" class="raw-column-toggle" ${checked ? "checked" : ""} ${col.required ? "disabled" : ""}>
          <span>${escapeHtml(col.label)}</span>
        </label>
      </div>
    `;
  }).join("");
}

function renderRawTableHead(columns) {
  if (!adminEls.rawItemsHead) return;
  const sort = adminState.rawView?.sort || {};
  adminEls.rawItemsHead.innerHTML = `<tr>${columns.map((col) => {
    const sorted = sort.key === col.key;
    const sortMark = sorted ? (sort.dir === "desc" ? " ↓" : " ↑") : "";
    return `<th class="raw-th${col.sortable ? " sortable" : ""}" draggable="true" data-col="${escapeHtml(col.key)}"><button type="button" ${col.sortable ? "" : "disabled"}>${escapeHtml(col.label)}${sortMark}</button></th>`;
  }).join("")}</tr>`;
}

function renderRawCell(row, col) {
  if (col.key === "batchId") return `<td><span class="batch-toggle">▸</span>${escapeHtml(row.batchId)}</td>`;
  if (col.key === "accuracy") return `<td>${formatPercent(row.accuracy)}</td>`;
  if (col.key === "notify") return `<td>${escapeHtml(row.notify) || "—"}</td>`;
  return `<td>${escapeHtml(row[col.key] ?? "")}</td>`;
}

function renderRawDatabaseView() {
  if (!adminState.rawView) adminState.rawView = loadRawViewState();
  if (adminEls.rawSearchInput) adminEls.rawSearchInput.value = adminState.rawView.search || "";
  if (adminEls.rawStatusFilter) adminEls.rawStatusFilter.value = adminState.rawView.status || "";
  const columns = getVisibleRawColumns();
  renderRawTableHead(columns);
  renderRawColumnControls();
  const rows = getFilteredRawBatches();
  if (!rows.length) {
    const emptyText = (adminState.rawBatches || []).length ? "查無近期批次" : "尚無近期批次";
    adminEls.recentBody.innerHTML = `<tr class="empty-row"><td colspan="${columns.length}">${emptyText}</td></tr>`;
    return;
  }
  adminEls.recentBody.innerHTML = rows.map((row) =>
    `<tr class="batch-row" data-batch-id="${escapeHtml(row.batchId)}" tabindex="0">${columns.map((col) => renderRawCell(row, col)).join("")}</tr>`
  ).join("");
}

function setRawSort(key) {
  const col = rawColumnDef(key);
  if (!col.sortable) return;
  const current = adminState.rawView.sort || {};
  adminState.rawView.sort = { key, dir: current.key === key && current.dir === "asc" ? "desc" : "asc" };
  saveRawViewState();
  renderRawDatabaseView();
}

function toggleRawColumn(key, visible) {
  const col = rawColumnDef(key);
  if (col.required) return;
  const hidden = new Set(adminState.rawView.hiddenColumns || []);
  if (visible) hidden.delete(key); else hidden.add(key);
  adminState.rawView.hiddenColumns = [...hidden];
  saveRawViewState();
  renderRawDatabaseView();
}

function reorderColumnsFromDrop(view, sourceKey, targetKey) {
  const order = view.columnOrder;
  const sourceIndex = order.indexOf(sourceKey);
  const targetIndex = order.indexOf(targetKey);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return false;
  order.splice(targetIndex, 0, order.splice(sourceIndex, 1)[0]);
  return true;
}

function renderRecent(data) {
  let recent = data.recent || [];
  const key = adminState.selectedOperator;
  if (key) {
    const op = (data.operators || []).find((o) => operatorKey(o) === key);
    const name = op ? op.name : key;
    recent = recent.filter((b) => (b.operator || "") === name);
  }
  adminState.rawBatches = recent.map(normalizeRawBatch);
  renderRawDatabaseView();
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
    return `<tr class="batch-detail-row"><td colspan="${getVisibleRawColumns().length}"><p class="result-note">此批次明細未載入（可能超出統計範圍上限）</p></td></tr>`;
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
      <td colspan="${getVisibleRawColumns().length}">
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

async function loadPermissionsQuiet() {
  if (!canManagePermissions() || adminState.activeTab !== "permissions" || adminState.permissionAutoRefreshing) return;
  adminState.permissionAutoRefreshing = true;
  try {
    const payload = await fetchPermissions("list");
    renderPermissions(payload.operators || []);
    adminState.permsLoaded = true;
    adminEls.permissionMessage.textContent = `已自動更新 ${new Date().toLocaleTimeString("zh-TW", { hour12: false })}`;
  } catch (error) {
    adminEls.permissionMessage.textContent = error.message;
    if (/撖Ⅳ|甈?|403/.test(error.message)) backToLogin(error.message);
  } finally {
    adminState.permissionAutoRefreshing = false;
  }
}

function stopPermissionAutoRefresh() {
  if (!adminState.permissionAutoRefreshTimer) return;
  clearInterval(adminState.permissionAutoRefreshTimer);
  adminState.permissionAutoRefreshTimer = null;
}

function syncPermissionAutoRefresh() {
  if (adminState.activeTab !== "permissions" || !canManagePermissions()) {
    stopPermissionAutoRefresh();
    return;
  }
  if (!adminState.permsLoaded) loadPermissionsSafe();
  else loadPermissionsQuiet();
  if (!adminState.permissionAutoRefreshTimer) {
    adminState.permissionAutoRefreshTimer = setInterval(loadPermissionsQuiet, 15000);
  }
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
const MASTER_CATEGORY_CODES = [{"code":"B01","name":"無LOGO火星套筒-託工"},{"code":"B02","name":"無LOGO更換套筒-託工"},{"code":"B03","name":"無LOGO螺絲套筒-託工"},{"code":"B08","name":"無LOGO氣動套筒組裝"},{"code":"B11","name":"LOGO火星套筒-託工"},{"code":"B12","name":"LOGO更換套筒-託工"},{"code":"B13","name":"LOGO螺絲套筒-託工"},{"code":"B18","name":"LOGO氣動套筒組裝"},{"code":"B54","name":"鉗類"},{"code":"B82","name":"汽修  底盤傳動工具 (組合)"},{"code":"C05","name":"貫通方桿類"},{"code":"C06","name":"押配類"},{"code":"C11","name":"套筒/火星組"},{"code":"C13","name":"一體成型BIT套筒"},{"code":"C16","name":"螺絲套筒組"},{"code":"C18","name":"氣動套筒/火星組"},{"code":"C30","name":"一般板手組"},{"code":"C31","name":"棘輪板手組"},{"code":"C32","name":"拆輪板手組"},{"code":"C33","name":"扭力測量工具組"},{"code":"C35","name":"六角板手組"},{"code":"C51","name":"BIT組"},{"code":"C52","name":"起子組"},{"code":"C54","name":"鉗類組"},{"code":"C58","name":"方桿組"},{"code":"C59","name":"萬向組"},{"code":"C62","name":"鋸子組"},{"code":"C64","name":"沖刀類組"},{"code":"C65","name":"銼刀組"},{"code":"C67","name":"量具組"},{"code":"C81","name":"汽修  引擎修護工具 (組合)"},{"code":"C82","name":"汽修  底盤傳動工具 (組合)"},{"code":"C83","name":"汽修 電機修查工具"},{"code":"C84","name":"汽修 車身板金工具 (組合)"},{"code":"C85","name":"汽修 大車工具 (組合)"},{"code":"C86","name":"汽修 測試工具 (組合)"},{"code":"C87","name":"汽修 拉拔器 (組合)"},{"code":"C88","name":"汽修 特別分類 (組合)"},{"code":"D11","name":"套筒/火星"},{"code":"D12","name":"接桿/ 接頭"},{"code":"D13","name":"一體成型BIT套筒"},{"code":"D14","name":"更換套筒"},{"code":"D15","name":"強力套筒"},{"code":"D16","name":"螺絲套筒"},{"code":"D17","name":"特殊接桿/ 接頭"},{"code":"D18","name":"氣動套筒/火星"},{"code":"D19","name":"氣動接桿/ 接頭"},{"code":"D20","name":"氣動萬象"},{"code":"D22","name":"氣動起子頭(一體套筒)"},{"code":"D29","name":"汽動扭力測試機"},{"code":"D30","name":"一般板手類"},{"code":"D31","name":"棘輪板手"},{"code":"D32","name":"拆輪板手類"},{"code":"D33","name":"扭力測量工具"},{"code":"D34","name":"活動板手"},{"code":"D35","name":"六角板手類"},{"code":"D36","name":"鉤型板手類"},{"code":"D50","name":"柄類"},{"code":"D51","name":"BIT類"},{"code":"D52","name":"起子類"},{"code":"D53","name":"桿類"},{"code":"D54","name":"鉗類"},{"code":"D55","name":"萬能鉗"},{"code":"D56","name":"槌類"},{"code":"D57","name":"棘輪類"},{"code":"D58","name":"方桿類"},{"code":"D59","name":"萬向類"},{"code":"D61","name":"其它類"},{"code":"D62","name":"鋸子類"},{"code":"D63","name":"刀、剪類"},{"code":"D64","name":"沖刀類"},{"code":"D65","name":"銼刀類"},{"code":"D67","name":"量具類"},{"code":"D68","name":"水泥鑽"},{"code":"D691","name":"水管工具 金屬切割器(銅/鐵/白鐵...)"},{"code":"D71","name":"汽動工具類"},{"code":"D72","name":"空氣軟管類"},{"code":"D73","name":"反沖軟管類"},{"code":"D74","name":"氣動釘槍"},{"code":"D75","name":"電動工具類"},{"code":"D81","name":"汽修  引擎修護工具"},{"code":"D82","name":"汽修  底盤傳動工具"},{"code":"D83","name":"汽修 電機修查工具"},{"code":"D84","name":"汽修 車身板金工具"},{"code":"D85","name":"汽修 大車工具"},{"code":"D86","name":"汽修 測試工具"},{"code":"D87","name":"汽修 拉拔器"},{"code":"D88","name":"汽修 特別分類"},{"code":"D91","name":"铣刀"},{"code":"D92","name":"漆類"},{"code":"D93","name":"噴筆類"},{"code":"E01","name":"無LOGO套筒"},{"code":"E02","name":"無LOGO接桿/接頭"},{"code":"E03","name":"無LOGO HBS套筒"},{"code":"E04","name":"無LOGO更換套筒(不等邊)"},{"code":"E05","name":"無LOGO強力套筒/BIT接桿"},{"code":"E06","name":"無LOGO螺絲/穿透套筒"},{"code":"E07","name":"無LOGO特殊接桿/其它"},{"code":"E08","name":"無LOGO氣動套筒"},{"code":"E09","name":"無LOGO氣動接桿/接頭"},{"code":"E11","name":"LOGO套筒"},{"code":"E12","name":"LOGO接桿/接頭"},{"code":"E13","name":"LOGO HBS套筒"},{"code":"E14","name":"LOGO更換套筒(不等邊)"},{"code":"E16","name":"LOGO螺絲/穿透套筒"},{"code":"E17","name":"LOGO特殊接桿/TM頭"},{"code":"E18","name":"LOGO氣動套筒"},{"code":"E19","name":"LOGO氣動接桿/接頭"},{"code":"E82","name":"汽修  底盤傳動工具 (組合)"},{"code":"F01","name":"車工品套筒"},{"code":"F02","name":"車工品接桿/接頭"},{"code":"F03","name":"車工品HBS套筒"},{"code":"F04","name":"車工品更換套筒(不等邊)"},{"code":"F05","name":"車工品強力套筒/BIT接桿"},{"code":"F06","name":"車工品螺絲/穿透套筒"},{"code":"F07","name":"車工品特殊接桿/TM頭"},{"code":"F08","name":"車工品氣動套筒"},{"code":"F09","name":"車工品氣動接桿/接頭"},{"code":"G01","name":"鍛品套筒"},{"code":"G02","name":"鍛品接桿/接頭"},{"code":"G03","name":"鍛品HBS套筒"},{"code":"G04","name":"鍛品更換套筒(不等邊)"},{"code":"G05","name":"鍛品強力套筒/BIT接桿"},{"code":"G06","name":"鍛品螺絲套筒/穿透套筒"},{"code":"G07","name":"鍛品特殊接桿/TM頭"},{"code":"G08","name":"鍛品氣動套筒"},{"code":"G09","name":"鍛品氣動接桿/接頭"},{"code":"H01","name":"鋼料"},{"code":"H02","name":"管/板類"},{"code":"H11","name":"塑膠原料"},{"code":"I01","name":"吹氣盒"},{"code":"I02","name":"PP/PS盒類"},{"code":"I03","name":"鐵盒類"},{"code":"I05","name":"皮包類"},{"code":"I07","name":"工具車"},{"code":"I08","name":"POUSH包類"},{"code":"I09","name":"(布類/牛津布)工具腰包/工具提箱/工作背心/空調背心"},{"code":"I10","name":"吊牌類"},{"code":"I11","name":"套筒夾類"},{"code":"I12","name":"底盤類"},{"code":"I13","name":"泡殼類"},{"code":"I14","name":"EVA類"},{"code":"I15","name":"壓克力類"},{"code":"I16","name":"防盜系列"},{"code":"I17","name":"吊牌零件類"},{"code":"I20","name":"彩盒類"},{"code":"I21","name":"彩套類"},{"code":"I22","name":"紙卡類"},{"code":"I23","name":"貼標類"},{"code":"I24","name":"彩標類"},{"code":"I25","name":"說明書類"},{"code":"I260","name":"產品UPC說明書貼標"},{"code":"I263","name":"內箱UPC貼標"},{"code":"I264","name":"外箱UPC貼標"},{"code":"I30","name":"泡棉類"},{"code":"I31","name":"束帶類"},{"code":"I32","name":"塑膠袋"},{"code":"I33","name":"列印耗材類"},{"code":"I39","name":"散單自黏貼標"},{"code":"I40","name":"紙箱"},{"code":"I41","name":"隔板類"},{"code":"I42","name":"棧板類"},{"code":"I45","name":"組套紙箱"},{"code":"I46","name":"散單紙箱"},{"code":"I47","name":"安庫紙箱"},{"code":"I99","name":"包材其他類"},{"code":"Q","name":"客供品"},{"code":"S00","name":"純套筒組套(1/4\"DR,3/8\"DR,1/2\"DR)"},{"code":"S01","name":"套筒組套(1/4\"DR,3/8\"DR,1/2\"DR)"},{"code":"S02","name":"套筒工具組套(1/4\"DR,3/8\"DR,1/2\"DR)"},{"code":"S03","name":"工具組"},{"code":"S04","name":"一猛打振"},{"code":"S05","name":"貫通方桿組套"},{"code":"S06","name":"押配組套"},{"code":"S07","name":"Set with only socket"},{"code":"S11","name":"套筒/火星組"},{"code":"S12","name":"接桿/接頭組"},{"code":"S13","name":"HBS套筒組"},{"code":"S14","name":"更換套筒組"},{"code":"S15","name":"強力套筒組"},{"code":"S16","name":"螺絲套筒組"},{"code":"S17","name":"特殊接桿/接頭組"},{"code":"S18","name":"氣動套筒組"},{"code":"S19","name":"氣動接頭/接桿組"},{"code":"S20","name":"氣動萬象組"},{"code":"S21","name":"3/4\"DR 一般套筒相關組套(80MM以下)"},{"code":"S22","name":"1\"DR 一般套筒相關組套(100MM以下)"},{"code":"S23","name":"氣動套筒(組套)"},{"code":"S25","name":"氣動HBS套筒組"},{"code":"S30","name":"一般板手組"},{"code":"S31","name":"棘輪板手組"},{"code":"S32","name":"拆輪板手組"},{"code":"S33","name":"扭力測量工具組"},{"code":"S34","name":"活動板手組"},{"code":"S35","name":"六角板手組"},{"code":"S50","name":"柄類組"},{"code":"S51","name":"BIT類組"},{"code":"S52","name":"起子組"},{"code":"S53","name":"桿類組"},{"code":"S54","name":"鉗類組"},{"code":"S55","name":"萬能鉗組"},{"code":"S56","name":"槌類組"},{"code":"S57","name":"棘輪類組"},{"code":"S58","name":"方桿組"},{"code":"S59","name":"萬向組"},{"code":"S61","name":"其它類組"},{"code":"S62","name":"鋸子組"},{"code":"S63","name":"刀剪組"},{"code":"S64","name":"沖/銼刀類"},{"code":"S67","name":"量具組"},{"code":"S71","name":"汽動工具類組"},{"code":"S74","name":"氣動釘槍組"},{"code":"S81","name":"汽修  引擎修護工具"},{"code":"S82","name":"汽修  底盤傳動工具"},{"code":"S83","name":"汽修 電機修查工具"},{"code":"S84","name":"汽修 車身板金工具"},{"code":"S85","name":"汽修 大車工具"},{"code":"S86","name":"汽修 測試工具"},{"code":"S87","name":"汽修 拉拔器"},{"code":"S88","name":"汽修 特別分類"},{"code":"S93","name":"噴筆組類"},{"code":"S98","name":"不同組套合包"},{"code":"S99","name":"包材組"}];
const MASTER_CATEGORY_BY_CODE = new Map(MASTER_CATEGORY_CODES.map((item) => [item.code, item.name]));
const MASTER_CATEGORY_PREFIXES = MASTER_CATEGORY_CODES.map((item) => item.code).sort((a, b) => b.length - a.length);
const MASTER_VIEW_STORAGE_KEY = "easan.masterDatabaseView.v1";
const MASTER_COLUMN_DEFS = [
  { key: "partNo", label: "品號", sortable: true, required: true },
  { key: "categoryCode", label: "分類碼", sortable: true },
  { key: "categoryName", label: "分類名稱", sortable: true },
  { key: "name", label: "品名", sortable: true },
  { key: "spec", label: "規格", sortable: true, wide: true },
  { key: "category", label: "資料分類", sortable: true },
  { key: "status", label: "狀態", sortable: true },
  { key: "unit", label: "單位", sortable: true },
  { key: "action", label: "操作", required: true },
];
const MASTER_DEFAULT_VIEW = {
  columnOrder: MASTER_COLUMN_DEFS.map((col) => col.key),
  hiddenColumns: [],
  sort: { key: "partNo", dir: "asc" },
  search: "",
  categoryCode: "",
  status: "",
};

function cloneMasterDefaultView() {
  return {
    columnOrder: [...MASTER_DEFAULT_VIEW.columnOrder],
    hiddenColumns: [],
    sort: { ...MASTER_DEFAULT_VIEW.sort },
    search: "",
    categoryCode: "",
    status: "",
  };
}

function loadMasterViewState() {
  const fallback = cloneMasterDefaultView();
  try {
    const saved = JSON.parse(localStorage.getItem(MASTER_VIEW_STORAGE_KEY) || "null");
    if (!saved || typeof saved !== "object") return fallback;
    const known = new Set(MASTER_COLUMN_DEFS.map((col) => col.key));
    const savedOrder = Array.isArray(saved.columnOrder) ? saved.columnOrder.filter((key) => known.has(key)) : [];
    const missing = MASTER_COLUMN_DEFS.map((col) => col.key).filter((key) => !savedOrder.includes(key));
    return {
      columnOrder: [...savedOrder, ...missing],
      hiddenColumns: Array.isArray(saved.hiddenColumns) ? saved.hiddenColumns.filter((key) => known.has(key)) : [],
      sort: saved.sort && known.has(saved.sort.key) ? saved.sort : fallback.sort,
      search: String(saved.search || ""),
      categoryCode: String(saved.categoryCode || ""),
      status: String(saved.status || ""),
    };
  } catch (error) {
    return fallback;
  }
}

function saveMasterViewState() {
  if (!adminState.masterView) return;
  localStorage.setItem(MASTER_VIEW_STORAGE_KEY, JSON.stringify(adminState.masterView));
}

function masterColumnDef(key) {
  return MASTER_COLUMN_DEFS.find((col) => col.key === key) || MASTER_COLUMN_DEFS[0];
}

function getVisibleMasterColumns() {
  const view = adminState.masterView || cloneMasterDefaultView();
  const hidden = new Set(view.hiddenColumns || []);
  return view.columnOrder.map(masterColumnDef).filter((col) => col.required || !hidden.has(col.key));
}

function inferMasterCategoryCode(item) {
  const explicit = String(item.categoryCode || item.code || item.classCode || "").trim().toUpperCase();
  if (explicit) return explicit;
  const category = String(item.category || "").trim().toUpperCase();
  if (MASTER_CATEGORY_BY_CODE.has(category)) return category;
  const partNo = String(item.partNo || "").trim().toUpperCase();
  for (const code of MASTER_CATEGORY_PREFIXES) {
    if (partNo.startsWith(code)) return code;
  }
  const match = partNo.match(/^[A-Z][0-9]{2}/);
  return match ? match[0] : "";
}

function normalizeMasterItem(item) {
  const categoryCode = inferMasterCategoryCode(item);
  const categoryName = String(item.categoryName || item.className || MASTER_CATEGORY_BY_CODE.get(categoryCode) || "").trim();
  return {
    ...item,
    partNo: String(item.partNo || "").trim(),
    name: String(item.name || "").trim(),
    spec: String(item.spec || "").trim(),
    category: String(item.category || "未分類").trim() || "未分類",
    status: String(item.status || "未設定").trim() || "未設定",
    unit: String(item.unit || "").trim(),
    categoryCode,
    categoryName,
  };
}

function masterComparable(value) {
  return String(value ?? "").trim().toLocaleLowerCase("zh-Hant");
}

function getFilteredMasterItems() {
  const view = adminState.masterView || cloneMasterDefaultView();
  const search = masterComparable(view.search);
  const code = String(view.categoryCode || "");
  const status = String(view.status || "");
  let items = [...(adminState.masterItems || [])];
  if (search) {
    items = items.filter((item) => [
      item.partNo,
      item.name,
      item.spec,
      item.category,
      item.categoryCode,
      item.categoryName,
      item.unit,
      item.status,
    ].some((value) => masterComparable(value).includes(search)));
  }
  if (code) items = items.filter((item) => item.categoryCode === code);
  if (status) items = items.filter((item) => item.status === status);
  const sort = view.sort || MASTER_DEFAULT_VIEW.sort;
  if (sort.key && sort.key !== "action") {
    items.sort((a, b) => {
      const result = masterComparable(a[sort.key]).localeCompare(masterComparable(b[sort.key]), "zh-Hant", { numeric: true });
      return sort.dir === "desc" ? -result : result;
    });
  }
  return items;
}

function renderMasterCategoryCodeOptions() {
  if (!adminEls.masterCategoryCodeFilter) return;
  const current = adminState.masterView?.categoryCode || "";
  const loadedCodes = new Set((adminState.masterItems || []).map((item) => item.categoryCode).filter(Boolean));
  const codes = MASTER_CATEGORY_CODES.filter((item) => loadedCodes.size ? loadedCodes.has(item.code) : true);
  adminEls.masterCategoryCodeFilter.innerHTML = '<option value="">全部分類碼</option>' + codes.map((item) =>
    `<option value="${escapeHtml(item.code)}" ${item.code === current ? "selected" : ""}>${escapeHtml(item.code)} - ${escapeHtml(item.name)}</option>`
  ).join("");
}

function renderMasterColumnControls() {
  if (!adminEls.masterColumnControls || !adminState.masterView) return;
  const hidden = new Set(adminState.masterView.hiddenColumns || []);
  adminEls.masterColumnControls.innerHTML = adminState.masterView.columnOrder.map((key) => {
    const col = masterColumnDef(key);
    const checked = col.required || !hidden.has(key);
    return `
      <div class="database-column-item" data-col="${escapeHtml(key)}" draggable="true">
        <span class="drag-handle" aria-hidden="true">⋮⋮</span>
        <label>
          <input type="checkbox" class="master-column-toggle" ${checked ? "checked" : ""} ${col.required ? "disabled" : ""}>
          <span>${escapeHtml(col.label)}</span>
        </label>
      </div>
    `;
  }).join("");
}

function moveMasterColumn(key, direction) {
  const order = adminState.masterView.columnOrder;
  const index = order.indexOf(key);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return;
  [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
  saveMasterViewState();
  renderMasterDatabaseView();
}

function toggleMasterColumn(key, visible) {
  const col = masterColumnDef(key);
  if (col.required) return;
  const hidden = new Set(adminState.masterView.hiddenColumns || []);
  if (visible) hidden.delete(key); else hidden.add(key);
  adminState.masterView.hiddenColumns = [...hidden];
  saveMasterViewState();
  renderMasterDatabaseView();
}

function setMasterSort(key) {
  const col = masterColumnDef(key);
  if (!col.sortable) return;
  const current = adminState.masterView.sort || {};
  adminState.masterView.sort = {
    key,
    dir: current.key === key && current.dir === "asc" ? "desc" : "asc",
  };
  saveMasterViewState();
  renderMasterDatabaseView();
}

function renderMasterTableHead(columns) {
  if (!adminEls.masterItemsHead) return;
  const sort = adminState.masterView?.sort || {};
  adminEls.masterItemsHead.innerHTML = `<tr>${columns.map((col) => {
    const sorted = sort.key === col.key;
    const sortMark = sorted ? (sort.dir === "desc" ? " ↓" : " ↑") : "";
    const sortable = col.sortable ? " sortable" : "";
    return `<th class="master-th${sortable}" draggable="true" data-col="${escapeHtml(col.key)}"><button type="button" ${col.sortable ? "" : "disabled"}>${escapeHtml(col.label)}${sortMark}</button></th>`;
  }).join("")}</tr>`;
}

function renderMasterCell(item, col) {
  if (col.key === "spec") return `<td class="wide-cell"><span class="cell-text">${escapeHtml(item.spec || "")}</span></td>`;
  if (col.key === "category") {
    const cat = item.category || "未分類";
    const catSel = MASTER_CATEGORIES.map((c) => `<option value="${escapeHtml(c)}" ${c === cat ? "selected" : ""}>${escapeHtml(c)}</option>`).join("");
    return `<td><select class="master-cat">${catSel}</select></td>`;
  }
  if (col.key === "status") {
    const status = item.status === "未設定" ? "啟用" : item.status;
    const stSel = MASTER_STATUSES.map((s) => `<option value="${escapeHtml(s)}" ${s === status ? "selected" : ""}>${escapeHtml(s)}</option>`).join("");
    return `<td><select class="master-status">${stSel}</select></td>`;
  }
  if (col.key === "action") return '<td><button class="ghost-btn master-save-btn" type="button">儲存</button></td>';
  if (col.key === "categoryCode") return `<td><span class="badge neutral">${escapeHtml(item.categoryCode || "未判定")}</span></td>`;
  if (col.key === "categoryName") return `<td><span class="cell-text">${escapeHtml(item.categoryName || "")}</span></td>`;
  return `<td>${escapeHtml(item[col.key] || "")}</td>`;
}

function renderMasterDatabaseView() {
  if (!adminState.masterView) adminState.masterView = loadMasterViewState();
  if (adminEls.masterSearchInput) adminEls.masterSearchInput.value = adminState.masterView.search || "";
  if (adminEls.masterStatusFilter) adminEls.masterStatusFilter.value = adminState.masterView.status || "";
  renderMasterCategoryCodeOptions();
  const columns = getVisibleMasterColumns();
  renderMasterTableHead(columns);
  renderMasterColumnControls();
  const items = getFilteredMasterItems();
  if (!items.length) {
    const emptyText = (adminState.masterItems || []).length ? "查無品項" : "尚未查詢";
    adminEls.masterItemsBody.innerHTML = `<tr class="empty-row"><td colspan="${columns.length}">${emptyText}</td></tr>`;
    return;
  }
  adminEls.masterItemsBody.innerHTML = items.map((item) =>
    `<tr data-page-id="${escapeHtml(item.pageId)}">${columns.map((col) => renderMasterCell(item, col)).join("")}</tr>`
  ).join("");
}

function renderMasterItems(payload, category) {
  const items = (payload.items || []).map(normalizeMasterItem);
  adminState.masterItems = items;
  adminState.masterCoverage = payload.categoryCounts || adminState.masterCoverage;
  if (!adminState.masterView) adminState.masterView = loadMasterViewState();
  renderTabStats("master");
  renderMasterDatabaseView();
  const filteredItems = getFilteredMasterItems();
  const serverTotal = toNumber(payload.filteredCount ?? items.length);
  const serverNote = serverTotal > items.length ? `，目前載入前 ${items.length} 筆` : "";
  const clientNote = filteredItems.length !== items.length ? `，視角顯示 ${filteredItems.length} 筆` : "";
  adminEls.masterQueryMessage.textContent = `共 ${serverTotal} 筆${category ? `（${category}）` : "（全部）"}${serverNote}${clientNote}`;
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

function initMasterDatabaseView() {
  adminState.masterView = loadMasterViewState();
  renderMasterDatabaseView();
}

function initRawDatabaseView() {
  adminState.rawView = loadRawViewState();
  renderRawDatabaseView();
}

initMasterDatabaseView();
initRawDatabaseView();

function rangeLabel(range) {
  if (range === "7") return "近 7 天";
  if (range === "all") return "全部";
  return "近 30 天";
}

function backToLogin(message) {
  stopPermissionAutoRefresh();
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
  if (adminEls.dashboardMajorRecords) adminEls.dashboardMajorRecords.innerHTML = '<p class="result-note">\u8acb\u8f09\u5165\u8cc7\u6599\u5f8c\u986f\u793a\u91cd\u5927\u7d00\u9304</p>';
  if (adminEls.problemParts) adminEls.problemParts.innerHTML = '<p class="result-note">請選擇範圍後按重新載入</p>';
  if (adminEls.notifyStatus) adminEls.notifyStatus.innerHTML = '<p class="result-note">請選擇範圍後按重新載入</p>';
  if (adminEls.masterCoverage) adminEls.masterCoverage.innerHTML = '<p class="result-note">請選擇範圍後按重新載入</p>';
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

adminEls.changelogTabBtn.addEventListener("click", () => {
  setActiveTab("changelog");
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

adminEls.masterSearchInput?.addEventListener("input", () => {
  adminState.masterView.search = adminEls.masterSearchInput.value;
  saveMasterViewState();
  renderMasterDatabaseView();
});

adminEls.masterCategoryCodeFilter?.addEventListener("change", () => {
  adminState.masterView.categoryCode = adminEls.masterCategoryCodeFilter.value;
  saveMasterViewState();
  renderMasterDatabaseView();
});

adminEls.masterStatusFilter?.addEventListener("change", () => {
  adminState.masterView.status = adminEls.masterStatusFilter.value;
  saveMasterViewState();
  renderMasterDatabaseView();
});

adminEls.masterResetViewBtn?.addEventListener("click", () => {
  localStorage.removeItem(MASTER_VIEW_STORAGE_KEY);
  adminState.masterView = cloneMasterDefaultView();
  renderMasterDatabaseView();
});

adminEls.masterColumnControls?.addEventListener("change", (event) => {
  const input = event.target.closest(".master-column-toggle");
  if (!input) return;
  const row = input.closest(".database-column-item");
  toggleMasterColumn(row?.dataset.col || "", input.checked);
});

adminEls.masterColumnControls?.addEventListener("dragstart", (event) => {
  const item = event.target.closest(".database-column-item[data-col]");
  if (!item) return;
  event.dataTransfer.setData("text/plain", item.dataset.col);
  event.dataTransfer.effectAllowed = "move";
});

adminEls.masterColumnControls?.addEventListener("dragover", (event) => {
  if (event.target.closest(".database-column-item[data-col]")) event.preventDefault();
});

adminEls.masterColumnControls?.addEventListener("drop", (event) => {
  const target = event.target.closest(".database-column-item[data-col]");
  if (!target) return;
  event.preventDefault();
  const sourceKey = event.dataTransfer.getData("text/plain");
  if (!reorderColumnsFromDrop(adminState.masterView, sourceKey, target.dataset.col)) return;
  saveMasterViewState();
  renderMasterDatabaseView();
});

adminEls.rawSearchInput?.addEventListener("input", () => {
  adminState.rawView.search = adminEls.rawSearchInput.value;
  saveRawViewState();
  renderRawDatabaseView();
});

adminEls.rawStatusFilter?.addEventListener("change", () => {
  adminState.rawView.status = adminEls.rawStatusFilter.value;
  saveRawViewState();
  renderRawDatabaseView();
});

adminEls.rawResetViewBtn?.addEventListener("click", () => {
  localStorage.removeItem(RAW_VIEW_STORAGE_KEY);
  adminState.rawView = cloneRawDefaultView();
  renderRawDatabaseView();
});

adminEls.rawColumnControls?.addEventListener("change", (event) => {
  const input = event.target.closest(".raw-column-toggle");
  if (!input) return;
  const row = input.closest(".database-column-item");
  toggleRawColumn(row?.dataset.col || "", input.checked);
});

adminEls.rawColumnControls?.addEventListener("dragstart", (event) => {
  const item = event.target.closest(".database-column-item[data-col]");
  if (!item) return;
  event.dataTransfer.setData("text/plain", item.dataset.col);
  event.dataTransfer.effectAllowed = "move";
});

adminEls.rawColumnControls?.addEventListener("dragover", (event) => {
  if (event.target.closest(".database-column-item[data-col]")) event.preventDefault();
});

adminEls.rawColumnControls?.addEventListener("drop", (event) => {
  const target = event.target.closest(".database-column-item[data-col]");
  if (!target) return;
  event.preventDefault();
  const sourceKey = event.dataTransfer.getData("text/plain");
  if (!reorderColumnsFromDrop(adminState.rawView, sourceKey, target.dataset.col)) return;
  saveRawViewState();
  renderRawDatabaseView();
});

adminEls.rawItemsHead?.addEventListener("click", (event) => {
  const th = event.target.closest("th[data-col]");
  if (!th || event.target.closest("button")?.disabled) return;
  setRawSort(th.dataset.col);
});

adminEls.rawItemsHead?.addEventListener("dragstart", (event) => {
  const th = event.target.closest("th[data-col]");
  if (!th) return;
  event.dataTransfer.setData("text/plain", th.dataset.col);
  event.dataTransfer.effectAllowed = "move";
});

adminEls.rawItemsHead?.addEventListener("dragover", (event) => {
  if (event.target.closest("th[data-col]")) event.preventDefault();
});

adminEls.rawItemsHead?.addEventListener("drop", (event) => {
  const target = event.target.closest("th[data-col]");
  if (!target) return;
  event.preventDefault();
  const sourceKey = event.dataTransfer.getData("text/plain");
  if (!reorderColumnsFromDrop(adminState.rawView, sourceKey, target.dataset.col)) return;
  saveRawViewState();
  renderRawDatabaseView();
});

adminEls.masterItemsHead?.addEventListener("click", (event) => {
  const th = event.target.closest("th[data-col]");
  if (!th || event.target.closest("button")?.disabled) return;
  setMasterSort(th.dataset.col);
});

adminEls.masterItemsHead?.addEventListener("dragstart", (event) => {
  const th = event.target.closest("th[data-col]");
  if (!th) return;
  event.dataTransfer.setData("text/plain", th.dataset.col);
  event.dataTransfer.effectAllowed = "move";
});

adminEls.masterItemsHead?.addEventListener("dragover", (event) => {
  if (event.target.closest("th[data-col]")) event.preventDefault();
});

adminEls.masterItemsHead?.addEventListener("drop", (event) => {
  const target = event.target.closest("th[data-col]");
  if (!target) return;
  event.preventDefault();
  const sourceKey = event.dataTransfer.getData("text/plain");
  const targetKey = target.dataset.col;
  const order = adminState.masterView.columnOrder;
  const sourceIndex = order.indexOf(sourceKey);
  const targetIndex = order.indexOf(targetKey);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
  order.splice(targetIndex, 0, order.splice(sourceIndex, 1)[0]);
  saveMasterViewState();
  renderMasterDatabaseView();
});

adminEls.masterItemsBody.addEventListener("click", (event) => {
  const button = event.target.closest(".master-save-btn");
  if (!button) return;
  const row = button.closest("tr");
  const pageId = row.dataset.pageId;
  const categorySelect = row.querySelector(".master-cat");
  const statusSelect = row.querySelector(".master-status");
  if (!categorySelect || !statusSelect) {
    adminEls.masterQueryMessage.textContent = "請先在欄位設定中顯示「資料分類」與「狀態」欄位，再儲存。";
    return;
  }
  const newCategory = categorySelect.value;
  const newStatus = statusSelect.value;
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
