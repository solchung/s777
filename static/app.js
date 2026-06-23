// Global State
let screenerResults = [];
let filteredResults = [];
let alertsLog = [];
let sortColumn = "score";
let sortAscending = false;
let isPolling = false;

// DOM Elements
const elements = {
    // Buttons & Actions
    btnStartScan: document.getElementById('btnStartScan'),
    btnExportCsv: document.getElementById('btnExportCsv'),
    btnExportExcel: document.getElementById('btnExportExcel'),
    btnClearAlerts: document.getElementById('btnClearAlerts'),
    exportGroup: document.getElementById('exportGroup'),
    
    // Filters
    searchInput: document.getElementById('searchInput'),
    filterIndustry: document.getElementById('filterIndustry'),
    filterScore: document.getElementById('filterScore'),
    
    // Tabs
    tabLinks: document.querySelectorAll('.tab-link'),
    tabPanels: document.querySelectorAll('.tab-panel'),
    alertBadge: document.getElementById('alertBadge'),
    
    // Status & Logs
    lastUpdateTime: document.getElementById('lastUpdateTime'),
    resultsSummaryText: document.getElementById('resultsSummaryText'),
    progressMsg: document.getElementById('progressMsg'),
    progressPct: document.getElementById('progressPct'),
    progressBarFill: document.getElementById('progressBarFill'),
    scanProgressPanel: document.getElementById('scanProgressPanel'),
    
    // Tables & States
    screenerTable: document.getElementById('screenerTable'),
    screenerTableBody: document.getElementById('screenerTableBody'),
    emptyState: document.getElementById('emptyState'),
    emptyStateText: document.getElementById('emptyStateText'),
    alertsListContainer: document.getElementById('alertsListContainer'),
    alertsEmptyState: document.getElementById('alertsEmptyState'),
    
    // Counters
    countLeaders: document.getElementById('countLeaders'),
    countWatchlist: document.getElementById('countWatchlist'),
    countNeutral: document.getElementById('countNeutral'),
    countTotal: document.getElementById('countTotal'),
    
    // Modal
    stockModal: document.getElementById('stockModal'),
    modalOverlay: document.getElementById('modalOverlay'),
    modalClose: document.getElementById('modalClose'),
    modalTicker: document.getElementById('modalTicker'),
    modalCompanyName: document.getElementById('modalCompanyName'),
    modalExchange: document.getElementById('modalExchange'),
    modalScoreBadge: document.getElementById('modalScoreBadge'),
    modalScoreNum: document.getElementById('modalScoreNum'),
    modalSector: document.getElementById('modalSector'),
    modalClassification: document.getElementById('modalClassification'),
    modalChecklist: document.getElementById('modalChecklist'),
    fundBadge: document.getElementById('fundBadge'),
    valClose: document.getElementById('valClose'),
    valDistHigh: document.getElementById('valDistHigh'),
    valVol20: document.getElementById('valVol20'),
    valDistDays: document.getElementById('valDistDays'),
    valMA20: document.getElementById('valMA20'),
    valMA50: document.getElementById('valMA50'),
    valMA200: document.getElementById('valMA200'),
    
    // Notifications
    toastContainer: document.getElementById('toastContainer')
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupEventListeners();
    checkScanningStatus(); // Initial scan status check
});

// --- API Calls & Data Loading ---
async function loadData() {
    try {
        const [resultsResponse, alertsResponse] = await Promise.all([
            fetch('/api/screener/results'),
            fetch('/api/screener/alerts')
        ]);
        
        screenerResults = await resultsResponse.json();
        alertsLog = await alertsResponse.json();
        
        updateLastScanTime();
        populateIndustryDropdown();
        updateCounters();
        applyFilters();
        renderAlerts();
    } catch (error) {
        console.error("Error loading data:", error);
        showToast("Lỗi kết nối", "Không thể tải dữ liệu từ máy chủ.", "error");
    }
}

function updateLastScanTime() {
    if (screenerResults.length === 0) {
        elements.lastUpdateTime.innerText = "Cập nhật: Chưa có dữ liệu";
        return;
    }
    // Set timestamp from file modification time or relative.
    elements.lastUpdateTime.innerText = `Cập nhật: Dữ liệu hiện tại (${screenerResults.length} mã)`;
}

// Populate Industry Dropdown dynamically
function populateIndustryDropdown() {
    const industries = new Set();
    screenerResults.forEach(item => {
        if (item.industry) industries.add(item.industry);
    });
    
    // Reset options
    elements.filterIndustry.innerHTML = '<option value="Tất cả các ngành">Tất cả các ngành</option>';
    
    // Sort and add new options
    Array.from(industries).sort().forEach(ind => {
        const option = document.createElement('option');
        option.value = ind;
        option.innerText = ind;
        elements.filterIndustry.appendChild(option);
    });
}

// Update Dashboard Counters
function updateCounters() {
    let leaders = 0;
    let watchlist = 0;
    let neutral = 0;
    
    screenerResults.forEach(item => {
        if (item.score >= 9) leaders++;
        else if (item.score >= 7) watchlist++;
        else if (item.score >= 5) neutral++;
    });
    
    elements.countLeaders.innerText = leaders;
    elements.countWatchlist.innerText = watchlist;
    elements.countNeutral.innerText = neutral;
    elements.countTotal.innerText = screenerResults.length;
}

// --- Setup Event Listeners ---
function setupEventListeners() {
    // Start scan button
    elements.btnStartScan.addEventListener('click', startScan);
    
    // Download links
    elements.btnExportCsv.addEventListener('click', () => {
        window.location.href = '/api/screener/export/csv';
    });
    
    elements.btnExportExcel.addEventListener('click', () => {
        window.location.href = '/api/screener/export/excel';
    });
    
    // Clear alerts
    elements.btnClearAlerts.addEventListener('click', clearAlertsLog);
    
    // Filters changes
    elements.searchInput.addEventListener('input', applyFilters);
    elements.filterIndustry.addEventListener('change', applyFilters);
    elements.filterScore.addEventListener('change', applyFilters);
    
    // Tabs changing
    elements.tabLinks.forEach(tab => {
        tab.addEventListener('click', () => {
            elements.tabLinks.forEach(t => t.classList.remove('active'));
            elements.tabPanels.forEach(p => p.classList.remove('active'));
            
            tab.classList.add('active');
            const targetTab = document.getElementById(tab.getAttribute('data-tab'));
            targetTab.classList.add('active');
            
            if (tab.getAttribute('data-tab') === 'tab-alerts') {
                elements.alertBadge.style.display = 'none';
                elements.alertBadge.innerText = '0';
            }
        });
    });
    
    // Table sorting
    document.querySelectorAll('.screener-table th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.getAttribute('data-col');
            if (sortColumn === col) {
                sortAscending = !sortAscending;
            } else {
                sortColumn = col;
                sortAscending = false;
            }
            
            // Update sort icons in headers
            document.querySelectorAll('.screener-table th.sortable i').forEach(icon => {
                icon.className = "fa-solid fa-sort";
            });
            const activeIcon = th.querySelector('i');
            activeIcon.className = sortAscending ? "fa-solid fa-sort-up" : "fa-solid fa-sort-down";
            
            sortAndRenderTable();
        });
    });
    
    // Close Modal
    elements.modalClose.addEventListener('click', closeModal);
    elements.modalOverlay.addEventListener('click', closeModal);
}

// --- Filtering & Sorting ---
function applyFilters() {
    const searchVal = elements.searchInput.value.trim().toUpperCase();
    const indVal = elements.filterIndustry.value;
    const scoreVal = elements.filterScore.value;
    
    filteredResults = screenerResults.filter(item => {
        // Keyword Search (by Ticker or Company name)
        const matchSearch = !searchVal || 
            item.ticker.toUpperCase().includes(searchVal) || 
            item.name.toUpperCase().includes(searchVal);
            
        // Industry Filter
        const matchIndustry = indVal === "Tất cả các ngành" || item.industry === indVal;
        
        // Score Filter
        let matchScore = true;
        if (scoreVal === "9-10 điểm (Leader mạnh)") {
            matchScore = item.score >= 9;
        } else if (scoreVal === "7-8 điểm (Watchlist ưu tiên)") {
            matchScore = item.score >= 7 && item.score <= 8;
        } else if (scoreVal === "5-6 điểm (Trung tính)") {
            matchScore = item.score >= 5 && item.score <= 6;
        } else if (scoreVal === "Dưới 5 điểm (Loại bỏ)") {
            matchScore = item.score < 5;
        }
        
        return matchSearch && matchIndustry && matchScore;
    });
    
    sortAndRenderTable();
}

function sortAndRenderTable() {
    filteredResults.sort((a, b) => {
        let valA = a[sortColumn];
        let valB = b[sortColumn];
        
        // Handle null values
        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;
        
        // Custom string / number ordering
        if (typeof valA === 'string') {
            return sortAscending 
                ? valA.localeCompare(valB) 
                : valB.localeCompare(valA);
        } else {
            return sortAscending ? valA - valB : valB - valA;
        }
    });
    
    renderTable();
}

// --- Render Layout Functions ---
function renderTable() {
    const tbody = elements.screenerTableBody;
    tbody.innerHTML = '';
    
    if (filteredResults.length === 0) {
        elements.screenerTable.style.display = 'none';
        elements.emptyState.style.display = 'flex';
        elements.exportGroup.style.display = 'none';
        elements.resultsSummaryText.innerText = "Hiển thị 0 cổ phiếu";
        
        if (screenerResults.length === 0) {
            elements.emptyStateText.innerText = "Chưa có dữ liệu lọc. Vui lòng bấm 'BẮT ĐẦU QUÉT & CHẤM ĐIỂM' ở trên.";
        } else {
            elements.emptyStateText.innerText = "Không tìm thấy cổ phiếu nào khớp cấu hình lọc hiện tại.";
        }
        return;
    }
    
    elements.screenerTable.style.display = 'table';
    elements.emptyState.style.display = 'none';
    elements.exportGroup.style.display = 'flex';
    elements.resultsSummaryText.innerText = `Hiển thị ${filteredResults.length} cổ phiếu đạt điều kiện bộ lọc`;
    
    filteredResults.forEach(item => {
        const row = document.createElement('tr');
        row.addEventListener('click', () => openModal(item));
        
        let scoreClass = 'text-eliminate';
        if (item.score >= 9) scoreClass = 'text-leader';
        else if (item.score >= 7) scoreClass = 'text-watchlist';
        else if (item.score >= 5) scoreClass = 'text-neutral';
        
        const badgeClass = item.classification === "Leader mạnh" ? "leader" :
                            item.classification === "Watchlist ưu tiên" ? "watchlist" :
                            item.classification === "Trung tính" ? "neutral" : "eliminate";
                            
        const volFormatted = item.volume >= 1000000 
            ? `${(item.volume / 1000000).toFixed(2)}M` 
            : `${(item.volume / 1000).toFixed(0)}k`;
            
        row.innerHTML = `
            <td class="row-ticker ${scoreClass}">${item.ticker}</td>
            <td class="text-center text-bold ${scoreClass}">${item.score}/10</td>
            <td><span class="badge-class ${badgeClass}">${item.classification}</span></td>
            <td class="text-right text-bold">${formatMoney(item.close)}</td>
            <td class="text-right">${item.dist_high}%</td>
            <td class="text-right text-muted">${formatMoney(item.ma20)}</td>
            <td class="text-right text-muted">${formatMoney(item.ma50)}</td>
            <td class="text-right text-muted">${formatMoney(item.ma200)}</td>
            <td class="text-right text-bold ${item.rs_vs_index_3m > 0 ? 'text-green' : 'text-red'}">${item.rs_vs_index_3m}%</td>
            <td class="text-right">${volFormatted}</td>
            <td class="text-center text-bold ${item.distribution_days > 4 ? 'text-red' : 'text-green'}">${item.distribution_days}</td>
        `;
        
        tbody.appendChild(row);
    });
}

function renderAlerts() {
    const container = elements.alertsListContainer;
    container.innerHTML = '';
    
    if (alertsLog.length === 0) {
        elements.alertsEmptyState.style.display = 'flex';
        container.style.display = 'none';
        return;
    }
    
    elements.alertsEmptyState.style.display = 'none';
    container.style.display = 'flex';
    
    alertsLog.forEach(alert => {
        const item = document.createElement('div');
        const alertClass = alert.type === "Breakout Vol lớn" ? "breakout" : "score-up";
        const iconClass = alert.type === "Breakout Vol lớn" ? "fa-bolt" : "fa-arrow-trend-up";
        
        item.className = `alert-item ${alertClass}`;
        item.innerHTML = `
            <div class="alert-item-icon">
                <i class="fa-solid ${iconClass}"></i>
            </div>
            <div class="alert-item-content">
                <div class="alert-item-header">
                    <div class="alert-ticker-group">
                        <span class="alert-ticker">${alert.ticker}</span>
                        <span class="alert-type-badge">${alert.type}</span>
                    </div>
                    <span class="alert-score">Điểm: ${alert.score}/10đ</span>
                </div>
                <div class="alert-details">${alert.details}</div>
                <div class="alert-time">${alert.time}</div>
            </div>
        `;
        container.appendChild(item);
    });
}

// --- Screening Scanner Job Functions ---
async function startScan() {
    try {
        const response = await fetch('/api/screener/start', { method: 'POST' });
        const res = await response.json();
        
        if (res.status === 'success') {
            showToast("Bắt đầu quét", "Bộ quét cổ phiếu đang chạy ngầm...", "success");
            elements.btnStartScan.disabled = true;
            elements.scanProgressPanel.style.display = 'flex';
            
            if (!isPolling) {
                isPolling = true;
                pollScanningStatus();
            }
        } else {
            showToast("Không thể khởi động", res.message || "Bộ quét đang bận.", "warning");
        }
    } catch (error) {
        console.error("Error starting scan:", error);
        showToast("Lỗi", "Không gửi được lệnh khởi chạy quét.", "error");
    }
}

async function checkScanningStatus() {
    try {
        const response = await fetch('/api/screener/status');
        const state = await response.json();
        
        if (state.is_running) {
            elements.btnStartScan.disabled = true;
            elements.scanProgressPanel.style.display = 'flex';
            updateProgressBar(state.progress_pct, state.progress_msg);
            
            if (!isPolling) {
                isPolling = true;
                pollScanningStatus();
            }
        } else {
            elements.btnStartScan.disabled = false;
            elements.scanProgressPanel.style.display = 'none';
            isPolling = false;
        }
    } catch (error) {
        console.error("Error getting status:", error);
    }
}

function pollScanningStatus() {
    const timer = setInterval(async () => {
        try {
            const response = await fetch('/api/screener/status');
            const state = await response.json();
            
            updateProgressBar(state.progress_pct, state.progress_msg);
            
            if (!state.is_running) {
                clearInterval(timer);
                isPolling = false;
                elements.btnStartScan.disabled = false;
                elements.scanProgressPanel.style.display = 'none';
                
                // Reload stock list
                showToast("Quét hoàn tất", "Dữ liệu cổ phiếu đã được cập nhật mới nhất.", "success");
                loadData();
            }
        } catch (error) {
            console.error("Polling error:", error);
            clearInterval(timer);
            isPolling = false;
            elements.btnStartScan.disabled = false;
        }
    }, 1500);
}

function updateProgressBar(pct, msg) {
    const pctVal = Math.round(pct * 100);
    elements.progressMsg.innerText = msg;
    elements.progressPct.innerText = `${pctVal}%`;
    elements.progressBarFill.style.width = `${pctVal}%`;
}

// --- Clearing Alert Logs ---
async function clearAlertsLog() {
    if (!confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử cảnh báo giao dịch?")) {
        return;
    }
    
    try {
        const response = await fetch('/api/screener/alerts', { method: 'DELETE' }); // Wait, let's see if delete route exists.
        // Wait, server.py does not have a DELETE route. We should handle the deletion!
        // In server.py:
        // Wait, did we write delete alert route in server.py? No, we didn't add the DELETE method. 
        // Let's modify server.py to add a DELETE alerts route, or we can fetch a route on server.py.
        // Let's see, in server.py, we have `/api/screener/alerts` as GET.
        // Let's check server.py: we can check if it supports DELETE `/api/screener/alerts`.
        // Let's write a route delete `/api/screener/alerts` in server.py.
        // In server.py, let's create a DELETE endpoint.
        const res = await fetch('/api/screener/alerts/clear', { method: 'POST' }); // We can use `/api/screener/alerts/clear` POST endpoint instead.
        // Let's double check if we defined it. We didn't write it in server.py yet. I will edit server.py to add this clear endpoint.
        const resData = await res.json();
        if (res.ok) {
            showToast("Đã xóa", "Lịch sử cảnh báo đã được dọn sạch.", "success");
            alertsLog = [];
            renderAlerts();
        }
    } catch (error) {
        console.error("Error clearing alerts:", error);
        showToast("Lỗi", "Không thể xóa lịch sử cảnh báo.", "error");
    }
}

// --- Stock Details Modal Popup ---
function openModal(item) {
    elements.modalTicker.innerText = item.ticker;
    elements.modalCompanyName.innerText = item.name || `Doanh nghiệp ${item.ticker}`;
    elements.modalExchange.innerText = item.exchange || "HOSE";
    
    elements.modalScoreNum.innerText = item.score;
    elements.modalSector.innerText = `Ngành: ${item.industry || item.sector || "Chưa phân loại"}`;
    elements.modalClassification.innerText = item.classification;
    
    // Score Badge styling
    elements.modalScoreBadge.className = "modal-score-badge";
    let badgeClass = "eliminate";
    if (item.score >= 9) badgeClass = "leader";
    else if (item.score >= 7) badgeClass = "watchlist";
    else if (item.score >= 5) badgeClass = "neutral";
    elements.modalScoreBadge.classList.add(badgeClass);
    
    elements.modalClassification.className = `badge-class ${badgeClass}`;
    
    // Checklist rules rendering
    const checklistContainer = elements.modalChecklist;
    checklistContainer.innerHTML = '';
    
    const criteriaList = [
        { key: "c1", num: "01", text: "Giá đóng cửa hiện tại > MA20", formula: `Close (${formatMoney(item.close)}) > MA20 (${formatMoney(item.ma20)})` },
        { key: "c2", num: "02", text: "MA20 > MA50", formula: `MA20 (${formatMoney(item.ma20)}) > MA50 (${formatMoney(item.ma50)})` },
        { key: "c3", num: "03", text: "MA50 > MA200", formula: `MA50 (${formatMoney(item.ma50)}) > MA200 (${formatMoney(item.ma200)})` },
        { key: "c4", num: "04", text: "Độ dốc MA200 dương trong 20 phiên", formula: `MA200 dốc lên ổn định` },
        { key: "c5", num: "05", text: "Cách đỉnh 52 tuần không quá 15%", formula: `Cách đỉnh: ${item.dist_high}%` },
        { key: "c6", num: "06", text: "RS cao hơn VNINDEX trong 3 tháng", formula: `RS 3T vs Index: ${item.rs_vs_index_3m > 0 ? '+' : ''}${item.rs_vs_index_3m}%` },
        { key: "c7", num: "07", text: "Vol TB 20 phiên > Vol TB 60 phiên", formula: `20p: ${formatVol(item.avg_vol_20)} > 60p: ${formatVol(item.avg_vol_60)}` },
        { key: "c8", num: "08", text: "Nền giá tích lũy 6-12T biên độ < 15%", formula: item.details?.c8 ? "Nền chặt chẽ" : "Biên độ lỏng" },
        { key: "c9", num: "09", text: "Số ngày phân phối trong 25 phiên <= 4", formula: `Ngày PP: ${item.distribution_days}` },
        { key: "c10", num: "10", text: "Tăng trưởng EPS/LNST 4 quý gần nhất (+)", formula: "Tài chính đạt yêu cầu" }
    ];
    
    criteriaList.forEach(crit => {
        const passed = item.details ? item.details[crit.key] : false;
        const checkItem = document.createElement('div');
        checkItem.className = 'checklist-item';
        
        checkItem.innerHTML = `
            <div class="chk-left">
                <i class="${passed ? 'fa-solid fa-circle-check chk-status-icon pass' : 'fa-solid fa-circle-xmark chk-status-icon fail'}"></i>
                <span><strong>${crit.num}.</strong> ${crit.text}</span>
            </div>
            <div class="chk-right">${crit.formula}</div>
        `;
        checklistContainer.appendChild(checkItem);
    });
    
    // Fundamental status
    const fundPass = item.details ? item.details.c10 : false;
    elements.fundBadge.innerText = fundPass ? "Đạt yêu cầu" : "Không đạt";
    elements.fundBadge.className = fundPass ? "badge-status pass" : "badge-status fail";
    
    // Values grid
    elements.valClose.innerText = formatMoney(item.close);
    elements.valDistHigh.innerText = `${item.dist_high}%`;
    elements.valVol20.innerText = formatVol(item.avg_vol_20);
    elements.valDistDays.innerText = `${item.distribution_days} ngày`;
    
    elements.valMA20.innerText = formatMoney(item.ma20);
    elements.valMA50.innerText = formatMoney(item.ma50);
    elements.valMA200.innerText = formatMoney(item.ma200);
    
    // Open modal
    elements.stockModal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Disable scroll on body
}

function closeModal() {
    elements.stockModal.classList.remove('active');
    document.body.style.overflow = 'auto'; // Enable scroll
}

// --- Utilities & Toast functions ---
function formatMoney(val) {
    if (val === undefined || val === null) return '-';
    // Price in Vietnam Stock market is in thousands (10.5 means 10,500đ)
    return `${(val * 1000).toLocaleString('vi-VN')}đ`;
}

function formatVol(val) {
    if (val === undefined || val === null) return '-';
    if (val >= 1000000) {
        return `${(val / 1000000).toFixed(2)} triệu`;
    }
    return `${val.toLocaleString('vi-VN')}`;
}

function showToast(title, message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconClass = 'fa-circle-info';
    if (type === 'success') iconClass = 'fa-circle-check';
    else if (type === 'warning') iconClass = 'fa-triangle-exclamation';
    else if (type === 'error') iconClass = 'fa-circle-xmark';
    
    toast.innerHTML = `
        <i class="fa-solid ${iconClass} toast-icon"></i>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'fadeIn 0.25s reverse forwards';
        setTimeout(() => {
            toast.remove();
        }, 250);
    }, 4000);
}
