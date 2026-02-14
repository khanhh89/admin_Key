
const API_URL = 'https://script.google.com/macros/s/AKfycbxJHUBhK9x4zsyoAafACZrViWKjbnqELzndhdA8uqmtRdlPNnx4tQpDPyd09q2xt0oT7A/exec'; 
let configData = {};
let deleteTargetId = null; 
let currentAddType = 'price';
const CACHE_CONFIG = 'admin_config_v3';
const CACHE_KEYS = 'admin_keys_v3';
function getIdToKey(id) { return id.replace(/-/g, '_'); } 
function getKeyToId(key) { return key.replace(/_/g, '-'); } 
function formatMoney(n) { return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n); }
function showToast(msg, type = 'success') {
    const t = document.getElementById('custom-toast');
    const m = document.getElementById('toast-message');
    const i = t.querySelector('.toast-icon');
    t.className = ''; void t.offsetWidth; 
    m.innerText = msg;
    
    if(type === 'success') {
        t.classList.add('show', 'success');
        i.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
    } else {
        t.classList.add('show', 'error');
        i.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i>';
    }
    setTimeout(() => { t.classList.remove('show'); }, 3000);
}
document.addEventListener("DOMContentLoaded", function() {
    const cachedConfig = localStorage.getItem(CACHE_CONFIG);
    if (cachedConfig) {
        let data = JSON.parse(cachedConfig);
        if (data.status === 'success' && data.data) data = data.data;
        
        renderConfigUI(data);
        document.getElementById('loading-overlay').classList.add('hidden');
        fetchConfig(true); 
    } else {
        fetchConfig(false);
    }
});

function fetchConfig(isBackground = false) {
    if(!isBackground) document.getElementById('loading-overlay').classList.remove('hidden');
    fetch(API_URL + '?t=' + Date.now())
        .then(res => res.json())
        .then(data => {
            const finalData = (data.status === 'success' && data.data) ? data.data : data;
            
            localStorage.setItem(CACHE_CONFIG, JSON.stringify(finalData));
            renderConfigUI(finalData);
            document.getElementById('loading-overlay').classList.add('hidden');
        })
        .catch(err => {
            console.error(err);
            if(!isBackground) showToast("Lỗi kết nối Server!", 'error');
            document.getElementById('loading-overlay').classList.add('hidden');
        });
}
function renderConfigUI(data) {
    configData = data;
    document.getElementById('price-container').innerHTML = "";
    document.getElementById('link-container').innerHTML = "";
    const selectType = document.getElementById('import-type');
    selectType.innerHTML = "";
    for (const [key, value] of Object.entries(data)) {
        if (key.startsWith('price_')) {
            renderInput('price-container', key, value);
            let opt = document.createElement('option');
            opt.value = key; 
            opt.innerText = key.replace('price_','').toUpperCase();
            selectType.appendChild(opt);
        } else if (key.startsWith('link_')) {
            renderInput('link-container', key, value);
        }
    }
    if(data.stats_revenue !== undefined) {
        document.getElementById('view-revenue').innerText = formatMoney(data.stats_revenue);
        document.getElementById('view-orders').innerText = data.stats_orders;
    }
    
    renderChart();
}

function loadKeys() {
    const tbody = document.getElementById('key-list-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải dữ liệu...</td></tr>';

    fetch(`${API_URL}?action=get_all_keys&t=${Date.now()}`)
        .then(res => res.json())
        .then(res => {
            // Kiểm tra res và res.data để tránh lỗi undefined
            if (res && res.status === 'success' && Array.isArray(res.data)) {
                renderKeysTable(res.data);
            } else {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Lỗi: Dữ liệu không hợp lệ</td></tr>';
                console.error("Dữ liệu sai:", res);
            }
        })
        .catch(err => {
            console.error("Lỗi kết nối:", err);
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Lỗi kết nối Server!</td></tr>';
        });
}



function renderKeysTable(dataList) {
    const tbody = document.getElementById('key-list-body');
    tbody.innerHTML = "";
    let activeCount = 0; let usedCount = 0;

    if(!dataList || dataList.length == 0) {
         tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">Kho đang trống</td></tr>';
         return;
    }

    // --- BƯỚC SẮP XẾP: Đẩy 'Active' lên đầu, 'Used' xuống cuối ---
    dataList.sort((a, b) => {
        if (a.status === 'Active' && b.status !== 'Active') return -1;
        if (a.status !== 'Active' && b.status === 'Active') return 1;
        return 0; // Giữ nguyên thứ tự nếu cùng trạng thái
    });

    dataList.forEach((item, index) => {
        // Đếm số lượng
        if(item.status == 'Active') activeCount++; else usedCount++;
        
        // Giao diện Badge
        let statusBadge = item.status == 'Active' 
            ? `<span class="status-badge status-active">Sẵn sàng</span>`
            : `<span class="status-badge status-used">Đã bán</span>`;
        
        let typeName = item.type ? item.type.replace('price_', '').replace(/_/g, ' ').toUpperCase() : 'KHÁC';

        // Vẽ hàng
        tbody.innerHTML += `
            <tr id="key-row-${item.id}" class="${item.status == 'Active' ? '' : 'row-used'}">
                <td>${index + 1}</td>
                <td class="key-code">${item.key}</td>
                <td style="color:var(--primary); font-weight:600;">${typeName}</td>
                <td>${statusBadge}</td>
                <td style="color:#aaa;">${item.owner || 'Chưa có'}</td>
                <td style="text-align:center;">
                    <button class="btn-icon-del" onclick="deleteKey(${item.id})">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    document.getElementById('stat-active').innerText = activeCount;
    document.getElementById('stat-used').innerText = usedCount;
}

// --- CHỨC NĂNG NẠP KEY (Đã sửa bỏ no-cors) ---
function importKeys() {
    const text = document.getElementById('bulk-keys').value.trim();
    const type = document.getElementById('import-type').value;

    if(!text) { showToast("Vui lòng nhập key!", "error"); return; }
    if(!type) { showToast("Vui lòng chọn loại gói!", "error"); return; }
    
    const keys = text.split('\n').map(k => k.trim()).filter(k => k !== "");
    const btn = document.querySelector('#modal-import-key .btn-confirm');
    
    btn.innerText = "Đang nạp..."; btn.disabled = true;

    // Gửi yêu cầu chuẩn (không dùng no-cors)
    fetch(API_URL, {
        method: 'POST',
        headers: {'Content-Type': 'text/plain;charset=utf-8'}, // Dùng text/plain để tránh preflight cors phức tạp của Google
        body: JSON.stringify({ action: 'add_keys', keys: keys, type: type })
    })
    .then(res => res.json())
    .then(data => {
        if(data.status === 'success') {
            showToast(`Đã nạp thành công ${keys.length} key!`, "success");
            document.getElementById('modal-import-key').classList.remove('show');
            document.getElementById('bulk-keys').value = "";
            loadKeys(); // Tải lại bảng ngay lập tức
        } else {
            showToast("Lỗi Server: " + data.msg, "error");
        }
        btn.innerText = "Nạp Ngay"; btn.disabled = false;
    })
    .catch(err => {
        console.error(err);
        showToast("Lỗi kết nối!", "error");
        btn.innerText = "Nạp Ngay"; btn.disabled = false;
    });
}

// --- CHỨC NĂNG XÓA KEY (QUAN TRỌNG: Đã sửa bỏ no-cors) ---
function deleteKey(rowId) {
    if(confirm("Bạn muốn xóa Key này vĩnh viễn?")) {
        
        // Hiệu ứng xóa ngay trên giao diện cho mượt (Optimistic UI)
        const row = document.getElementById(`key-row-${rowId}`);
        if(row) row.style.opacity = '0.3'; 

        fetch(API_URL, {
            method: 'POST',
            headers: {'Content-Type': 'text/plain;charset=utf-8'},
            body: JSON.stringify({ action: 'delete_key', row: rowId })
        })
        .then(res => res.json())
        .then(data => {
            if(data.status === 'success') {
                showToast("Đã xóa key thành công!", "success");
                loadKeys(); // Tải lại dữ liệu sạch từ server
            } else {
                showToast("Xóa thất bại!", "error");
                if(row) row.style.opacity = '1'; // Hồi phục nếu lỗi
            }
        })
        .catch(err => {
            console.error(err);
            showToast("Lỗi kết nối!", "error");
            if(row) row.style.opacity = '1';
        });
    }
}

// ============================================================
// 5. CÁC HÀM GIAO DIỆN KHÁC
// ============================================================

function renderInput(containerId, key, value) {
    const id = getKeyToId(key);
    let prefix = key.startsWith('price_') ? 'price_' : 'link_';
    let labelName = key.replace(prefix, '').replace(/_/g, ' ').toUpperCase();

    if(document.getElementById(`row-${id}`)) return;

    const div = document.createElement('div');
    div.className = 'dynamic-row';
    div.id = `row-${id}`;
    div.innerHTML = `
        <div class="form-group">
            <label>${labelName}</label>
            <input type="text" id="${id}" value="${value}" onchange="updateValue('${id}', this.value)">
        </div>
        <button class="btn-delete" onclick="triggerDelete('${id}')"><i class="fa-solid fa-trash"></i></button>
    `;
    document.getElementById(containerId).appendChild(div);
}

function updateValue(id, val) { configData[getIdToKey(id)] = val; }

function openModal(type) {
    currentAddType = type;
    const title = document.getElementById('modal-title');
    const phName = document.getElementById('new-item-name');
    const phValue = document.getElementById('new-item-value');

    if (type === 'price') {
        title.innerText = "THÊM GÓI GIÁ";
        phName.placeholder = "Ví dụ: Siêu Vip";
        phValue.placeholder = "Ví dụ: 200k";
    } else {
        title.innerText = "THÊM LINK TẢI";
        phName.placeholder = "Ví dụ: Link Nhạc";
        phValue.placeholder = "https://...";
    }
    toggleModal(true);
}

function toggleModal(show) {
    const m = document.getElementById('modal-add');
    if(show) {
        document.getElementById('new-item-name').value = "";
        document.getElementById('new-item-value').value = "";
        m.classList.add('show');
        setTimeout(() => document.getElementById('new-item-name').focus(), 100);
    } else { m.classList.remove('show'); }
}

function confirmAddItem() {
    const name = document.getElementById('new-item-name').value.trim();
    const value = document.getElementById('new-item-value').value.trim();
    
    if (!name || !value) { showToast("Vui lòng nhập đủ!", 'error'); return; }

    let cleanName = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/ /g, '_');
    let prefix = currentAddType === 'price' ? 'price_' : 'link_';
    let newKey = prefix + cleanName;
    let newId = getKeyToId(newKey);

    if (document.getElementById(`row-${newId}`)) { showToast("Đã tồn tại!", 'error'); return; }

    renderInput(currentAddType === 'price' ? 'price-container' : 'link-container', newKey, value);
    configData[newKey] = value;
    toggleModal(false);
    showToast("Đã thêm (Hãy bấm Lưu)", "success");
}

// Xóa Cấu hình (Modal Đỏ)
function triggerDelete(id) {
    deleteTargetId = id;
    document.getElementById('modal-confirm').classList.add('show');
}
function closeConfirmModal() {
    deleteTargetId = null;
    document.getElementById('modal-confirm').classList.remove('show');
}
function executeDelete() {
    if(deleteTargetId) {
        const row = document.getElementById(`row-${deleteTargetId}`);
        if(row) row.remove();
        
        const key = getIdToKey(deleteTargetId);
        delete configData[key];
        
        showToast("Đã xóa mục này!", "success");
        closeConfirmModal();
    }
}

// Lưu Cấu hình
function saveData() {
    const btn = document.querySelector('.btn-save-mini');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';
    btn.disabled = true;

    // Gom dữ liệu mới nhất từ DOM
    let payload = {};
    document.querySelectorAll('.dynamic-row input').forEach(input => {
        let key = getIdToKey(input.id);
        payload[key] = input.value;
    });

    fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        showToast("Đã lưu thành công!", 'success');
        localStorage.setItem(CACHE_CONFIG, JSON.stringify(payload));
        btn.innerHTML = originalHTML; btn.disabled = false;
    })
    .catch(err => {
        showToast("Lỗi khi lưu!", 'error');
        btn.innerHTML = originalHTML; btn.disabled = false;
    });
}

function switchTab(tabName, el) {
    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.add('active');
    
    if(tabName === 'keys') loadKeys();
}

function renderChart(chartData) {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;
    
    // Nếu biểu đồ đã tồn tại, xóa đi để vẽ lại (tránh lỗi lồng biểu đồ)
    if (window.myChart) window.myChart.destroy();

    // Dữ liệu mẫu (Nếu server chưa trả về mảng dữ liệu theo ngày)
    const labels = chartData?.labels || ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    const revenueData = chartData?.revenue || [0, 50000, 20000, 150000, 80000, 250000, 400000];
    const orderData = chartData?.orders || [0, 2, 1, 5, 3, 7, 10];

    window.myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Doanh thu (VND)',
                    data: revenueData,
                    borderColor: '#00f2ff', // Màu xanh neon
                    backgroundColor: 'rgba(0, 242, 255, 0.1)',
                    yAxisID: 'y-revenue', // Chỉ định trục Y bên trái
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4
                },
                {
                    label: 'Đơn hàng (Số lượng)',
                    data: orderData,
                    borderColor: '#ff4d4d', // Màu đỏ neon
                    backgroundColor: 'rgba(255, 77, 77, 0.1)',
                    yAxisID: 'y-orders', // Chỉ định trục Y bên phải
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    labels: { color: '#fff', font: { size: 12 } }
                }
            },
            scales: {
                'y-revenue': {
                    type: 'linear',
                    display: true,
                    position: 'left', // Doanh thu nằm bên TRÁI
                    ticks: {
                        color: '#00f2ff',
                        callback: (value) => value.toLocaleString() + 'đ'
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                'y-orders': {
                    type: 'linear',
                    display: true,
                    position: 'right', // Đơn hàng nằm bên PHẢI
                    min: 0,
                    ticks: {
                        color: '#ff4d4d',
                        stepSize: 1 // Chỉ hiện số nguyên
                    },
                    grid: {
                        drawOnChartArea: false, // Ẩn lưới trục phải để không bị rối
                    }
                },
                x: {
                    ticks: { color: '#94a3b8' },
                    grid: { display: false }
                }
            }
        }
    });
}
async function setMaintenance(status) {
    const data = {
        action: 'save_maintenance',
        maintenance_mode: status, // "ON" hoặc "OFF"
        time: new Date().toLocaleString()
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors', // Tránh lỗi CORS khi dùng Google Script
            body: JSON.stringify(data)
        });
        alert("Đã gửi lệnh: " + (status === "ON" ? "BẬT BẢO TRÌ" : "TẮT BẢO TRÌ"));
    } catch (e) {
        alert("Lỗi: " + e.message);
    }
}