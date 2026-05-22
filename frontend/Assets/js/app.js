const BASE_URL = "http://localhost:3000";
const API_URL = `${BASE_URL}/api/data`;

const socket = io(BASE_URL, {
    transports: ["websocket"]
});

let notifications = JSON.parse(localStorage.getItem("notifications")) || [];
let lastGasAlert = null;
let lastMotionAlert = null;
let lastBackendAlert = null;
let lastEsp32ActiveTime = null;

const dotBackend = document.getElementById("statusBackend");
const dotPython = document.getElementById("statusPython");
const dotEsp32 = document.getElementById("statusEsp32");

socket.on("connect", () => {
    console.log("✅ SYSTEM SOCKET CONNECTED:", socket.id);
    if (dotBackend) {
        dotBackend.className = "dot dot-green";
    }
    socket.emit("check-python-status"); 
});

socket.on("disconnect", () => {
    console.log("❌ System socket disconnected");
    if (dotBackend) dotBackend.className = "dot dot-red";
    if (dotPython) dotPython.className = "dot dot-red";
});

socket.on("python-status", (isAlive) => {
    if (dotPython) {
        dotPython.className = isAlive ? "dot dot-green" : "dot dot-red";
    }
});

socket.on("sensor-data", (data) => {
    updateSensorUI(data);
    lastEsp32ActiveTime = Date.now(); 
    if (dotEsp32) dotEsp32.className = "dot dot-green";
});

socket.on("new-alert", (alert) => {
    const textHtml = `
        <strong>[ALERT] PHÁT HIỆN XÂM NHẬP</strong><br>
        Zone: ${alert.zone || "Không xác định"}<br>
        Vào lúc: ${alert.enterTime || "--"}<br>
        Ra lúc: ${alert.exitTime || "--"}<br>
        Ở lại: ${alert.duration || "0"} giây<br>
        Ảnh: ${alert.image || "Không có ảnh"}
    `;
    
    const alertObject = {
        text: textHtml,
        image: alert.image || "",
        imageCrop: alert.imageCrop || "" 
    };
    
    pushNotification(alertObject);
});

setInterval(() => {
    if (lastEsp32ActiveTime) {
        if (Date.now() - lastEsp32ActiveTime > 5000) {
            if (dotEsp32) dotEsp32.className = "dot dot-red";
        }
    } else {
        if (dotEsp32) dotEsp32.className = "dot dot-red";
    }
}, 2000);

async function getData() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        updateSensorUI(data);
        if (data.updatedAt) {
            lastEsp32ActiveTime = Date.now();
            if (dotEsp32) dotEsp32.className = "dot dot-green";
        }
    } catch (error) {
        console.log("Polling error:", error);
    }
}
setInterval(getData, 2000);
getData();

function updateSensorUI(data) {
    const tempEl = document.getElementById("temperature");
    if (tempEl) tempEl.innerHTML = data.temperature + " °C";

    const humEl = document.getElementById("humidity");
    if (humEl) humEl.innerHTML = data.humidity + " %";

    const gasEl = document.getElementById("gas");
    if (gasEl) {
        gasEl.innerHTML = data.gas;
        if (data.gas > 2000) {
            gasEl.className = "value warning";
            const msgObj = { text: `⚠ Gas vượt ngưỡng: ${data.gas}`, image: "", imageCrop: "" };
            if (msgObj.text !== lastGasAlert) {
                pushNotification(msgObj);
                lastGasAlert = msgObj.text;
            }
        } else {
            gasEl.className = "value safe";
        }
    }

    const updatedEl = document.getElementById("updatedAt");
    if (updatedEl) updatedEl.innerHTML = new Date(data.updatedAt).toLocaleTimeString();
}

function pushNotification(alertObj) {
    const last = notifications[notifications.length - 1];
    if (!last || last.text !== alertObj.text) {
        notifications.push(alertObj);
        localStorage.setItem("notifications", JSON.stringify(notifications));
        updateNotificationUI();
    }
}

function updateNotificationUI() {
    const countEl = document.getElementById("notificationCount");
    const list = document.getElementById("notificationList");

    if (!countEl || !list) return;

    countEl.innerText = notifications.length;
    list.innerHTML = "";

    if (notifications.length === 0) {
        const emptyItem = document.createElement("div");
        emptyItem.className = "notification-empty";
        emptyItem.innerText = "Không có thông báo nào !";
        list.appendChild(emptyItem);
        return; 
    }

    notifications.slice(-5).reverse().forEach(itemData => {
        const item = document.createElement("div");
        item.className = "notification-item";
        
        const fullImg = itemData.image || "";
        const cropImg = itemData.imageCrop || "";

        item.setAttribute("data-img", fullImg);
        item.setAttribute("data-crop", cropImg);

        item.innerHTML = `
            <div class="notification-icon">🔔</div>
            <div class="notification-text">${itemData.text}</div>
        `;

        if (!fullImg && !cropImg) {
            item.style.cursor = "default";
            item.style.pointerEvents = "none"; 
        } else {
            item.addEventListener("click", () => {
                openImageModal(fullImg, cropImg);
            });
        }

        list.appendChild(item);
    });
}

function openImageModal(fullImg, cropImg) {
    const modal = document.getElementById("imageModal");
    const modalFull = document.getElementById("modalFullImage");
    const modalCrop = document.getElementById("modalCropImage");
    const cropContainer = document.getElementById("cropImageContainer");
    
    const STATIC_IMAGE_PATH = `${BASE_URL}/images/`;

    if (fullImg) {
        modalFull.src = STATIC_IMAGE_PATH + fullImg;
    } else {
        modalFull.src = "";
        modalFull.alt = "Lượt xâm nhập nhanh (Dưới 3s), không kích hoạt lưu ảnh toàn cảnh.";
    }

    if (cropImg) {
        modalCrop.src = STATIC_IMAGE_PATH + cropImg;
        cropContainer.classList.remove("hide-crop-box"); 
    } else {
        modalCrop.src = "";
        cropContainer.classList.add("hide-crop-box");  
    }

    modal.style.display = "flex";
}

document.addEventListener("DOMContentLoaded", () => {
    const modal = document.getElementById("imageModal");
    const closeBtn = document.getElementById("closeModalBtn");

    if (closeBtn && modal) {
        closeBtn.addEventListener("click", () => modal.style.display = "none");
        window.addEventListener("click", (e) => {
            if (e.target === modal) modal.style.display = "none";
        });
    }
});

document.addEventListener("DOMContentLoaded", () => {
    const bell = document.getElementById("notificationBell");
    const dropdown = document.getElementById("notificationDropdown");
    if (!bell || !dropdown) return;

    bell.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
    });
    document.addEventListener("click", () => dropdown.style.display = "none");
});

const viewMoreBtn = document.querySelector(".view-more");
if (viewMoreBtn) {
    viewMoreBtn.addEventListener("click", () => {
        localStorage.setItem("notifications", JSON.stringify(notifications));
        window.location.href = "notifications.html";
    });
}

const alertBtn = document.getElementById("alertBtn");
if (alertBtn) {
    alertBtn.addEventListener("click", async () => {
        try {
            const response = await fetch(`${BASE_URL}/api/buzzer/trigger`, {
                method: "POST"
            });
            const data = await response.json();
            if(data.success) {
                alert("🚨 Đã phát tín hiệu kích hoạt còi hú trên thiết bị ESP32 khẩn cấp!");
            }
        } catch (error) {
            console.log("Error triggering buzzer:", error);
            alert("❌ Không thể kết nối tới server để kích hoạt còi!");
        }
    });
}

updateNotificationUI();

// LOGIC ĐIỀU KHIỂN HOẠT ĐỘNG CHUYỂN ĐỔI DARK MODE
document.addEventListener("DOMContentLoaded", () => {
    const darkModeToggle = document.getElementById("darkModeToggle");
    const body = document.body;

    if (localStorage.getItem("darkMode") === "enabled") {
        body.classList.add("dark-mode");
        if (darkModeToggle) darkModeToggle.innerText = "☀️";
    }

    if (darkModeToggle) {
        darkModeToggle.addEventListener("click", () => {
            body.classList.toggle("dark-mode");
            if (body.classList.contains("dark-mode")) {
                localStorage.setItem("darkMode", "enabled");
                darkModeToggle.innerText = "☀️";
            } else {
                localStorage.setItem("darkMode", "disabled");
                darkModeToggle.innerText = "🌙";
            }
        });
    }
});