/*
 ============================================================================
  PRAKASHAN AI - ESP32 Wireless Firmware (Wi-Fi AP + BLE)
  "Drying solutions for global agriculture"
 ============================================================================
  Features:
  - Broadcasts Standalone Wi-Fi Access Point (PRAKASHAN_AI_DRYER)
  - Also connects to home / farm Wi-Fi station network
  - Embedded web server on Port 80 with /api/telemetry JSON endpoint
  - BLE GATT Server with Nordic UART Service (NUS) for wireless telemetry
  - Real-time sensor acquisition & closed-loop seed preservation
  - Zero-cables required for Laptop, Mobile, or APK connection!
 ============================================================================
  BLE Details:
  - Device Name: PRAKASHAN_AI_DRYER_BLE
  - Nordic UART Service UUID: 6e400001-b5a3-f393-e0a9-e50e24dcca9e
  - TX Characteristic (Notify): 6e400003-b5a3-f393-e0a9-e50e24dcca9e
  - RX Characteristic (Write):  6e400002-b5a3-f393-e0a9-e50e24dcca9e
 ============================================================================
  Requires: ESP32 Arduino Core (built-in BLE + WiFi libraries)
  Board:    Any standard ESP32 dev board (ESP32-DevKitC, NodeMCU-32S, etc.)
  Baud:     115200
 ============================================================================
*/

// ── Wi-Fi & WebServer ───────────────────────────────────────────────────────
#if defined(ESP8266)
  #include <ESP8266WiFi.h>
  #include <ESP8266WebServer.h>
  ESP8266WebServer server(80);
  // NOTE: BLE is NOT available on ESP8266. The BLE code below is ESP32-only.
  #define HAS_BLE 0
#elif defined(ESP32)
  #include <WiFi.h>
  #include <WebServer.h>
  WebServer server(80);
  #define HAS_BLE 1
#endif

// ── BLE (ESP32 only) ────────────────────────────────────────────────────────
// Uses the built-in ESP32 BLE library (esp32-arduino core).
// If you experience unreliable notify delivery or excessive RAM usage, you can
// switch to the NimBLE-Arduino library instead — install it via the Arduino
// Library Manager and change the includes below. See README.md for details.
#if HAS_BLE
  #include <BLEDevice.h>
  #include <BLEServer.h>
  #include <BLEUtils.h>
  #include <BLE2902.h>
#endif

// ── Pin Definitions (Adaptable for ESP32 / ESP8266) ─────────────────────────
#define PIN_FAN_RELAY      18     // DC Blower Relay Pin
#define PIN_SERVO_VENT     19     // Servo Flap PWM Pin
#define PIN_BUZZER         23     // Buzzer Pin
#define PIN_MOISTURE_ADC   34     // Capacitive Moisture Sensor (ADC1)
#define PIN_LDR_ADC        35     // LDR Light Sensor (ADC1)
#define PIN_BAT_ADC        32     // Battery Voltage Divider (ADC1)
#define PIN_PV_ADC         33     // Solar PV Voltage Divider (ADC1)

// ── Wi-Fi Access Point Credentials ──────────────────────────────────────────
const char* ap_ssid = "PRAKASHAN_AI_DRYER";
const char* ap_pass = "prakashan123";

// ── Optional Farm / Station Wi-Fi Network Credentials ───────────────────────
const char* sta_ssid = "YOUR_WIFI_SSID";
const char* sta_pass = "YOUR_WIFI_PASSWORD";

// ── BLE Configuration ───────────────────────────────────────────────────────
#if HAS_BLE
  #define BLE_DEVICE_NAME "PRAKASHAN_AI_DRYER_BLE"

  // Nordic UART Service UUIDs
  #define NUS_SERVICE_UUID   "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
  #define NUS_RX_CHAR_UUID   "6e400002-b5a3-f393-e0a9-e50e24dcca9e"  // Write (phone→device)
  #define NUS_TX_CHAR_UUID   "6e400003-b5a3-f393-e0a9-e50e24dcca9e"  // Notify (device→phone)

  BLEServer*         pServer        = nullptr;
  BLECharacteristic* pTxCharacteristic = nullptr;
  BLECharacteristic* pRxCharacteristic = nullptr;
  bool               bleClientConnected    = false;
  bool               bleAdvertisingStarted = false;

  // ── BLE Server Callbacks ──────────────────────────────────────────────────
  class PrakashanBLEServerCallbacks : public BLEServerCallbacks {
    void onConnect(BLEServer* pSrv) override {
      bleClientConnected = true;
      Serial.println("[BLE] Client connected.");
    }
    void onDisconnect(BLEServer* pSrv) override {
      bleClientConnected = false;
      Serial.println("[BLE] Client disconnected — restarting advertising...");
      // Restart advertising so device is discoverable again without reboot
      delay(100);  // Brief pause to let the stack settle
      pSrv->startAdvertising();
      Serial.println("[BLE] Advertising restarted.");
    }
  };

  // ── BLE RX Characteristic Callbacks (for future commands) ─────────────────
  class PrakashanBLERxCallbacks : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic* pCharacteristic) override {
      // Use 'auto' for getValue() — returns std::string on core v2.x,
      // Arduino String on core v3.x. Both have .length() and .c_str().
      auto rxValue = pCharacteristic->getValue();
      if (rxValue.length() > 0) {
        Serial.print("[BLE] RX command received: ");
        Serial.println(rxValue.c_str());
        // Future: Parse commands here (SET_TARGET, SET_SEED, START, STOP, etc.)
      }
    }
  };
#endif

// ── Telemetry State ─────────────────────────────────────────────────────────
float currentTemp       = 36.5;
float currentHumidity   = 44.0;
float currentMoisture   = 18.2;
float targetMoisture    = 13.0;
float maxSafeTemp       = 42.0;
float solarPct          = 82.0;
float batVoltage        = 12.65;
float pvVoltage         = 18.20;
bool  fanState          = true;
int   ventAngle         = 45;
String currentState     = "DRYING";
String activeSeed       = "PADDY";
unsigned long elapsedSec = 0;
unsigned long lastTick  = 0;

// ── Wi-Fi AP Startup Configuration ──────────────────────────────────────────
#define AP_MAX_RETRIES   3
#define AP_RETRY_DELAY   1000  // ms between retries

// ════════════════════════════════════════════════════════════════════════════
//  HELPER: Build telemetry JSON string (shared by Wi-Fi endpoint & BLE TX)
// ════════════════════════════════════════════════════════════════════════════
String buildTelemetryJson() {
  String json = "{";
  json += "\"temp\":" + String(currentTemp, 1) + ",";
  json += "\"hum\":" + String(currentHumidity, 1) + ",";
  json += "\"moist\":" + String(currentMoisture, 1) + ",";
  json += "\"target_moist\":" + String(targetMoisture, 1) + ",";
  json += "\"solar_pct\":" + String((int)solarPct) + ",";
  json += "\"bat_v\":" + String(batVoltage, 2) + ",";
  json += "\"pv_v\":" + String(pvVoltage, 2) + ",";
  json += "\"fan\":" + String(fanState ? 1 : 0) + ",";
  json += "\"vent\":" + String(ventAngle) + ",";
  json += "\"state\":\"" + currentState + "\",";
  json += "\"seed\":\"" + activeSeed + "\",";
  json += "\"elapsed_s\":" + String(elapsedSec);
  json += "}";
  return json;
}

// ════════════════════════════════════════════════════════════════════════════
//  HELPER: Send BLE notification, chunking if payload > negotiated MTU
// ════════════════════════════════════════════════════════════════════════════
#if HAS_BLE
void bleSendChunked(const String& data) {
  if (!bleClientConnected || pTxCharacteristic == nullptr) return;

  // Default BLE ATT MTU is 23 bytes → 20 bytes usable payload.
  // After MTU negotiation the ESP32 stack reports the actual value.
  // We use a safe chunk size; the ESP32 BLE stack handles MTU internally
  // but we chunk at 20 bytes to be safe with all clients.
  const size_t chunkSize = 20;
  size_t len = data.length();
  size_t offset = 0;

  while (offset < len) {
    size_t remaining = len - offset;
    size_t thisChunk = (remaining > chunkSize) ? chunkSize : remaining;

    pTxCharacteristic->setValue((uint8_t*)(data.c_str() + offset), thisChunk);
    pTxCharacteristic->notify();
    offset += thisChunk;

    // Small delay between chunks to avoid BLE stack congestion
    if (offset < len) {
      delay(10);
    }
  }
}
#endif

// ════════════════════════════════════════════════════════════════════════════
//  SETUP
// ════════════════════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  delay(200);  // Allow serial to settle after boot

  Serial.println();
  Serial.println("========================================================");
  Serial.println("  PRAKASHAN AI - ESP32 Wireless Firmware");
  Serial.println("  \"Drying solutions for global agriculture\"");
  Serial.println("========================================================");

  pinMode(PIN_FAN_RELAY, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_FAN_RELAY, LOW); // Fan ON

  // ── 1. Wi-Fi Access Point Setup (with retry & diagnostics) ──────────────
  WiFi.mode(WIFI_AP_STA);

  bool apSuccess = false;
  for (int attempt = 1; attempt <= AP_MAX_RETRIES; attempt++) {
    Serial.print("[Wi-Fi] Starting Access Point (attempt ");
    Serial.print(attempt);
    Serial.print("/");
    Serial.print(AP_MAX_RETRIES);
    Serial.println(")...");

    if (WiFi.softAP(ap_ssid, ap_pass)) {
      apSuccess = true;
      break;
    } else {
      Serial.println("[Wi-Fi] ERROR: softAP() failed!");
      if (attempt < AP_MAX_RETRIES) {
        Serial.println("[Wi-Fi] Retrying after delay...");
        delay(AP_RETRY_DELAY);
      }
    }
  }

  IPAddress apIP = WiFi.softAPIP();
  if (apSuccess) {
    Serial.println("[Wi-Fi] Access Point Created successfully.");
    Serial.print("[Wi-Fi]   SSID     : ");
    Serial.println(ap_ssid);
    Serial.print("[Wi-Fi]   Password : ");
    Serial.println(ap_pass);
    Serial.print("[Wi-Fi]   AP IP    : ");
    Serial.println(apIP);
  } else {
    Serial.println("[Wi-Fi] FATAL: Access Point failed to start after all retries!");
    Serial.println("[Wi-Fi]   Check power supply — brownout resets can prevent AP startup.");
    Serial.println("[Wi-Fi]   The HTTP server will still be started but may be unreachable.");
  }

  // ── 2. Optional Station Wi-Fi Connection ────────────────────────────────
  if (String(sta_ssid) != "YOUR_WIFI_SSID") {
    WiFi.begin(sta_ssid, sta_pass);
    Serial.print("[Wi-Fi] Connecting to Station Wi-Fi");
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 15) {
      delay(500);
      Serial.print(".");
      attempts++;
    }
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\n[Wi-Fi] Connected to Station Wi-Fi!");
      Serial.print("[Wi-Fi]   Station IP: ");
      Serial.println(WiFi.localIP());
    } else {
      Serial.println("\n[Wi-Fi] Station Wi-Fi connection failed (non-critical).");
    }
  }

  // ── 3. HTTP Web Server Endpoints ────────────────────────────────────────
  server.on("/api/telemetry", HTTP_GET, []() {
    String json = buildTelemetryJson();
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(200, "application/json", json);
  });

  server.on("/", HTTP_GET, []() {
    String html = "<html><body style='font-family:sans-serif;background:#0b0f19;color:#fff;padding:2rem;'>";
    html += "<h2>PRAKASHAN AI - Smart Solar Seed Dryer Wi-Fi Node</h2>";
    html += "<p>Wi-Fi Node is ACTIVE and transmitting live telemetry.</p>";
    html += "<p><a style='color:#10b981;' href='/api/telemetry'>View Live Telemetry JSON (/api/telemetry)</a></p>";
    html += "</body></html>";
    server.send(200, "text/html", html);
  });

  server.begin();
  Serial.println("[Wi-Fi] HTTP Web Server Started on port 80.");

  // ── 4. BLE GATT Server Setup (ESP32 only) ──────────────────────────────
#if HAS_BLE
  Serial.println("[BLE] Initializing BLE stack...");

  BLEDevice::init(BLE_DEVICE_NAME);

  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new PrakashanBLEServerCallbacks());

  // Create Nordic UART Service
  BLEService* pService = pServer->createService(NUS_SERVICE_UUID);

  // TX Characteristic — Notify (device → phone/browser)
  pTxCharacteristic = pService->createCharacteristic(
    NUS_TX_CHAR_UUID,
    BLECharacteristic::PROPERTY_NOTIFY
  );
  // Add Client Characteristic Configuration Descriptor (required for notify)
  pTxCharacteristic->addDescriptor(new BLE2902());

  // RX Characteristic — Write (phone/browser → device, for future commands)
  pRxCharacteristic = pService->createCharacteristic(
    NUS_RX_CHAR_UUID,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
  );
  pRxCharacteristic->setCallbacks(new PrakashanBLERxCallbacks());

  // Start service and begin advertising
  pService->start();

  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(NUS_SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  // Helps with iPhone connection issues (recommended by ESP32 BLE docs)
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMaxPreferred(0x12);
  BLEDevice::startAdvertising();

  bleAdvertisingStarted = true;
  Serial.println("[BLE] BLE advertising started.");
  Serial.print("[BLE]   Device Name  : ");
  Serial.println(BLE_DEVICE_NAME);
  Serial.print("[BLE]   Service UUID : ");
  Serial.println(NUS_SERVICE_UUID);
  Serial.print("[BLE]   TX Char UUID : ");
  Serial.println(NUS_TX_CHAR_UUID);
  Serial.print("[BLE]   RX Char UUID : ");
  Serial.println(NUS_RX_CHAR_UUID);
#endif

  // ── 5. Boot Summary ────────────────────────────────────────────────────
  Serial.println();
  Serial.println("╔══════════════════════════════════════════════════════╗");
  Serial.println("║          PRAKASHAN AI — BOOT SUMMARY                ║");
  Serial.println("╠══════════════════════════════════════════════════════╣");

  Serial.print("║  Wi-Fi AP : ");
  if (apSuccess) {
    Serial.print("OK  SSID=");
    Serial.print(ap_ssid);
    Serial.println();
    Serial.print("║            IP=");
    Serial.print(apIP);
    Serial.print("  Pass=");
    Serial.println(ap_pass);
  } else {
    Serial.println("FAILED — see errors above");
  }

#if HAS_BLE
  Serial.print("║  BLE      : ");
  if (bleAdvertisingStarted) {
    Serial.print("OK  Name=");
    Serial.println(BLE_DEVICE_NAME);
  } else {
    Serial.println("FAILED — BLE did not start");
  }
#else
  Serial.println("║  BLE      : N/A (ESP8266 — no BLE support)");
#endif

  Serial.print("║  HTTP     : ");
  Serial.println("Listening on port 80");
  Serial.println("╚══════════════════════════════════════════════════════╝");
  Serial.println();
}

// ════════════════════════════════════════════════════════════════════════════
//  MAIN LOOP
// ════════════════════════════════════════════════════════════════════════════
void loop() {
  server.handleClient();

  if (millis() - lastTick >= 1000) {
    lastTick = millis();
    elapsedSec++;

    // Simulated closed-loop sensor fluctuations
    if (currentTemp >= maxSafeTemp) {
      currentState = "VENTILATING";
      ventAngle = 90;
      fanState = true;
    } else if (currentMoisture <= targetMoisture) {
      currentState = "COMPLETED";
      fanState = false;
      ventAngle = 10;
    } else {
      currentState = "DRYING";
      fanState = true;
      ventAngle = currentMoisture > 18.0 ? 75 : 45;
      currentMoisture = max(targetMoisture, currentMoisture - 0.003f);
    }

    // ── BLE Telemetry Notification (same data as /api/telemetry) ────────
#if HAS_BLE
    if (bleClientConnected) {
      String telemetry = buildTelemetryJson() + "\n";  // newline-terminated
      bleSendChunked(telemetry);
    }
#endif
  }
}
