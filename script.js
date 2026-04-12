const API_URL =
  "https://script.google.com/macros/s/AKfycbz6ObgWgduEYIcyVVWGa5wZQLeDoOKu-ylIUTqNvvqPvXykUb8hLKDwpFh6fCEB1134lg/exec";
let configData = {};
let deleteTargetId = null;
let currentAddType = "price";
const CACHE_CONFIG = "admin_config_v3";
const CACHE_KEYS = "admin_keys_v3";
let allKeysData = [];
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
    if (key === "marquee")
      document.getElementById("config-marquee").value = value;
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
  const filter = document.getElementById("stat-time-filter")
    ? document.getElementById("stat-time-filter").value
    : "all";

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
        allKeysData = res.data;
        renderKeysTable(allKeysData);
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
  // Tạo bản sao để không ảnh hưởng dữ liệu gốc khi thao tác tìm kiếm
  const sortedList = [...dataList].sort((a, b) => {
    if (a.status === "Active" && b.status !== "Active") return -1;
    if (a.status !== "Active" && b.status === "Active") return 1;
    return 0; // Giữ nguyên thứ tự nếu cùng trạng thái
  });

  sortedList.forEach((item, index) => {
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
                <td class="key-code" style="display: flex; align-items: center; gap: 10px; justify-content: space-between;">
                    <span>${item.key}</span>
                    <button class="btn-icon-copy" onclick="copyKey('${item.key}')" title="Sao chép">
                        <i class="fa-solid fa-copy"></i>
                    </button>
                </td>
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

function searchKeys() {
  const keyword = document.getElementById("search-key-input") ? document.getElementById("search-key-input").value.toLowerCase().trim() : "";
  if (!keyword) {
    renderKeysTable(allKeysData);
    return;
  }

  const filteredData = allKeysData.filter((item) => {
    const keyMatch = item.key && String(item.key).toLowerCase().includes(keyword);
    const ownerMatch = item.owner && String(item.owner).toLowerCase().includes(keyword);
    return keyMatch || ownerMatch;
  });
  renderKeysTable(filteredData);
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

let isDeleting = false;
let deleteQueue = [];

// --- CHỨC NĂNG XÓA KEY (QUAN TRỌNG: Đã sửa bỏ no-cors) ---
function deleteKey(rowId) {
  // 1. Thêm vào hàng đợi và làm mờ (Bỏ confirm để xóa liên tiếp mượt hơn)
  const row = document.getElementById(`key-row-${rowId}`);
  if (row) {
    row.style.opacity = "0.3";
    row.style.pointerEvents = "none";
    deleteQueue.push(row);
  }
  processDeleteQueue();
}

function processDeleteQueue() {
  if (isDeleting || deleteQueue.length === 0) return;
  isDeleting = true;

  const row = deleteQueue.shift();
  // Lấy ID thật sự tại thời điểm gửi API (vì index có thể đã đổi do các lần xóa trước)
  const currentRowId = parseInt(row.id.replace("key-row-", ""));

  fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "delete_key", row: currentRowId }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.status === "success") {
        // Không gọi loadKeys() để tránh giật lag UI. Xử lý DOM tại chỗ.
        if (row.classList.contains("row-used")) {
          const usedEl = document.getElementById("stat-used");
          if (usedEl)
            usedEl.innerText = Math.max(0, parseInt(usedEl.innerText) - 1);
        } else {
          const activeEl = document.getElementById("stat-active");
          if (activeEl)
            activeEl.innerText = Math.max(0, parseInt(activeEl.innerText) - 1);
        }
        row.remove();

        // Cập nhật lại dữ liệu gốc trong bộ nhớ để Search không bị lỗi ID
        const indexToDelete = allKeysData.findIndex(k => k.id === currentRowId);
        if (indexToDelete !== -1) {
          allKeysData.splice(indexToDelete, 1);
          allKeysData.forEach(k => {
            if (k.id > currentRowId) k.id -= 1;
          });
        }

        // Giảm rowId và STT của các dòng bên dưới đi 1 để khớp với Google Sheet
        const allRows = document.querySelectorAll("#key-list-body tr");
        allRows.forEach((tr) => {
          const currentIdStr = tr.id.replace("key-row-", "");
          if (currentIdStr) {
            const currentId = parseInt(currentIdStr);
            if (currentId > currentRowId) {
              const newId = currentId - 1;
              tr.id = `key-row-${newId}`;

              const delBtn = tr.querySelector(".btn-icon-del");
              if (delBtn) delBtn.setAttribute("onclick", `deleteKey(${newId})`);

              const sttCell = tr.querySelector("td:first-child");
              if (sttCell && !isNaN(sttCell.innerText)) {
                sttCell.innerText = parseInt(sttCell.innerText) - 1;
              }
            }
          }
        });
      } else {
        showToast("Xóa thất bại!", "error");
        row.style.opacity = "1";
        row.style.pointerEvents = "auto";
      }
    })
    .catch((err) => {
      console.error(err);
      showToast("Lỗi kết nối!", "error");
      row.style.opacity = "1";
      row.style.pointerEvents = "auto";
    })
    .finally(() => {
      isDeleting = false;
      processDeleteQueue(); // Chạy vòng lặp tiếp theo nếu bạn xóa nhiều cái
    });
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
            <input type="text" id="${id}" value="${value}" readonly>
        </div>
        <button class="btn-edit" onclick="openEditModal('${id}')"><i class="fa-solid fa-pen"></i></button>
        <button class="btn-delete" onclick="triggerDelete('${id}')"><i class="fa-solid fa-trash"></i></button>
    `;
  document.getElementById(containerId).appendChild(div);
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
  } else if (type === "link") {
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

function openEditModal(id) {
  const inputEl = document.getElementById(id);
  if (!inputEl) return;

  document.getElementById("edit-item-id").value = id;
  document.getElementById("edit-item-value").value = inputEl.value;

  let key = getIdToKey(id);
  let prefix = key.startsWith("price_") ? "price_" : "link_";
  let labelName = key.replace(prefix, "").replace(/_/g, " ").toUpperCase();
  document.getElementById("modal-edit-title").innerText = "SỬA " + labelName;

  const m = document.getElementById("modal-edit");
  m.classList.add("show");
  setTimeout(() => document.getElementById("edit-item-value").focus(), 100);
}

function closeEditModal() {
  document.getElementById("modal-edit").classList.remove("show");
}

function confirmEdit() {
  const id = document.getElementById("edit-item-id").value;
  const newValue = document.getElementById("edit-item-value").value.trim();

  if (!newValue) {
    showToast("Vui lòng nhập giá trị!", "error");
    return;
  }

  const inputEl = document.getElementById(id);
  if (inputEl) {
    inputEl.value = newValue;
    configData[getIdToKey(id)] = newValue;
    closeEditModal();
    saveData();
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
  saveData();
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

    closeConfirmModal();
    saveData();
  }
}

// Lưu Cấu hình
function saveData() {
  document.getElementById("loading-overlay").classList.remove("hidden");

  // Bắt buộc khai báo action để Server nhận diện
  let payload = { action: "save_config" };

  // Giữ lại các cấu hình không hiển thị trên input (ví dụ như trạng thái bảo trì nếu có)
  for (let key in configData) {
    if (
      !key.startsWith("stats_") &&
      !key.startsWith("price_") &&
      !key.startsWith("link_")
    ) {
      payload[key] = configData[key];
    }
  }

  // Lấy dữ liệu mới nhất từ DOM (tránh trường hợp lệch dữ liệu)
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
      if (data.status === "success") {
        showToast("Đã tự động lưu cấu hình!", "success");
        // Phục hồi lại dữ liệu thống kê vào bộ nhớ tạm để tránh bị hiển thị lỗi hoặc giật lag khi reload trang
        payload.stats_revenue = configData.stats_revenue;
        payload.stats_orders = configData.stats_orders;
        localStorage.setItem(CACHE_CONFIG, JSON.stringify(payload));
      } else {
        showToast("Lỗi Server: " + data.msg, "error");
      }
    })
    .catch((err) => {
      showToast("Lỗi khi tự động lưu!", "error");
    })
    .finally(() => {
      document.getElementById("loading-overlay").classList.add("hidden");
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

function updateFixedConfig(key, value) {
  configData[key] = value.trim();
  saveData();
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("collapsed");
  document.getElementById("main-content").classList.toggle("expanded");
}

function copyKey(keyText) {
  navigator.clipboard
    .writeText(keyText)
    .then(() => {
      showToast("Đã sao chép: " + keyText, "success");
    })
    .catch((err) => {
      console.error("Lỗi sao chép:", err);
      showToast("Sao chép thất bại!", "error");
    });
}
