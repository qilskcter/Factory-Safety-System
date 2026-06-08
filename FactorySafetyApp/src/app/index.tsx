import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, Image, Alert, SafeAreaView 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage'; // THÊM: Import AsyncStorage để đồng bộ offline
import io from 'socket.io-client';
import { BASE_URL, API_URL } from '../constants/config';
import ImageModal from '../components/ImageModal';
import NotificationsScreen from '../screens/NotificationsScreen';

export default function HomeScreen() {
  // Navigation & UI State
  const [currentScreen, setCurrentScreen] = useState('Home'); 
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Data & Connection States
  const [sensorData, setSensorData] = useState({ 
    temperature: '--', 
    humidity: '--', 
    gas: '--', 
    alertReason: 'An toàn', 
    updatedAt: null 
  });
  const [notifications, setNotifications] = useState<any[]>([]);
  const [statusBackend, setStatusBackend] = useState(false);
  const [statusPython, setStatusPython] = useState(false);
  const [statusEsp32, setStatusEsp32] = useState(false);

  // Quản lý khung hình Stream gối đầu (Snapshot) tránh lỗi đen màn hình
  const [streamTimestamp, setStreamTimestamp] = useState(Date.now());
  const isStreaming = useRef(false);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);

  const lastEsp32ActiveTime = useRef<number | null>(null);
  const socket = useRef<any>(null);
  const lastSystemReason = useRef<string>("An toàn");

  // Hàm kích hoạt nạp khung hình tiếp theo bằng Snapshot chống nghẽn luồng di động
  const triggerNextFrame = () => {
    if (!isStreaming.current) return;
    setTimeout(() => {
      setStreamTimestamp(Date.now());
    }, 40); // ~25 FPS mượt mà
  };

  useEffect(() => {
    if (statusPython) {
      isStreaming.current = true;
      triggerNextFrame();
    } else {
      isStreaming.current = false;
    }
  }, [statusPython]);

  // BLOCK 1: Quản lý WebSocket kết nối thời gian thực
  useEffect(() => {
    socket.current = io(BASE_URL, { transports: ['websocket'] });

    socket.current.on('connect', () => {
      setStatusBackend(true);
      socket.current.emit('check-python-status');
    });

    socket.current.on('disconnect', () => {
      setStatusBackend(false);
      setStatusPython(false);
    });

    socket.current.on('python-status', (isAlive: boolean) => {
      setStatusPython(isAlive);
    });

    socket.current.on('sensor-data', (data: any) => {
      handleSensorUpdate(data);
    });

    socket.current.on('new-alert', (alert: any) => {
      const formattedText = `[ALERT] PHÁT HIỆN XÂM NHẬP\nZone: ${alert.zone || "Không xác định"}\nVào lúc: ${alert.enterTime || "--"}\nRa lúc: ${alert.exitTime || "--"}\nỞ lại: ${alert.duration || "0"} giây`;
      
      const alertObject = {
        text: formattedText,
        image: alert.image || "",
        imageCrop: alert.imageCrop || ""
      };

      setNotifications((prev): any => {
        const last: any = prev[prev.length - 1];
        if (!last || last.text !== alertObject.text) {
          return [...prev, alertObject];
        }
        return prev;
      });
    });

    // THÊM TẠI ĐÂY: Lắng nghe tín hiệu xóa lịch sử đồng bộ từ hệ thống Server gửi về
    socket.current.on('history-cleared', async () => {
      console.log("🔄 [SYNC] Nhận lệnh đồng bộ: Xóa lịch sử thông báo qua index.tsx");
      try {
        setNotifications([]);
        await AsyncStorage.removeItem('local_notifications');
      } catch (err) {
        console.log("Lỗi đồng bộ xóa dữ liệu:", err);
      }
    });

    const fallbackFetch = setInterval(async () => {
      try {
        const response = await fetch(API_URL);
        const data = await response.json();
        handleSensorUpdate(data);
      } catch (e) {
        console.log("Local polling error:", e);
      }
    }, 2000);

    const espCheck = setInterval(() => {
      if (lastEsp32ActiveTime.current) {
        if (Date.now() - lastEsp32ActiveTime.current > 5000) {
          setStatusEsp32(false);
        }
      } else {
        setStatusEsp32(false);
      }
    }, 2000);

    return () => {
      if (socket.current) socket.current.disconnect();
      isStreaming.current = false;
      clearInterval(fallbackFetch);
      clearInterval(espCheck);
    };
  }, []);

  // BLOCK 2: Đọc dữ liệu lịch sử từ bộ nhớ máy lên RAM khi khởi động
  useEffect(() => {
    const loadLocalNotifications = async () => {
      try {
        const saved = await AsyncStorage.getItem('local_notifications');
        if (saved) {
          setNotifications(JSON.parse(saved));
        }
      } catch (err) {
        console.log("Lỗi tải thông báo local:", err);
      }
    };
    loadLocalNotifications();
  }, []);

  // BLOCK 3: Tự động ghi dữ liệu vào ổ cứng máy ngay khi danh sách RAM notifications thay đổi
  useEffect(() => {
    const saveNotifications = async () => {
      try {
        if (notifications && notifications.length > 0) {
          await AsyncStorage.setItem('local_notifications', JSON.stringify(notifications));
        }
      } catch (err) {
        console.log("Lỗi khi ghi lịch sử thông báo:", err);
      }
    };
    saveNotifications();
  }, [notifications]);

  const handleSensorUpdate = (data: any) => {
    setSensorData({
      temperature: data.temperature,
      humidity: data.humidity,
      gas: data.gas,
      alertReason: data.alertReason || "An toàn",
      updatedAt: data.updatedAt ? new Date(data.updatedAt).toLocaleTimeString() : '--'
    });

    if (data.updatedAt) {
      lastEsp32ActiveTime.current = Date.now();
      setStatusEsp32(true);
    }

    if (data.alertReason && data.alertReason !== "An toàn" && data.alertReason !== lastSystemReason.current) {
      const systemAlertObj = {
        text: `[ESP32 ALERT]\nNội dung: ${data.alertReason}\nThời gian: ${new Date().toLocaleTimeString()}`,
        image: "",
        imageCrop: ""
      };
      setNotifications((prev): any => [...prev, systemAlertObj]);
      lastSystemReason.current = data.alertReason;
    } else if (data.alertReason === "An toàn") {
      lastSystemReason.current = "An toàn";
    }
  };

  const triggerBuzzerAlert = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/buzzer/trigger`, { method: 'POST' });
      const data = await response.json();
      if(data.success) {
        Alert.alert("🚨 Thông báo", "Đã phát tín hiệu kích hoạt còi hú khẩn cấp!");
      }
    } catch (error) {
      Alert.alert("❌ Lỗi", "Không thể kết nối tới server mạng cục bộ!");
    }
  };

  const openImageDetail = (alertObj: any) => {
    setSelectedAlert(alertObj);
    setModalVisible(true);
  };

  const isDanger = sensorData.alertReason && sensorData.alertReason !== "An toàn";

  if (currentScreen === 'Notifications') {
    return (
      <NotificationsScreen 
        notifications={notifications}
        setNotifications={setNotifications}
        isDarkMode={isDarkMode}
        onBack={() => setCurrentScreen('Home')}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode ? styles.darkBg : styles.lightBg]}>
      <View style={styles.mainContainer}>
        
        <View style={styles.fixedHeaderSection}>
          <Text style={[styles.appTitle, isDarkMode ? styles.darkTextMain : styles.lightTextMain]}>
            FACTORY SAFETY SYSTEM
          </Text>

          <View style={styles.sensorContainer}>
            <View style={[styles.sensorCard, isDarkMode ? styles.darkCardInner : styles.lightCardInner]}>
              <Text style={[styles.cardTitle, isDarkMode ? styles.darkTextSub : styles.lightTextSub]}>Nhiệt độ</Text>
              <Text style={[styles.cardValue, isDarkMode ? styles.darkTextMain : styles.lightTextMain]}>
                {sensorData.temperature} °C
              </Text>
            </View>
            <View style={[styles.sensorCard, isDarkMode ? styles.darkCardInner : styles.lightCardInner]}>
              <Text style={[styles.cardTitle, isDarkMode ? styles.darkTextSub : styles.lightTextSub]}>Độ ẩm</Text>
              <Text style={[styles.cardValue, isDarkMode ? styles.darkTextMain : styles.lightTextMain]}>
                {sensorData.humidity} %
              </Text>
            </View>
            <View style={[styles.sensorCard, isDarkMode ? styles.darkCardInner : styles.lightCardInner]}>
              <Text style={[styles.cardTitle, isDarkMode ? styles.darkTextSub : styles.lightTextSub]}>Khí Gas</Text>
              <Text style={[
                styles.cardValue, 
                Number(sensorData.gas) > 2000 ? styles.warningText : styles.safeText
              ]}>
                {sensorData.gas}
              </Text>
            </View>
          </View>

          <View style={styles.controlsRowWrap}>
            <View style={[
              styles.systemReasonMiniCard, 
              isDanger ? styles.dangerCardBg : (isDarkMode ? styles.darkCardInner : styles.lightCardInner)
            ]}>
              <Text style={[styles.reasonTitle, isDanger ? styles.whiteText : (isDarkMode ? styles.darkTextSub : styles.lightTextSub)]}>
                Lý do cảnh báo
              </Text>
              <Text numberOfLines={1} style={[styles.reasonText, { color: isDanger ? '#ffffff' : 'green' }]}>
                {sensorData.alertReason}
              </Text>
            </View>

            <View style={styles.rightButtonsContainer}>
              <TouchableOpacity style={[styles.circleBtn, isDarkMode ? styles.darkCardInner : styles.lightCardInner]} onPress={() => setIsDarkMode(!isDarkMode)}>
                <Text style={{ fontSize: 20 }}>{isDarkMode ? "☀️" : "🌙"}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.alertBtn} onPress={triggerBuzzerAlert}>
                <Text style={styles.alertBtnText}>ALERT</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.circleBtn, isDarkMode ? styles.darkCardInner : styles.lightCardInner]} onPress={() => setShowDropdown(!showDropdown)}>
                <Text style={{ fontSize: 20 }}>🔔</Text>
                <View style={styles.badge}><Text style={styles.badgeText}>{notifications.length}</Text></View>
              </TouchableOpacity>
            </View>
          </View>

          {showDropdown && (
            <View style={[styles.dropdown, isDarkMode ? styles.darkDropdown : styles.lightDropdown]}>
              <Text style={[styles.dropdownHeader, { color: isDarkMode ? '#e0e0e0' : '#111111' }]}>Thông báo mới nhất</Text>
              {notifications.length === 0 ? (
                <Text style={styles.emptyNotify}>Không có thông báo nào !</Text>
              ) : (
                notifications.slice(-2).reverse().map((item: any, idx: number) => (
                  <TouchableOpacity 
                    key={idx} style={[styles.dropdownItem, { borderColor: isDarkMode ? '#333' : '#ddd' }]}
                    onPress={() => { setShowDropdown(false); openImageDetail(item); }}
                  >
                    <Text numberOfLines={1} style={{ color: isDarkMode ? '#b0b0b0' : '#444444', fontSize: 12 }}>
                      {item.text.replace(/\[ESP32 ALERT\]\n/g, '🔔 ESP: ').replace(/\[ALERT\] PHÁT HIỆN XÂM NHẬP\n/g, '🚷 ')}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
              <TouchableOpacity onPress={() => { setShowDropdown(false); setCurrentScreen('Notifications'); }}>
                <Text style={styles.viewMoreText}>Xem tất cả lịch sử</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.cameraContainerFixed}>
          {statusPython ? (
            <Image
              source={{ 
                uri: `${BASE_URL}/api/video-snapshot?t=${streamTimestamp}`, 
                cache: 'reload', 
                headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
              }}
              style={styles.pythonStreamView}
              resizeMode="contain"
              onLoad={triggerNextFrame}   
              onError={triggerNextFrame}  
            />
          ) : (
            <View style={styles.cameraOfflineView}>
              <Text style={{ color: '#888888', fontSize: 13, fontWeight: 'bold' }}>
                Đang kết nối luồng xử lý từ Python AI...
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.updatedFooter, isDarkMode ? styles.darkCardInner : styles.lightCardInner]}>
          <Text style={[styles.updateTimeText, isDarkMode ? styles.darkTextSub : styles.lightTextSub]}>
            Update: <Text style={{ fontWeight: 'bold' }}>{sensorData.updatedAt || '--'}</Text>
          </Text>
          <View style={styles.connectionStatus}>
            <View style={styles.statusItem}>
              <View style={[styles.dot, statusBackend ? styles.dotGreen : styles.dotRed]} />
              <Text style={[styles.statusLabel, isDarkMode ? styles.darkTextSub : styles.lightTextSub]}>Server</Text>
            </View>
            <View style={styles.statusItem}>
              <View style={[styles.dot, statusPython ? styles.dotGreen : styles.dotRed]} />
              <Text style={[styles.statusLabel, isDarkMode ? styles.darkTextSub : styles.lightTextSub]}>AI</Text>
            </View>
            <View style={styles.statusItem}>
              <View style={[styles.dot, statusEsp32 ? styles.dotGreen : styles.dotRed]} />
              <Text style={[styles.statusLabel, isDarkMode ? styles.darkTextSub : styles.lightTextSub]}>ESP32</Text>
            </View>
          </View>
        </View>

      </View>

      <ImageModal 
        visible={modalVisible} 
        onClose={() => setModalVisible(false)} 
        alertData={selectedAlert} 
        isDarkMode={isDarkMode} 
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  lightBg: { backgroundColor: '#f4f4f4' },
  darkBg: { backgroundColor: '#121212' },
  mainContainer: { flex: 1, padding: 12, justifyContent: 'flex-start', alignItems: 'center', width: '100%' },
  fixedHeaderSection: { width: '100%', zIndex: 50, marginBottom: 10 },
  appTitle: { fontSize: 22, fontWeight: 'bold', letterSpacing: 1, textAlign: 'center', marginTop: 65, marginBottom: 12 },
  lightTextMain: { color: '#111111' },
  darkTextMain: { color: '#e0e0e0' },
  lightTextSub: { color: '#555555' },
  darkTextSub: { color: '#b0b0b0' },
  whiteText: { color: '#ffffff' },
  sensorContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 8, marginBottom: 10 },
  sensorCard: { flex: 1, padding: 10, borderRadius: 10, height: 72, justifyContent: 'center', elevation: 2 },
  lightCardInner: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#ddd' },
  darkCardInner: { backgroundColor: '#1e1e1e', borderWidth: 1, borderColor: '#333333' },
  dangerCardBg: { backgroundColor: '#d9534f', borderWidth: 1, borderColor: '#c9302c' },
  cardTitle: { fontSize: 13, marginBottom: 2, fontWeight: 'bold' },
  cardValue: { fontSize: 20, fontWeight: 'bold' },
  safeText: { color: 'green' },
  warningText: { color: 'red' },
  controlsRowWrap: { flexDirection: 'row', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  systemReasonMiniCard: { flex: 1.2, paddingHorizontal: 10, borderRadius: 10, height: 52, justifyContent: 'center', elevation: 2 },
  reasonTitle: { fontSize: 12, fontWeight: 'bold', marginBottom: 1 },
  reasonText: { fontSize: 13, fontWeight: 'bold' },
  rightButtonsContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10 },
  circleBtn: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  alertBtn: { backgroundColor: '#e74c3c', height: 44, paddingHorizontal: 14, borderRadius: 10, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  alertBtnText: { color: 'white', fontWeight: 'bold', fontSize: 13 },
  badge: { position: 'absolute', top: -4, right: -4, backgroundColor: 'red', borderRadius: 10, minWidth: 15, paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center', zIndex: 60 },
  badgeText: { color: 'white', fontSize: 9, fontWeight: 'bold' },
  dropdown: { position: 'absolute', top: 155, left: 0, right: 0, borderRadius: 10, padding: 12, zIndex: 999, elevation: 10 },
  lightDropdown: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#ccc' },
  darkDropdown: { backgroundColor: '#242424', borderWidth: 1, borderColor: '#444' },
  dropdownHeader: { fontWeight: 'bold', marginBottom: 6, fontSize: 14 },
  dropdownItem: { paddingVertical: 6, borderBottomWidth: 1 },
  emptyNotify: { fontSize: 12, color: 'gray', textAlign: 'center', marginVertical: 4 },
  viewMoreText: { color: 'purple', textAlign: 'center', marginTop: 6, fontSize: 12, fontWeight: 'bold' },
  cameraContainerFixed: { flex: 1, width: '100%', backgroundColor: 'black', borderRadius: 14, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', elevation: 4 },
  pythonStreamView: { width: '100%', height: '100%' },
  cameraOfflineView: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  updatedFooter: { width: '100%', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 2, marginTop: 12 },
  updateTimeText: { fontSize: 12, color: '#555555' },
  connectionStatus: { flexDirection: 'row', gap: 10 },
  statusItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotGreen: { backgroundColor: '#2ecc71' },
  dotRed: { backgroundColor: '#e74c3c' },
  statusLabel: { fontSize: 11, fontWeight: 'bold', color: '#555555' }
});