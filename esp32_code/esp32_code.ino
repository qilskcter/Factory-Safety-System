#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <ArduinoJson.h>

const char* ssid = "Delmasmay";
const char* password = "conchonqa";

const char* serverName = "http://172.20.10.6:3000/api/data";
const char* buzzerStatusUrl = "http://172.20.10.6:3000/api/buzzer/status";
const char* buzzerResetUrl   = "http://172.20.10.6:3000/api/buzzer/reset";

#define DHT_PIN     4
#define RELAY_PIN   5

#define TRIG_PIN    12
#define ECHO_PIN    13

#define PIR_PIN     14

#define BUZZER_PIN  18

#define MQ2_PIN     34

#define DHT_TYPE DHT11

DHT dht(DHT_PIN, DHT_TYPE);

unsigned long lastSend = 0;
const int sendInterval = 500;

// Biến toàn cục lưu trạng thái điều khiển Relay từ Web Dashboard
int webRelayForced = 0;

float getDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);

  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH, 25000);

  if(duration == 0){
    return 400.0;
  }

  return duration * 0.034 / 2;
}

void connectWiFi(){
  WiFi.begin(ssid, password);
  Serial.print("Connecting WiFi");
  while(WiFi.status() != WL_CONNECTED){
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi Connected");
  Serial.print("ESP32 IP: ");
  Serial.println(WiFi.localIP());
}

void setup() {
  Serial.begin(115200);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(PIR_PIN, INPUT);
  pinMode(MQ2_PIN, INPUT);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  dht.begin();

  // Khởi tạo ban đầu: Xuất HIGH để giữ Relay TẮT (Vì mạch Active Low)
  // Chân NC đóng mạch -> Mô-tơ sẽ tự quay ngay khi ESP32 vừa khởi động xong
  digitalWrite(RELAY_PIN, HIGH);

  digitalWrite(BUZZER_PIN, HIGH);
  delay(500);
  digitalWrite(BUZZER_PIN, LOW);

  connectWiFi();
}

void loop() {
  if(WiFi.status() != WL_CONNECTED){
    Serial.println("WiFi Lost!");
    connectWiFi();
  }

  if(millis() - lastSend >= sendInterval){
    lastSend = millis();
    
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    int g = analogRead(MQ2_PIN);
    int m = digitalRead(PIR_PIN);
    float d = getDistance();

    if(isnan(t)) t = 0;
    if(isnan(h)) h = 0;

    Serial.println("==========");
    Serial.print("Temp: ");
    Serial.println(t);
    Serial.print("Humidity: ");
    Serial.println(h);
    Serial.print("Gas: ");
    Serial.println(g);
    Serial.print("Motion: ");
    Serial.println(m);
    Serial.print("Distance: ");
    Serial.println(d);

    // --- XỬ LÝ LOGIC CẢNH BÁO & ĐỊNH NGHĨA LÝ DO ---
    String alertReason = "An toàn";
    bool danger = false;
    if(g > 700 || t > 45){
      danger = true;
    }

    bool isNear = (d < 50.0 && d > 0); 
    bool hasMotion = (m == 1);

    // KIỂM TRA ĐIỀU KIỆN 1: Nếu Web ra lệnh ÉP NGẮT hoặc hệ thống gặp DANGER tự động
    if (webRelayForced == 1 || danger) {
      if (danger) {
        digitalWrite(BUZZER_PIN, HIGH);
        if (g > 700 && t > 45) alertReason = "Nguy hiểm: Rò rỉ khí gas và Nhiệt độ cao!";
        else if (g > 700) alertReason = "Nguy hiểm: Khí gas vượt ngưỡng!";
        else alertReason = "Nguy hiểm: Nhiệt độ vượt ngưỡng!";
        Serial.println("!!! DANGER (GAS/TEMP) !!!");
      } else {
        alertReason = "Hệ thống dừng: Ép ngắt điều khiển Relay từ Web Dashboard!";
        Serial.println("[WEB CONTROL] Đang ép ngắt Relay...");
      }
      
      // KÍCH RELAY BẬT (Xuất LOW cho mạch Active Low) -> Ngắt chân NC -> MÔ-TƠ SẼ TẮT
      digitalWrite(RELAY_PIN, LOW); 
    } 
    // KIỂM TRA ĐIỀU KIỆN 2: Trạng thái an toàn bình thường và không bị ép ngắt từ web
    else {
      // TẮT RELAY (Xuất HIGH cho mạch Active Low) -> Chân NC đóng lại -> MÔ-TƠ LUÔN QUAY
      digitalWrite(RELAY_PIN, HIGH); 
      
      if (isNear && hasMotion) {
        digitalWrite(BUZZER_PIN, HIGH);
        Serial.println("[ALERT] CẢ 2 ĐIỀU KIỆN ĐỀU THỎA -> HÚ LIÊN TỤC!");
        alertReason = "Cảnh báo: Phát hiện đối tượng tiếp cận và có chuyển động!";
      } 
      else if (isNear) {
        static bool toggleBuzzer = false;
        toggleBuzzer = !toggleBuzzer;
        digitalWrite(BUZZER_PIN, toggleBuzzer ? HIGH : LOW);
        Serial.println("[ALERT] Khoảng cách < 50cm -> Đang hú còi!");
        alertReason = "Cảnh báo: Vật thể xâm nhập khoảng cách gần (<50cm)!";
      } 
      else if (hasMotion) {
        Serial.println("[ALERT] Có chuyển động -> Kêu bíp ngắn 1 cái!");
        digitalWrite(BUZZER_PIN, HIGH);
        delay(80); 
        digitalWrite(BUZZER_PIN, LOW);
        alertReason = "Cảnh báo: Phát hiện chuyển động!";
      } 
      else {
        digitalWrite(BUZZER_PIN, LOW);
      }
    }

    // --- ĐÓNG GÓI JSON GỬI LÊN SERVER ---
    HTTPClient http;
    http.begin(serverName);
    http.addHeader("Content-Type", "application/json");
    
    String json = "{";
    json += "\"temperature\":";
    json += String(t, 1);
    json += ",";
    json += "\"humidity\":";
    json += String(h, 1);
    json += ",";
    json += "\"gas\":";
    json += String(g);
    json += ",";
    json += "\"motion\":";
    json += String(m);
    json += ",";
    json += "\"distance\":";
    json += String(d, 1);
    json += ",";
    json += "\"alertReason\":\"" + alertReason + "\"";
    json += "}";

    int httpCode = http.POST(json);
    Serial.print("HTTP Send Data: ");
    Serial.println(httpCode);
    http.end();

    // Quét lệnh từ server (Buzzer và trạng thái Relay thủ công)
    checkBuzzerCommand();
  }
}

void checkBuzzerCommand() {
  HTTPClient http;
  http.begin(buzzerStatusUrl);
  
  int httpResponseCode = http.GET();
  if (httpResponseCode > 0) {
    String payload = http.getString();
    
    DynamicJsonDocument doc(256);
    deserializeJson(doc, payload);
    
    // 1. Cập nhật trạng thái điều khiển Relay từ xa
    if (doc.containsKey("relayManualId")) {
      webRelayForced = doc["relayManualId"];
    }

    // 2. Kiểm tra tín hiệu còi hú từ xa
    int buzzerAlert = doc["buzzerAlert"];
    if (buzzerAlert == 1) {
      Serial.println("[ALERT] Phát hiện tín hiệu nhấn nút kích hoạt còi từ xa từ Web Dashboard!");
      for (int chuKy = 0; chuKy < 5; chuKy++) {
        Serial.print("-> Chu kỳ hồi còi thứ: ");
        Serial.println(chuKy + 1);
        
        for (int bip = 0; bip < 4; bip++) {
          digitalWrite(BUZZER_PIN, HIGH);
          delay(150);
          digitalWrite(BUZZER_PIN, LOW);
          delay(100);
        }
        
        delay(800);
      }
      
      resetBuzzerOnServer();
    }
  }
  http.end();
}

void resetBuzzerOnServer() {
  HTTPClient http;
  http.begin(buzzerResetUrl);
  http.addHeader("Content-Type", "application/json");
  int httpResponseCode = http.POST("{}");
  http.end();
}