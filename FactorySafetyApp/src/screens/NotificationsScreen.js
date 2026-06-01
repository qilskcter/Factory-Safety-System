import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, SafeAreaView } from 'react-native';
import { BASE_URL } from '../constants/config';

export default function NotificationsScreen({ notifications, setNotifications, onBack, isDarkMode, onOpenModal }) {
  
  const handleClearHistory = async () => {
    Alert.alert(
      "Xác nhận dọn dẹp",
      "Hành động này sẽ xóa sạch thông báo trên App, file log.txt và toàn bộ ảnh trong thư mục python/images trên server. Bạn có chắc chắn?",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa sạch",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await fetch(`${BASE_URL}/api/clear-all`, { method: "POST" });
              const result = await response.json();
              if (result.success) {
                setNotifications([]);
                Alert.alert("Thành công", "Hệ thống đã được dọn dẹp sạch sẽ!");
              } else {
                Alert.alert("Thất bại", result.message);
              }
            } catch (err) {
              Alert.alert("Lỗi", "Không thể kết nối tới máy chủ để dọn dẹp.");
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }) => {
    const hasImage = item.image || item.imageCrop;
    const cleanText = item.text.replace(/<br>/g, '\n').replace(/<\/?strong>/g, '');

    return (
      <TouchableOpacity 
        style={[styles.itemCard, isDarkMode ? styles.darkCard : styles.lightCard]}
        disabled={!hasImage}
        onPress={() => onOpenModal(item)}
      >
        <View style={styles.iconContainer}>
          <Text style={{ fontSize: 18 }}>🔔</Text>
        </View>
        <Text style={[styles.itemText, isDarkMode ? styles.darkTextSub : styles.lightTextSub]}>
          {cleanText}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    // Dùng SafeAreaView bọc ngoài cùng để triệt tiêu lỗi đè Notch/Tai thỏ trên iOS hoàn toàn
    <SafeAreaView style={[styles.safeArea, isDarkMode ? styles.darkBg : styles.lightBg]}>
      <View style={styles.mainContainer}>
        
        {/* Nút quay lại trang chủ - Tăng vùng bấm lớn cho dễ thao tác di động */}
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <Text style={styles.backText}>← Quay lại trang chủ</Text>
        </TouchableOpacity>

        {/* Thanh Header tiêu đề và nút xóa sạch */}
        <View style={[styles.header, { borderBottomColor: isDarkMode ? '#333' : '#ddd' }]}>
          <Text style={[styles.title, isDarkMode ? styles.darkTextMain : styles.lightTextMain]}>Lịch sử thông báo</Text>
          {notifications.length > 0 && (
            <TouchableOpacity style={styles.clearBtn} onPress={handleClearHistory} activeOpacity={0.7}>
              <Text style={styles.clearBtnText}>Xóa sạch</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Danh sách thông báo */}
        <FlatList
          data={[...notifications].reverse()}
          keyExtractor={(item, index) => index.toString()}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Hệ thống chưa ghi nhận lịch sử thông báo nào.</Text>
          }
        />
        
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1 
  },
  lightBg: { backgroundColor: '#f4f4f4' },
  darkBg: { backgroundColor: '#121212' },
  
  // Khung đệm nội dung chính bao bọc an toàn bên trong
  mainContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12 // Khoảng đệm nhỏ ngay dưới thanh tai thỏ sau khi qua SafeAreaView
  },

  backButton: { 
    paddingVertical: 8,
    marginBottom: 8
  },
  backText: { color: '#1e5a8a', fontWeight: 'bold', fontSize: 16 },
  
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    borderBottomWidth: 2,
    paddingBottom: 12,
    marginBottom: 16
  },
  title: { fontSize: 22, fontWeight: 'bold' },
  lightTextMain: { color: '#111' },
  darkTextMain: { color: '#e0e0e0' },
  
  clearBtn: { backgroundColor: '#fce8e6', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: '#f03e3e', borderStyle: 'dashed' },
  clearBtnText: { color: '#c92a2a', fontWeight: 'bold', fontSize: 13 },
  
  itemCard: { flexDirection: 'row', padding: 15, marginBottom: 12, borderRadius: 12, alignItems: 'center', elevation: 2 },
  lightCard: { backgroundColor: '#fff' },
  darkCard: { backgroundColor: '#1e1e1e' },
  
  iconContainer: { width: 40, height: 40, backgroundColor: '#1e5a8a', borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12, flexShrink: 0 },
  itemText: { flex: 1, fontSize: 14, lineHeight: 20 },
  lightTextSub: { color: '#333' },
  darkTextSub: { color: '#b0b0b0' },
  
  // Tạo khoảng đệm dưới đáy danh sách cuộn tránh dính vạch điều hướng sàn máy iOS
  listContent: {
    paddingBottom: 20
  },
  emptyText: { textAlign: 'center', color: 'gray', marginTop: 40, fontSize: 15 }
});