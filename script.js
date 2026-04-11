const API_URL =
  "https://script.google.com/macros/s/AKfycbz6ObgWgduEYIcyVVWGa5wZQLeDoOKu-ylIUTqNvvqPvXykUb8hLKDwpFh6fCEB1134lg/exec";
let configData = {};
let deleteTargetId = null;
let currentAddType = "price";
const CACHE_CONFIG = "admin_config_v3";
const CACHE_KEYS = "admin_keys_v3";
function getIdToKey(id) {
  return id.replace(/-/g, "_");
}
function getKeyToId(key) {
  return key.replace(/_/g, "-");
}
function formatMoney(n) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(n);
}
function showToast(msg, type = "success") {
  const t = document.getElementById("custom-toast");
  const m = document.getElementById("toast-message");
  const i = t.querySelector(".toast-icon");
  t.className = "";
  void t.offsetWidth;
  m.innerText = msg;

  if (type === "success") {
    t.classList.add("show", "success");
    i.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
  } else {
    t.classList.add("show", "error");
    i.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i>';
  }
  setTimeout(() => {
    t.classList.remove("show");
  }, 3000);
}
document.addEventListener("DOMContentLoaded", function () {
  const cachedConfig = localStorage.getItem(CACHE_CONFIG);
  if (cachedConfig) {
    let data = JSON.parse(cachedConfig);
    if (data.status === "success" && data.data) data = data.data;

    renderConfigUI(data);
    document.getElementById("loading-overlay").classList.add("hidden");
    fetchConfig(true);
  } else {
    fetchConfig(false);
  }
  loadStats();
  startRealtimeUsers();
});

function fetchConfig(isBackground = false) {
  if (!isBackground)
    document.getElementById("loading-overlay").classList.remove("hidden");
  fetch(API_URL + "?t=" + Date.now())
    .then((res) => res.json())
    .then((data) => {
      const finalData =
        data.status === "success" && data.data ? data.data : data;

      localStorage.setItem(CACHE_CONFIG, JSON.stringify(finalData));
      renderConfigUI(finalData);
      document.getElementById("loading-overlay").classList.add("hidden");
    })
    .catch((err) => {
      console.error(err);
      if (!isBackground) showToast("Lỗi kết nối Server!", "error");
      document.getElementById("loading-overlay").classList.add("hidden");
    });
}
function renderConfigUI(data) {
  configData = data;
  document.getElementById("price-container").innerHTML = "";
  document.getElementById("link-container").innerHTML = "";
  const selectType = document.getElementById("import-type");
  selectType.innerHTML = "";
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("price_")) {
      renderInput("price-container", key, value);
      let opt = document.createElement("option");
      opt.value = key;
      opt.innerText = key.replace("price_", "").toUpperCase();
      selectType.appendChild(opt);
    } else if (key.startsWith("link_")) {
      renderInput("link-container", key, value);
    }
  }
  if (data.stats_revenue !== undefined) {
    document.getElementById("view-revenue").innerText = formatMoney(
      data.stats_revenue,
    );
    document.getElementById("view-orders").innerText = data.stats_orders;
  }
}

function loadStats() {
  const revEl = document.getElementById("view-revenue");
  const orderEl = document.getElementById("view-orders");
  const filter = document.getElementById("stat-time-filter") ? document.getElementById("stat-time-filter").value : "all";

  if (revEl)
    revEl.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin" style="font-size: 1.5rem;"></i>';
  if (orderEl)
    orderEl.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin" style="font-size: 1.5rem;"></i>';

  fetch(`${API_URL}?action=get_stats&filter=${filter}&t=${Date.now()}`)
    .then((res) => res.json())
    .then((res) => {
      if (res && res.status === "success" && res.data) {
        const data = res.data;
        if (revEl) revEl.innerText = formatMoney(data.stats_revenue || 0);
        if (orderEl) orderEl.innerText = data.stats_orders || 0;
      } else {
        if (revEl) revEl.innerText = "0 đ";
        if (orderEl) orderEl.innerText = "0";
      }
    })
    .catch((err) => {
      console.error("Lỗi khi tải thống kê:", err);
      if (revEl) revEl.innerText = "Lỗi";
      if (orderEl) orderEl.innerText = "Lỗi";
    });
}

function loadKeys() {
  const tbody = document.getElementById("key-list-body");
  if (!tbody) return;

  tbody.innerHTML =
    '<tr><td colspan="6" style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải dữ liệu...</td></tr>';

  fetch(`${API_URL}?action=get_all_keys&t=${Date.now()}`)
    .then((res) => res.json())
    .then((res) => {
      // Kiểm tra res và res.data để tránh lỗi undefined
      if (res && res.status === "success" && Array.isArray(res.data)) {
        renderKeysTable(res.data);
      } else {
        tbody.innerHTML =
          '<tr><td colspan="6" style="text-align:center;">Lỗi: Dữ liệu không hợp lệ</td></tr>';
        console.error("Dữ liệu sai:", res);
      }
    })
    .catch((err) => {
      console.error("Lỗi kết nối:", err);
      tbody.innerHTML =
        '<tr><td colspan="6" style="text-align:center; color:red;">Lỗi kết nối Server!</td></tr>';
    });
}

function renderKeysTable(dataList) {
  const tbody = document.getElementById("key-list-body");
  tbody.innerHTML = "";
  let activeCount = 0;
  let usedCount = 0;

  if (!dataList || dataList.length == 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align:center; padding:20px;">Kho đang trống</td></tr>';
    return;
  }

  // --- BƯỚC SẮP XẾP: Đẩy 'Active' lên đầu, 'Used' xuống cuối ---
  dataList.sort((a, b) => {
    if (a.status === "Active" && b.status !== "Active") return -1;
    if (a.status !== "Active" && b.status === "Active") return 1;
    return 0; // Giữ nguyên thứ tự nếu cùng trạng thái
  });

  dataList.forEach((item, index) => {
    // Đếm số lượng
    if (item.status == "Active") activeCount++;
    else usedCount++;

    // Giao diện Badge
    let statusBadge =
      item.status == "Active"
        ? `<span class="status-badge status-active">Sẵn sàng</span>`
        : `<span class="status-badge status-used">Đã bán</span>`;

    let typeName = item.type
      ? item.type.replace("price_", "").replace(/_/g, " ").toUpperCase()
      : "KHÁC";

    // Vẽ hàng
    tbody.innerHTML += `
            <tr id="key-row-${item.id}" class="${item.status == "Active" ? "" : "row-used"}">
                <td>${index + 1}</td>
                <td class="key-code">${item.key}</td>
                <td style="color:var(--primary); font-weight:600;">${typeName}</td>
                <td>${statusBadge}</td>
                <td style="color:#aaa;">${item.owner || "Chưa có"}</td>
                <td style="text-align:center;">
                    <button class="btn-icon-del" onclick="deleteKey(${item.id})">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
  });

  document.getElementById("stat-active").innerText = activeCount;
  document.getElementById("stat-used").innerText = usedCount;
}

// --- CHỨC NĂNG NẠP KEY (Đã sửa bỏ no-cors) ---
function importKeys() {
  const text = document.getElementById("bulk-keys").value.trim();
  const type = document.getElementById("import-type").value;

  if (!text) {
    showToast("Vui lòng nhập key!", "error");
    return;
  }
  if (!type) {
    showToast("Vui lòng chọn loại gói!", "error");
    return;
  }

  const keys = text
    .split("\n")
    .map((k) => k.trim())
    .filter((k) => k !== "");
  const btn = document.querySelector("#modal-import-key .btn-confirm");

  btn.innerText = "Đang nạp...";
  btn.disabled = true;

  // Gửi yêu cầu chuẩn (không dùng no-cors)
  fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" }, // Dùng text/plain để tránh preflight cors phức tạp của Google
    body: JSON.stringify({ action: "add_keys", keys: keys, type: type }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.status === "success") {
        showToast(`Đã nạp thành công ${keys.length} key!`, "success");
        document.getElementById("modal-import-key").classList.remove("show");
        document.getElementById("bulk-keys").value = "";
        loadKeys(); // Tải lại bảng ngay lập tức
      } else {
        showToast("Lỗi Server: " + data.msg, "error");
      }
      btn.innerText = "Nạp Ngay";
      btn.disabled = false;
    })
    .catch((err) => {
      console.error(err);
      showToast("Lỗi kết nối!", "error");
      btn.innerText = "Nạp Ngay";
      btn.disabled = false;
    });
}

// --- CHỨC NĂNG XÓA KEY (QUAN TRỌNG: Đã sửa bỏ no-cors) ---
function deleteKey(rowId) {
  if (confirm("Bạn muốn xóa Key này vĩnh viễn?")) {
    // Hiệu ứng xóa ngay trên giao diện cho mượt (Optimistic UI)
    const row = document.getElementById(`key-row-${rowId}`);
    if (row) row.style.opacity = "0.3";

    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "delete_key", row: rowId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "success") {
          showToast("Đã xóa key thành công!", "success");
          loadKeys(); // Tải lại dữ liệu sạch từ server
        } else {
          showToast("Xóa thất bại!", "error");
          if (row) row.style.opacity = "1"; // Hồi phục nếu lỗi
        }
      })
      .catch((err) => {
        console.error(err);
        showToast("Lỗi kết nối!", "error");
        if (row) row.style.opacity = "1";
      });
  }
}

// ============================================================
// 5. CÁC HÀM GIAO DIỆN KHÁC
// ============================================================

function renderInput(containerId, key, value) {
  const id = getKeyToId(key);
  let prefix = key.startsWith("price_") ? "price_" : "link_";
  let labelName = key.replace(prefix, "").replace(/_/g, " ").toUpperCase();

  if (document.getElementById(`row-${id}`)) return;

  const div = document.createElement("div");
  div.className = "dynamic-row";
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

function updateValue(id, val) {
  configData[getIdToKey(id)] = val;
}

function openModal(type) {
  currentAddType = type;
  const title = document.getElementById("modal-title");
  const phName = document.getElementById("new-item-name");
  const phValue = document.getElementById("new-item-value");

  if (type === "price") {
    title.innerText = "THÊM GÓI GIÁ";
    phName.placeholder = "Tên gói (VD: Gói VIP 1 Tháng)";
    phValue.placeholder = "Giá tiền (VD: 50000 - Chỉ nhập số)";
  } else {
    title.innerText = "THÊM LINK TẢI";
    phName.placeholder = "Tên game (VD: Liên Quân iOS)";
    phValue.placeholder = "Đường dẫn tải (VD: https://...)";
  }
  toggleModal(true);
}

function toggleModal(show) {
  const m = document.getElementById("modal-add");
  if (show) {
    document.getElementById("new-item-name").value = "";
    document.getElementById("new-item-value").value = "";
    m.classList.add("show");
    setTimeout(() => document.getElementById("new-item-name").focus(), 100);
  } else {
    m.classList.remove("show");
  }
}

function confirmAddItem() {
  const name = document.getElementById("new-item-name").value.trim();
  const value = document.getElementById("new-item-value").value.trim();

  if (!name || !value) {
    showToast("Vui lòng nhập đủ!", "error");
    return;
  }

  let cleanName = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ /g, "_");
  let prefix = currentAddType === "price" ? "price_" : "link_";
  let newKey = prefix + cleanName;
  let newId = getKeyToId(newKey);

  if (document.getElementById(`row-${newId}`)) {
    showToast("Đã tồn tại!", "error");
    return;
  }

  renderInput(
    currentAddType === "price" ? "price-container" : "link-container",
    newKey,
    value,
  );
  configData[newKey] = value;
  toggleModal(false);
  showToast("Đã thêm (Hãy bấm Lưu)", "success");
}

// Xóa Cấu hình (Modal Đỏ)
function triggerDelete(id) {
  deleteTargetId = id;
  document.getElementById("modal-confirm").classList.add("show");
}
function closeConfirmModal() {
  deleteTargetId = null;
  document.getElementById("modal-confirm").classList.remove("show");
}
function executeDelete() {
  if (deleteTargetId) {
    const row = document.getElementById(`row-${deleteTargetId}`);
    if (row) row.remove();

    const key = getIdToKey(deleteTargetId);
    delete configData[key];

    showToast("Đã xóa mục này!", "success");
    closeConfirmModal();
  }
}

// Lưu Cấu hình
function saveData() {
  const btn = document.querySelector(".btn-save-mini");
  const originalHTML = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';
  btn.disabled = true;

  // Gom dữ liệu mới nhất từ DOM
  let payload = {};
  document.querySelectorAll(".dynamic-row input").forEach((input) => {
    let key = getIdToKey(input.id);
    payload[key] = input.value;
  });

  fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  })
    .then((res) => res.json())
    .then((data) => {
      showToast("Đã lưu thành công!", "success");
      localStorage.setItem(CACHE_CONFIG, JSON.stringify(payload));
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    })
    .catch((err) => {
      showToast("Lỗi khi lưu!", "error");
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    });
}

function switchTab(tabName, el) {
  // Xóa active ở menu và nội dung cũ
  document
    .querySelectorAll(".menu-item")
    .forEach((i) => i.classList.remove("active"));
  el.classList.add("active");
  document
    .querySelectorAll(".tab-content")
    .forEach((c) => c.classList.remove("active"));
  document.getElementById("tab-" + tabName).classList.add("active");

  // Tải dữ liệu tương ứng với từng tab
  if (tabName === "keys") {
    loadKeys();
  } else if (tabName === "stats") {
    loadStats();
  }
}

let realtimeInterval;
function startRealtimeUsers() {
  const usersEl = document.getElementById("realtime-users");
  if (!usersEl) return;

  if (realtimeInterval) clearInterval(realtimeInterval);

  const fetchOnlineUsers = () => {
    fetch(`${API_URL}?action=get_online_users&t=${Date.now()}`)
      .then((res) => res.json())
      .then((res) => {
        if (res && res.status === "success" && res.data) {
          usersEl.style.opacity = "0.5";
          setTimeout(() => {
            usersEl.innerText = res.data.online_users || 0;
            usersEl.style.opacity = "1";
          }, 150);
        }
      })
      .catch((err) => console.error("Lỗi lấy dữ liệu online:", err));
  };

  // Gọi API ngay lần đầu tiên
  fetchOnlineUsers();

  // Thiết lập gọi ngầm định kỳ mỗi 10 giây (Polling)
  realtimeInterval = setInterval(fetchOnlineUsers, 10000);
}
async function setMaintenance(status) {
  const data = {
    action: "save_maintenance",
    maintenance_mode: status, // "ON" hoặc "OFF"
    time: new Date().toLocaleString(),
  };

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      mode: "no-cors", // Tránh lỗi CORS khi dùng Google Script
      body: JSON.stringify(data),
    });
    alert("Đã gửi lệnh: " + (status === "ON" ? "BẬT BẢO TRÌ" : "TẮT BẢO TRÌ"));
  } catch (e) {
    alert("Lỗi: " + e.message);
  }
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("collapsed");
  document.getElementById("main-content").classList.toggle("expanded");
}
