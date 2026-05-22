const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs"); 

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());

// ===== STATIC IMAGE =====
app.use("/images", express.static(path.join(__dirname, "python/images")));

// =========================================================
// THÊM MỚI: BIẾN TOÀN CỤC LƯU FRAME HÌNH ẢNH AI TỪ PYTHON
// =========================================================
let latestPythonFrame = null;

// ===== SENSOR DATA =====
let sensorData = {
    temperature: 0,
    humidity: 0,
    gas: 0,
    motion: 0,
    distance: 0,
    updatedAt: null
};

// ===== CHỨC NĂNG MỚI KHÁC (GIỮ NGUYÊN) =====
let shouldBuzzerSound = 0; // 0: Tắt còi, 1: Bật còi kêu khẩn cấp

// ===== ALERT LIST =====
let alerts = [];

// Biến toàn cục lưu giữ trạng thái sống của luồng Python AI
let isPythonConnected = false;

// ===== SOCKET MANAGEMENT =====
io.on("connection", (socket) => {
    const userAgent = socket.handshake.headers["user-agent"] || "";
    let clientType = "Frontend Web";

    if (userAgent.includes("Python") || userAgent.includes("python")) {
        clientType = "Python AI Edge";
        isPythonConnected = true; // Cập nhật cờ trạng thái khi Python bật
        console.log(`[LOG] ỨNG DỤNG PYTHON AI ĐÃ KẾT NỐI! (ID: ${socket.id})`);
        io.emit("python-status", true); // Phát thông báo chấm xanh cho giao diện Web lập tức
    } else {
        console.log(`[LOG] Frontend đã kết nối. (ID: ${socket.id})`);
        // Gửi trạng thái hiện tại của Python cho riêng tab Web vừa bật
        socket.emit("python-status", isPythonConnected); 
    }

    // Lắng nghe lệnh yêu cầu kiểm tra thủ công từ Web
    socket.on("check-python-status", () => {
        socket.emit("python-status", isPythonConnected);
    });

    socket.emit("sensor-data", sensorData);
    socket.emit("alert-list", alerts);

    socket.on("disconnect", (reason) => {
        if (clientType === "Python AI Edge") {
            isPythonConnected = false; // Hạ cờ khi Python tắt app
            console.log(`[WARNING][Socket] PYTHON ĐÃ MẤT KẾT NỐI! (Lý do: ${reason})`);
            io.emit("python-status", false); // Phát thông báo chấm đỏ cho giao diện Web
        } else {
            console.log(`[WARNING] Frontend đã ngắt kết nối. (Lý do: ${reason})`);
        }
    });
});

// =========================================================
// THÊM MỚI: CÁC API PHỤC VỤ STREAM HÌNH ẢNH ĐỒNG BỘ
// =========================================================
app.post("/api/video-stream", express.raw({ type: 'image/jpeg', limit: '10mb' }), (req, res) => {
    latestPythonFrame = req.body;
    res.end();
});

app.get("/api/video-feed", (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
        'Cache-Control': 'no-cache',
        'Connection': 'close',
        'Pragma': 'no-cache'
    });

    const streamInterval = setInterval(() => {
        if (latestPythonFrame) {
            res.write(`--frame\r\n`);
            res.write(`Content-Type: image/jpeg\r\n`);
            res.write(`Content-Length: ${latestPythonFrame.length}\r\n\r\n`);
            res.write(latestPythonFrame);
            res.write(`\r\n`);
        }
    }, 40);

    req.on('close', () => {
        clearInterval(streamInterval);
    });
});

// ===== ESP32 DATA =====
app.post("/api/data", (req, res) => {
    sensorData = {
        ...req.body,
        updatedAt: new Date()
    };

    console.log("-----------------------------------------");
    console.log(`[LOG] [ESP32] Nhận chuỗi JSON gửi lên lúc: ${sensorData.updatedAt.toLocaleTimeString()}`);
    console.log(JSON.stringify(req.body, null, 2)); 
    console.log("-----------------------------------------");

    if (sensorData.gas > 2000) {
        console.log("[ALERT] CANH BAO GAS! Đã vượt ngưỡng an toàn.");
    }

    if (sensorData.temperature > 50) {
        console.log("[ALERT] CANH BAO NHIET DO! Thiết bị quá nóng.");
    }

    io.emit("sensor-data", sensorData);

    res.json({ 
        success: true,
        message: "Data received" 
    });
});

// ===== PYTHON ALERT =====
app.post("/api/alert", (req, res) => {
    const alert = {
        id: Date.now(),
        image: req.body.image,
        imageCrop: req.body.imageCrop, 
        zone: req.body.zone,
        enterTime: req.body.enterTime,
        exitTime: req.body.exitTime,
        duration: req.body.duration,
        createdAt: new Date(),
        sensor: sensorData
    };

    alerts.unshift(alert);

    console.log("=================================");
    console.log("[ALERT] PHÁT HIỆN XÂM NHẬP");
    console.log("Zone:", alert.zone);
    console.log("Vào lúc:", alert.enterTime);
    console.log("Ra lúc:", alert.exitTime);
    console.log("Ở lại:", alert.duration, "giây");
    console.log("Ảnh:", alert.image);
    console.log("Ảnh Crop:", alert.imageCrop);
    console.log("=================================");

    io.emit("new-alert", alert);

    res.json({
        success: true
    });
});

// ===== CÁC API PHỤC VỤ ĐIỀU KHIỂN CÒI BUZZER TỪ NÚT WEB =====
app.post("/api/buzzer/trigger", (req, res) => {
    shouldBuzzerSound = 1;
    console.log("[ALERT] Nút bấm trên Web yêu cầu bật còi Buzzer!");
    res.json({ success: true, message: "Buzzer state set to 1" });
});

app.get("/api/buzzer/status", (req, res) => {
    res.json({ buzzerAlert: shouldBuzzerSound });
});

app.post("/api/buzzer/reset", (req, res) => {
    shouldBuzzerSound = 0;
    console.log("[CLEAN] ESP32 báo cáo đã kêu xong. Reset cờ còi về 0.");
    res.json({ success: true, message: "Buzzer state reset to 0" });
});

// ===== API CLEAR TOÀN BỘ DỮ LIỆU HỆ THỐNG =====
app.post("/api/clear-all", (req, res) => {
    try {
        alerts = [];
        io.emit("alert-list", alerts);

        const logFilePath = path.join(__dirname, "python", "log.txt");
        const imagesFolderPath = path.join(__dirname, "python", "images");

        if (fs.existsSync(logFilePath)) {
            fs.unlinkSync(logFilePath);
            console.log("[CLEAN] Đã xóa file nhật ký log.txt.");
        }

        if (fs.existsSync(imagesFolderPath)) {
            const files = fs.readdirSync(imagesFolderPath);
            files.forEach((file) => {
                if (file.endsWith(".jpg") || file.endsWith(".jpeg") || file.endsWith(".png")) {
                    fs.unlinkSync(path.join(imagesFolderPath, file));
                }
            });
            console.log("[CLEAN] Đã dọn dẹp sạch toàn bộ kho ảnh lưu trữ trong python/images.");
        }

        res.json({
            success: true,
            message: "Xóa dữ liệu ổ cứng server thành công."
        });

    } catch (error) {
        console.error("[ERROR] Lỗi dọn dẹp tệp tin hệ thống:", error);
        res.status(500).json({ success: false, message: "Lỗi dọn dẹp dữ liệu server." });
    }
});

app.get("/api/data", (req, res) => {
    res.json(sensorData);
});

app.get("/", (req, res) => {
    res.send("IoT Backend Running");
});

// ===== START =====
server.listen(3000, () => {
    console.log("IoT Backend Running at http://localhost:3000");

    const { spawn } = require("child_process");
    const pythonScriptPath = path.join(__dirname, "python", "main.py");
    const pythonWorkingDirectory = path.join(__dirname, "python");

    console.log(`[SYS] Đang tự động kích hoạt tiến trình AI Python tại: ${pythonScriptPath}`);

    const pythonProcess = spawn("python3", [pythonScriptPath], {
        cwd: pythonWorkingDirectory
    });

    pythonProcess.stdout.on("data", (data) => {
        console.log(`[Python AI]: ${data.toString().trim()}`);
    });

    pythonProcess.stderr.on("data", (data) => {
        console.error(`[Python ERROR]: ${data.toString().trim()}`);
    });

    pythonProcess.on("close", (code) => {
        console.log(`[SYS] Tiến trình Python AI đã dừng hoạt động (Mã thoát: ${code})`);
    });
});