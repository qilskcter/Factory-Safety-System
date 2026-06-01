import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Alert, SafeAreaView, StatusBar } from 'react-native';
import io from 'socket.io-client';
import { BASE_URL } from './src/constants/config';
import ImageModal from './src/components/ImageModal';
import NotificationsScreen from './src/screens/NotificationsScreen';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('Home');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [sensorData, setSensorData] = useState({ temperature: '--', humidity: '--', gas: '--', alertReason: 'An toàn', updatedAt: null });
  const [notifications, setNotifications] = useState([]);
  const [statusBackend, setStatusBackend] = useState(false);
  const [statusPython, setStatusPython] = useState(false);
  const [statusEsp32, setStatusEsp32] = useState(false);
  const [streamTimestamp, setStreamTimestamp] = useState(Date.now());
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  
  // THÊM: State quản lý trạng thái rơ-le (0: Tự động, 1: Ép ngắt)
  const [webRelayForced, setWebRelayForced] = useState(0);
  
  const lastAlertRef = useRef("An toàn");
  const socket = useRef(null);

  useEffect(() => {
    socket.current = io(BASE_URL, { transports: ['websocket'] });
    
    socket.current.on('connect', () => {
      setStatusBackend(true);
      checkCurrentRelayStatus(); // Đồng bộ trạng thái relay khi vừa kết nối
    });
    
    socket.current.on('python-status', (isAlive) => setStatusPython(isAlive));
    
    // Lắng nghe dữ liệu cảm biến (ESP32) và cảnh báo của nó
    socket.current.on('sensor-data', (data) => {
      setSensorData({
        temperature: data.temperature, humidity: data.humidity, gas: data.gas,
        alertReason: data.alertReason || 'An toàn',
        updatedAt: data.updatedAt ? new Date(data.updatedAt).toLocaleTimeString() : '--'
      });
      setStatusEsp32(true);

      // Tự động thêm thông báo nếu có cảnh báo từ ESP32
      if (data.alertReason !== 'An toàn' && data.alertReason !== lastAlertRef.current) {
        setNotifications(prev => [{
            text: `[ESP32 ALERT] ${data.alertReason}\n${new Date().toLocaleTimeString()}`,
            image: "", imageCrop: ""
        }, ...prev]);
        lastAlertRef.current = data.alertReason;
      } else if (data.alertReason === 'An toàn') {
        lastAlertRef.current = 'An toàn';
      }
    });

    // Lắng nghe cảnh báo từ Python AI (Camera)
    socket.current.on('new-alert', (alert) => {
      setNotifications(prev => [{
        text: `[AI ALERT] Xâm nhập Zone ${alert.zone || "1"}\n${new Date().toLocaleTimeString()}`,
        image: alert.image || "",
        imageCrop: alert.imageCrop || ""
      }, ...prev]);
    });
    
    const interval = setInterval(() => setStreamTimestamp(Date.now()), 100);
    return () => { socket.current.disconnect(); clearInterval(interval); };
  }, []);

  // THÊM: Hàm lấy trạng thái Relay hiện tại từ Server Backend
  const checkCurrentRelayStatus = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/buzzer/status`);
      const data = await response.json();
      if (data && data.hasOwnProperty('relayManualId')) {
        setWebRelayForced(data.relayManualId);
      }
    } catch (e) {
      console.log("Error fetching relay status:", e);
    }
  };

  // THÊM: Hàm gửi lệnh đóng/ngắt Relay lên Server
  const triggerRelayToggle = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/relay/toggle`, { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        setWebRelayForced(data.relayState);
        if (data.relayState === 1) {
          Alert.alert("🛑 Thông báo", "Đã ra lệnh ÉP NGẮT RELAY (Mô-tơ dừng) từ xa!");
        } else {
          Alert.alert("✅ Thông báo", "Đã đưa Relay về chế độ TỰ ĐỘNG theo cảm biến!");
        }
      }
    } catch (error) {
      Alert.alert("❌ Lỗi", "Không thể kết nối tới server để điều khiển Relay!");
    }
  };

  if (currentScreen === 'Notifications') return <NotificationsScreen notifications={notifications} setNotifications={setNotifications} onBack={() => setCurrentScreen('Home')} isDarkMode={isDarkMode} onOpenModal={(item) => { setSelectedAlert(item); setModalVisible(true); }} />;

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode ? styles.darkBg : styles.lightBg]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <View style={styles.container}>
        <View style={styles.headerRow}><Text style={[styles.appTitle, isDarkMode ? styles.darkText : styles.lightText]}>FACTORY SAFETY SYSTEM</Text></View>

        <View style={styles.cardContainer}>
          <View style={[styles.sensorCard, isDarkMode ? styles.darkCard : styles.lightCard]}><Text style={styles.cardTitle}>Nhiệt độ</Text><Text style={[styles.cardValue, isDarkMode ? styles.darkText : styles.lightText]}>{sensorData.temperature}°C</Text></View>
          <View style={[styles.sensorCard, isDarkMode ? styles.darkCard : styles.lightCard]}><Text style={styles.cardTitle}>Độ ẩm</Text><Text style={[styles.cardValue, isDarkMode ? styles.darkText : styles.lightText]}>{sensorData.humidity}%</Text></View>
          <View style={[styles.sensorCard, isDarkMode ? styles.darkCard : styles.lightCard]}><Text style={styles.cardTitle}>Khí Gas</Text><Text style={[styles.cardValue, isDarkMode ? styles.darkText : styles.lightText]}>{sensorData.gas}</Text></View>
        </View>

        <View style={styles.controlRow}>
          <View style={[styles.reasonBox, isDarkMode ? styles.darkCard : styles.lightCard]}>
            <Text style={styles.cardTitle}>Lý do cảnh báo</Text>
            <Text numberOfLines={1} style={{ color: sensorData.alertReason === 'An toàn' ? 'green' : 'red', fontWeight: 'bold', fontSize: 11 }}>{sensorData.alertReason}</Text>
          </View>
          
          <TouchableOpacity style={[styles.actionBtn, isDarkMode ? styles.darkCard : styles.lightCard]} onPress={() => setIsDarkMode(!isDarkMode)}><Text style={{fontSize: 14}}>{isDarkMode ? '☀️' : '🌙'}</Text></TouchableOpacity>
          
          {/* THÊM: NÚT ĐIỀU KHIỂN TOGGLE RELAY (NẰM KẾ NÚT CẢNH BÁO) */}
          <TouchableOpacity 
            style={[styles.relayBtn, webRelayForced === 1 ? styles.relayBtnForced : styles.relayBtnAuto]} 
            onPress={triggerRelayToggle}
          >
            <Text style={styles.relayBtnText}>{webRelayForced === 1 ? "OFF" : "AUTO"}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#e74c3c'}]} onPress={() => fetch(`${BASE_URL}/api/buzzer/trigger`, {method:'POST'})}><Text style={{color:'white', fontWeight:'bold', fontSize: 14}}>!</Text></TouchableOpacity>
          
          <TouchableOpacity style={[styles.actionBtn, isDarkMode ? styles.darkCard : styles.lightCard]} onPress={() => setCurrentScreen('Notifications')}>
            <Text style={{fontSize: 14}}>🔔</Text>
            {notifications.length > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{notifications.length}</Text></View>}
          </TouchableOpacity>
        </View>

        <View style={styles.cameraFrame}>
            {statusPython ? <Image source={{ uri: `${BASE_URL}/api/video-snapshot?t=${streamTimestamp}` }} style={styles.videoStream} resizeMode="contain" /> : <Text style={{color: '#888'}}>AI Offline</Text>}
        </View>

        <View style={[styles.footer, isDarkMode ? styles.darkCard : styles.lightCard]}>
          <Text style={{color:'#888', fontSize: 12}}>Last: {sensorData.updatedAt}</Text>
          <View style={styles.statusRow}>
             <View style={[styles.dot, {backgroundColor: statusBackend ? 'green' : 'red'}]} /><Text style={styles.statusLabel}>Backend</Text>
             <View style={[styles.dot, {backgroundColor: statusPython ? 'green' : 'red'}]} /><Text style={styles.statusLabel}>Python AI</Text>
             <View style={[styles.dot, {backgroundColor: statusEsp32 ? 'green' : 'red'}]} /><Text style={styles.statusLabel}>ESP32</Text>
          </View>
        </View>
      </View>
      <ImageModal visible={modalVisible} onClose={() => setModalVisible(false)} alertData={selectedAlert} isDarkMode={isDarkMode} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1, padding: 12, justifyContent: 'space-between' },
  headerRow: { alignItems: 'center', marginVertical: 10 },
  appTitle: { fontSize: 20, fontWeight: 'bold' },
  cardContainer: { flexDirection: 'row', gap: 8 },
  sensorCard: { padding: 10, borderRadius: 10, flex: 1, height: 70, justifyContent: 'center', alignItems: 'center' },
  
  // Cấu hình lại thanh điều khiển để vừa vặn 5 khối (1 ô chữ + 4 nút bấm)
  controlRow: { flexDirection: 'row', gap: 5, height: 55, alignItems: 'center', width: '100%' },
  reasonBox: { flex: 1.5, padding: 8, borderRadius: 10, height: '100%', justifyContent: 'center' },
  actionBtn: { width: 38, height: '100%', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  
  // STYLE ĐỊNH DẠNG RIÊNG CHO NÚT RELAY TRÊN MOBILE
  relayBtn: { 
    width: 60, // Chiều rộng vừa đủ hiển thị chữ trạng thái ngắn gọn
    height: '100%', 
    borderRadius: 10, 
    justifyContent: 'center', 
    alignItems: 'center',
    elevation: 2
  },
  relayBtnAuto: { backgroundColor: '#27ae60' }, // Xanh lá khi chạy tự động
  relayBtnForced: { backgroundColor: '#7f8c8d' }, // Xám khi ép ngắt rơ-le
  relayBtnText: { color: 'white', fontWeight: 'bold', fontSize: 11 },

  cameraFrame: { flex: 0.7, backgroundColor: 'black', borderRadius: 12, marginVertical: 8, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  videoStream: { width: '100%', height: '100%' },
  footer: { padding: 10, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 11, color: '#888' },
  lightCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee' },
  darkCard: { backgroundColor: '#1e1e1e', borderWidth: 1, borderColor: '#333' },
  lightBg: { backgroundColor: '#f4f4f4' },
  darkBg: { backgroundColor: '#121212' },
  lightText: { color: '#000' },
  darkText: { color: '#fff' },
  cardTitle: { fontSize: 10, color: '#777' },
  cardValue: { fontWeight: 'bold' },
  badge: { position: 'absolute', top: 3, right: 3, backgroundColor: 'red', borderRadius: 10, minWidth: 14, paddingHorizontal: 3, alignItems: 'center' },
  badgeText: { color: 'white', fontSize: 8, fontWeight: 'bold' }
});