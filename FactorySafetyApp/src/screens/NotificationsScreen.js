import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from '../constants/config';

export default function NotificationsScreen({ notifications, setNotifications, onBack, isDarkMode }) {
  // Quản lý ID của thông báo đang được chọn để hiển thị ảnh trực tiếp (null = đóng tất cả)
  const [expandedIndex, setExpandedIndex] = useState(null);

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
                await AsyncStorage.removeItem('local_notifications'); 
                setExpandedIndex(null); // Khởi tạo lại trạng thái mở rộng ảnh
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

  const renderItem = ({ item, index }) => {
    const fullImg = item.image ? item.image.trim() : "";
    const cropImg = item.imageCrop ? item.imageCrop.trim() : "";
    const hasImage = fullImg !== "" || cropImg !== "";

    const cleanText = item.text.replace(/<br>/g, '\n').replace(/<\/?strong>/g, '');
    const isExpanded = expandedIndex === index; // Kiểm tra ô này có đang được nhấn mở rộng ảnh không

    const handlePressItem = () => {
      if (hasImage) {
        // Nếu nhấn lại ô đang mở -> Đóng lại. Ngược lại -> Mở rộng ô được nhấn
        setExpandedIndex(isExpanded ? null : index);
      } else {
        Alert.alert("Thông báo", "Cảnh báo này không có hình ảnh đính kèm.");
      }
    };

    // Đường dẫn gốc tĩnh từ phía máy chủ để nạp tài nguyên ảnh giống bản Web
    const STATIC_IMAGE_PATH = `${BASE_URL}/images/`;

    return (
      <View style={[styles.cardWrapper, isDarkMode ? styles.darkCard : styles.lightCard, !hasImage && styles.disabledCard]}>
        <TouchableOpacity 
          style={styles.itemCardInner}
          activeOpacity={hasImage ? 0.7 : 1}
          onPress={handlePressItem}
        >
          <View style={[styles.iconContainer, !hasImage && styles.disabledIcon]}>
            <Text style={{ fontSize: 18 }}>🔔</Text>
          </View>
          <View style={styles.textContainer}>
            <Text style={[styles.itemText, isDarkMode ? styles.darkTextSub : styles.lightTextSub]}>
              {cleanText}
            </Text>
            {hasImage && (
              <Text style={styles.expandHintText}>
                {isExpanded ? "▲ Nhấn để ẩn hình ảnh" : "▼ Nhấn để xem hình ảnh trực tiếp"}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* NẾU ĐƯỢC NHẤN VÀ CÓ ẢNH -> HIỂN THỊ ẢNH TRỰC TIẾP NGAY BÊN DƯỚI NỘI DUNG */}
        {isExpanded && hasImage && (
          <View style={[styles.imageInlineContainer, { borderColor: isDarkMode ? '#333' : '#eee' }]}>
            {cropImg !== "" && (
              <View style={styles.imageBlock}>
                <Text style={[styles.imageTitle, isDarkMode ? styles.darkTextMain : styles.lightTextMain]}>🔍 Ảnh Cắt Đối Tượng (Crop):</Text>
                <Image 
                  source={{ uri: STATIC_IMAGE_PATH + cropImg }} 
                  style={styles.embeddedImage} 
                  resizeMode="contain" 
                />
              </View>
            )}

            {fullImg !== "" ? (
              <View style={styles.imageBlock}>
                <Text style={[styles.imageTitle, isDarkMode ? styles.darkTextMain : styles.lightTextMain]}>🖼️ Ảnh Toàn Cảnh (Full):</Text>
                <Image 
                  source={{ uri: STATIC_IMAGE_PATH + fullImg }} 
                  style={styles.embeddedImage} 
                  resizeMode="contain" 
                />
              </View>
            ) : (
              <Text style={styles.noFullImageText}>Lượt xâm nhập nhanh (Dưới 3s), không kích hoạt lưu ảnh toàn cảnh.</Text>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode ? styles.darkBg : styles.lightBg]} edges={['top', 'left', 'right']}>
      <View style={styles.mainContainer}>
        
        <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
          <Text style={styles.backText}>← Quay lại trang chủ</Text>
        </TouchableOpacity>

        <View style={[styles.header, { borderBottomColor: isDarkMode ? '#333' : '#ddd' }]}>
          <Text style={[styles.title, isDarkMode ? styles.darkTextMain : styles.lightTextMain]}>Lịch sử thông báo</Text>
          {notifications.length > 0 && (
            <TouchableOpacity style={styles.clearBtn} onPress={handleClearHistory} activeOpacity={0.7}>
              <Text style={styles.clearBtnText}>Xóa sạch</Text>
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          data={[...notifications].reverse()}
          keyExtractor={(item, index) => index.toString()}
          renderItem={(props) => renderItem({ ...props })}
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
  safeArea: { flex: 1 },
  lightBg: { backgroundColor: '#f4f4f4' },
  darkBg: { backgroundColor: '#121212' },
  mainContainer: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  backButton: { paddingVertical: 8, marginBottom: 8 },
  backText: { color: '#1e5a8a', fontWeight: 'bold', fontSize: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 2, paddingBottom: 12, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: 'bold' },
  lightTextMain: { color: '#111' },
  darkTextMain: { color: '#e0e0e0' },
  clearBtn: { backgroundColor: '#fce8e6', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: '#f03e3e', borderStyle: 'dashed' },
  clearBtnText: { color: '#c92a2a', fontWeight: 'bold', fontSize: 13 },
  cardWrapper: { marginBottom: 12, borderRadius: 12, elevation: 2, padding: 14, borderWidth: 1, borderColor: 'transparent' },
  lightCard: { backgroundColor: '#fff', borderColor: '#eee' },
  darkCard: { backgroundColor: '#1e1e1e', borderColor: '#2c2c2c' },
  itemCardInner: { flexDirection: 'row', alignItems: 'flex-start' },
  disabledCard: { opacity: 0.65 },
  disabledIcon: { backgroundColor: '#7f8c8d' },
  iconContainer: { width: 40, height: 40, backgroundColor: '#1e5a8a', borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12, flexShrink: 0 },
  textContainer: { flex: 1 },
  itemText: { fontSize: 14, lineHeight: 20 },
  expandHintText: { fontSize: 11, color: '#1e5a8a', fontWeight: 'bold', marginTop: 4, letterSpacing: 0.3 },
  lightTextSub: { color: '#333' },
  darkTextSub: { color: '#b0b0b0' },
  imageInlineContainer: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, gap: 14 },
  imageBlock: { width: '100%' },
  imageTitle: { fontSize: 12, fontWeight: 'bold', marginBottom: 6, color: '#555' },
  embeddedImage: { width: '100%', height: 190, backgroundColor: '#000', borderRadius: 8 },
  noFullImageText: { fontSize: 12, color: '#888', fontStyle: 'italic', textAlign: 'center', paddingVertical: 6 },
  listContent: { paddingBottom: 20 },
  emptyText: { textAlign: 'center', color: 'gray', marginTop: 40, fontSize: 15 }
});