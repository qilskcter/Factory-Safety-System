import React from 'react';
import { Modal, View, Text, Image, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { STATIC_IMAGE_PATH } from '../constants/config';

export default function ImageModal({ visible, onClose, alertData, isDarkMode }) {
  if (!alertData) return null;

  const { image, imageCrop } = alertData;

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, isDarkMode && styles.darkCard]}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={[styles.closeText, isDarkMode && styles.darkTextMain]}>&times;</Text>
          </TouchableOpacity>
          
          <Text style={[styles.modalTitle, isDarkMode && styles.darkTextMain]}>
            Chi tiết hình ảnh xâm nhập
          </Text>

          <ScrollView contentContainerStyle={styles.modalBody}>
            {/* Ảnh toàn cảnh */}
            <View style={styles.imageContainer}>
              <Text style={[styles.imageLabel, { color: isDarkMode ? '#b0b0b0' : '#444' }]}>
                Ảnh toàn cảnh (Gốc)
              </Text>
              <Image 
                source={image ? { uri: STATIC_IMAGE_PATH + image } : null} 
                style={[styles.image, { backgroundColor: isDarkMode ? '#121212' : '#f4f4f4' }]}
                resizeMode="contain"
                alt="Không có dữ liệu ảnh"
              />
            </View>

            {/* Ảnh Crop đối tượng */}
            {imageCrop ? (
              <View style={[styles.imageContainer, { width: '100%', marginTop: 15 }]}>
                <Text style={[styles.imageLabel, { color: '#d9534f' }]}>Đối tượng</Text>
                <Image 
                  source={{ uri: STATIC_IMAGE_PATH + imageCrop }} 
                  style={[styles.image, { height: 200, backgroundColor: isDarkMode ? '#121212' : '#f4f4f4' }]}
                  resizeMode="contain"
                />
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxHeight: '85%',
    padding: 20,
    position: 'relative',
  },
  darkCard: { backgroundColor: '#1e1e1e' },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 20,
    zIndex: 1,
  },
  closeText: { fontSize: 32, color: '#999', fontWeight: 'bold' },
  darkTextMain: { color: '#e0e0e0' },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  modalBody: { alignItems: 'center' },
  imageContainer: { width: '100%', alignItems: 'center' },
  imageLabel: { fontWeight: 'bold', marginBottom: 6, fontSize: 14 },
  image: {
    width: '100%',
    height: 250,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
});