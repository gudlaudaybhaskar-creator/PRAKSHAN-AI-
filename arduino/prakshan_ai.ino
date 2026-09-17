/*
 ============================================================================
  PRAKASHAN AI - AI-Powered Smart Solar Seed Dryer
  "Drying solutions for global agriculture"
  Hardware Controller Firmware for Arduino Uno (ATmega328P)
 ============================================================================
  NOTE: This sketch is INTENTIONALLY wired-only (USB Serial).
  It does NOT contain any Wi-Fi or Bluetooth code because the Arduino Uno
  lacks wireless hardware. For wireless connectivity (Wi-Fi AP + BLE),
  see the companion ESP32 sketch:
      arduino/prakshan_ai_esp32_wifi/prakshan_ai_esp32_wifi.ino
 ============================================================================
  Features:
  - Non-blocking state machine (millis-based scheduling)
  - Temperature & Relative Humidity monitoring (DHT22)
  - Calibrated Capacitive Seed Moisture sensing (A0)
  - Solar Irradiance monitoring (LDR on A1)
  - Battery & Solar Panel Voltage Monitoring (A2, A3 with voltage dividers)
  - Closed-loop DC Blower Relay Control (Pin 8)
  - Motorized Exhaust Vent Flap (Servo on Pin 9)
  - Audio-Visual Alarms (Active Buzzer on Pin 7, Tri-color Status LEDs)
  - I2C OLED (SSD1306) / I2C LCD Display status rotation
  - Offline MicroSD CSV Data Logging (SPI CS Pin 10)
  - Real-time JSON Telemetry over Serial (115200 baud) for AI & Dashboard
  - Bidirectional Serial Command Interface
 ============================================================================
*/

#include <Wire.h>
#include <Servo.h>
#include <SPI.h>
#include <SD.h>
#include <DHT.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ==========================================
// PIN DEFINITIONS
// ==========================================
#define PIN_DHT            2      // DHT22 Digital Data Pin
#define PIN_BUZZER         7      // Active Buzzer
#define PIN_FAN_RELAY      8      // DC Blower Relay (Active LOW)
#define PIN_SERVO_VENT     9      // Exhaust Vent Servo Motor (PWM)
#define PIN_SD_CS          10     // MicroSD Card CS (SPI)
#define PIN_LED_NORMAL     4      // Green LED: Normal Drying
#define PIN_LED_VENT       5      // Yellow LED: High Temp / Exhaust Venting
#define PIN_LED_ALARM      6      // Red LED: Fault / Over-temperature

#define PIN_MOISTURE_ADC   A0     // Capacitive Seed Moisture Sensor (0-5V)
#define PIN_LDR_ADC        A1     // LDR Light Sensor Voltage Divider
#define PIN_BAT_ADC        A2     // Battery Voltage Divider (100k / 10k)
#define PIN_PV_ADC         A3     // Solar Panel Voltage Divider (100k / 10k)

// ==========================================
// SENSOR & HARDWARE CONFIGURATION
// ==========================================
#define DHTTYPE            DHT22  // DHT22 (AM2302)
#define OLED_SCREEN_WIDTH  128
#define OLED_SCREEN_HEIGHT 64
#define OLED_RESET         -1
#define OLED_I2C_ADDR      0x3C

// Capacitive Sensor Calibration Constants (Dry Seed vs Wet Seed ADC values)
float CALIB_AIR_ADC = 720.0;     // Raw ADC when completely dry (0% moisture or air)
float CALIB_WET_ADC = 310.0;     // Raw ADC in fully saturated wet seed (~35% moisture)
float MOISTURE_MAX_SPAN = 35.0;  // Max moisture percentage mapped to WET_ADC

// Voltage Divider Scaling: R1 = 100k, R2 = 10k -> Multiplier = (100+10)/10 = 11.0
// Arduino 5.0V / 1024.0 ADC = 0.0048828 V/step
const float VOLT_DIVIDER_RATIO = 11.0;
const float ADC_VOLT_FACTOR    = (5.0 / 1024.0) * VOLT_DIVIDER_RATIO;

// ==========================================
// SYSTEM THRESHOLDS (SEED PRESERVATION LOGIC)
// ==========================================
// Seed thermal protection: Germination enzymes denature at >42°C in cereals!
float targetMoisture      = 13.0; // Target safe storage moisture (%)
float maxSafeTemp         = 42.0; // Upper critical safe temperature (°C)
float minDryTemp          = 28.0; // Minimum chamber temp for active drying (°C)
float maxAmbientHumidity  = 80.0; // RH threshold where ambient air is too moist to vent

// System States
enum SystemState {
  STATE_IDLE,
  STATE_DRYING,
  STATE_VENTILATING,
  STATE_COMPLETED,
  STATE_ALARM_ERROR
};

SystemState currentState = STATE_IDLE;

// Actuator & Sensor Global Variables
float currentTemp       = 0.0;
float currentHumidity   = 0.0;
float currentMoisture   = 0.0;
int   rawMoistureADC    = 0;
int   rawLdrADC         = 0;
float solarIrradiance   = 0.0; // % estimated solar brightness
float batteryVoltage    = 0.0;
float solarPvVoltage    = 0.0;

bool  fanState          = false;
int   ventAngle         = 0;   // 0 deg = closed, 90 deg = fully open
bool  buzzerActive      = false;
bool  sdCardAvailable   = false;
bool  oledAvailable     = false;

char  currentSeedType[16] = "PADDY";

// Timing Variables (Non-blocking Millis)
unsigned long lastSensorReadTime = 0;
unsigned long lastSerialSendTime = 0;
unsigned long lastSdLogTime      = 0;
unsigned long lastOledUpdateTime = 0;
unsigned long dryingStartTime    = 0;
unsigned long totalDryingSeconds = 0;
unsigned long lastAlarmBeepTime  = 0;

const unsigned long SENSOR_INTERVAL = 1000;  // Read sensors every 1.0s
const unsigned long SERIAL_INTERVAL = 1000;  // Send JSON telemetry every 1.0s
const unsigned long SD_LOG_INTERVAL = 15000; // Log to SD every 15s
const unsigned long OLED_INTERVAL   = 2000;  // Rotate OLED display page every 2s

// Hardware Instances
DHT dht(PIN_DHT, DHTTYPE);
Servo ventServo;
Adafruit_SSD1306 display(OLED_SCREEN_WIDTH, OLED_SCREEN_HEIGHT, &Wire, OLED_RESET);

// ==========================================
// FUNCTION PROTOTYPES
// ==========================================
void readSensors();
void executeAiControlLogic();
void setActuators();
void sendJsonTelemetry();
void logToSdCard();
void updateOledDisplay();
void handleSerialCommands();
void triggerAlarm(bool on);
void setLedStatus(bool normal, bool vent, bool alarm);
float readCalibratedMoisture();
float readFilteredAdc(uint8_t pin, uint8_t samples = 10);

// ==========================================
// ARDUINO SETUP
// ==========================================
void setup() {
  // Initialize Hardware Serial Port
  Serial.begin(115200);
  while (!Serial && millis() < 2000); // Short wait for serial monitor

  // Initialize Pin Modes
  pinMode(PIN_FAN_RELAY, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_LED_NORMAL, OUTPUT);
  pinMode(PIN_LED_VENT, OUTPUT);
  pinMode(PIN_LED_ALARM, OUTPUT);

  // Relay initial state: OFF (Relays are typically Active LOW)
  digitalWrite(PIN_FAN_RELAY, HIGH);
  digitalWrite(PIN_BUZZER, LOW);
  setLedStatus(false, false, false);

  // Initialize Servo
  ventServo.attach(PIN_SERVO_VENT);
  ventServo.write(0); // Close vent flap initially
  ventAngle = 0;

  // Initialize DHT Sensor
  dht.begin();

  // Initialize OLED Display
  if (display.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDR)) {
    oledAvailable = true;
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(8, 12);
    display.println(F("PRAKASHAN AI"));
    display.setCursor(2, 28);
    display.println(F("Smart Solar Seed Dryer"));
    display.setCursor(10, 46);
    display.println(F("Drying solutions..."));
    display.display();
  }

  // Initialize MicroSD Card
  if (SD.begin(PIN_SD_CS)) {
    sdCardAvailable = true;
    File logFile = SD.open("DATALOG.CSV", FILE_WRITE);
    if (logFile) {
      logFile.println(F("Timestamp_s,Temp_C,Humidity_pct,Moisture_pct,Solar_pct,Bat_V,PV_V,Fan,Vent_deg,State"));
      logFile.close();
    }
  }

  delay(1200);
  currentState = STATE_DRYING;
  dryingStartTime = millis();

  Serial.println(F("{\"system\":\"PRAKASHAN_AI\",\"status\":\"BOOT_COMPLETE\",\"tagline\":\"Drying solutions for global agriculture\",\"version\":\"2.0\"}"));
}

// ==========================================
// ARDUINO MAIN LOOP
// ==========================================
void loop() {
  unsigned long currentMillis = millis();

  // 1. Periodic Sensor Acquisition
  if (currentMillis - lastSensorReadTime >= SENSOR_INTERVAL) {
    lastSensorReadTime = currentMillis;
    readSensors();
    executeAiControlLogic();
    setActuators();
  }

  // 2. Periodic JSON Telemetry Stream
  if (currentMillis - lastSerialSendTime >= SERIAL_INTERVAL) {
    lastSerialSendTime = currentMillis;
    sendJsonTelemetry();
  }

  // 3. Periodic MicroSD Logging
  if (sdCardAvailable && (currentMillis - lastSdLogTime >= SD_LOG_INTERVAL)) {
    lastSdLogTime = currentMillis;
    logToSdCard();
  }

  // 4. Periodic OLED Screen Refresh
  if (oledAvailable && (currentMillis - lastOledUpdateTime >= OLED_INTERVAL)) {
    lastOledUpdateTime = currentMillis;
    updateOledDisplay();
  }

  // 5. Handle Incoming Serial Commands from Dashboard / AI core
  if (Serial.available() > 0) {
    handleSerialCommands();
  }
}

// ==========================================
// SENSOR ACQUISITION & FILTERING
// ==========================================
void readSensors() {
  // Read DHT22 Temperature and Humidity
  float h = dht.readHumidity();
  float t = dht.readTemperature();

  // Sensor validity check
  if (!isnan(h) && !isnan(t) && t >= -10.0 && t <= 80.0 && h >= 0.0 && h <= 100.0) {
    currentHumidity = h;
    currentTemp     = t;
  } else {
    // Sensor read glitch fallback
    if (currentTemp == 0.0) currentTemp = 30.0;
    if (currentHumidity == 0.0) currentHumidity = 50.0;
  }

  // Read Capacitive Moisture with Calibration Mapping
  currentMoisture = readCalibratedMoisture();

  // Read LDR Solar Sensor (Invert so higher ADC = brighter sunlight)
  rawLdrADC = 1023 - (int)readFilteredAdc(PIN_LDR_ADC, 8);
  solarIrradiance = constrain((rawLdrADC / 1023.0) * 100.0, 0.0, 100.0);

  // Read Battery & PV Voltages
  float batRaw = readFilteredAdc(PIN_BAT_ADC, 8);
  float pvRaw  = readFilteredAdc(PIN_PV_ADC, 8);
  batteryVoltage = batRaw * ADC_VOLT_FACTOR;
  solarPvVoltage = pvRaw  * ADC_VOLT_FACTOR;

  // Track drying elapsed time
  if (currentState == STATE_DRYING || currentState == STATE_VENTILATING) {
    totalDryingSeconds = (millis() - dryingStartTime) / 1000;
  }
}

// Multi-sample ADC averaging for stable noise-free analog readings
float readFilteredAdc(uint8_t pin, uint8_t samples) {
  long sum = 0;
  for (uint8_t i = 0; i < samples; i++) {
    sum += analogRead(pin);
    delayMicroseconds(100);
  }
  return (float)sum / (float)samples;
}

// Capacitive Sensor Calibration Conversion
float readCalibratedMoisture() {
  rawMoistureADC = (int)readFilteredAdc(PIN_MOISTURE_ADC, 12);

  // When rawMoistureADC is near CALIB_AIR_ADC -> Very dry seed (~5-8%)
  // When rawMoistureADC is near CALIB_WET_ADC -> Saturated seed (~35%)
  float moist = ((CALIB_AIR_ADC - rawMoistureADC) / (CALIB_AIR_ADC - CALIB_WET_ADC)) * MOISTURE_MAX_SPAN;
  moist = constrain(moist, 5.0, 45.0);
  return moist;
}

// ==========================================
// PRAKASHAN AI DECISION & CONTROL LOGIC
// ==========================================
void executeAiControlLogic() {
  // SAFETY CHECK 1: Sensor Malfunction or Disconnection
  if (currentTemp < 0.0 || currentTemp > 75.0 || currentMoisture < 2.0 || currentMoisture > 50.0) {
    currentState = STATE_ALARM_ERROR;
    triggerAlarm(true);
    setLedStatus(false, false, true);
    fanState = false;
    ventAngle = 0;
    return;
  }

  // SAFETY CHECK 2: Seed Germination Thermal Protection Cutoff (> maxSafeTemp)
  if (currentTemp >= maxSafeTemp) {
    currentState = STATE_VENTILATING;
    fanState = true;          // Run blower to flush hot chamber air
    ventAngle = 90;           // Fully open motorized exhaust vent
    setLedStatus(false, true, false);
    triggerAlarm(false);
    return;
  }

  // CHECK 3: Target Moisture Reached (Drying Completion)
  if (currentMoisture <= targetMoisture) {
    currentState = STATE_COMPLETED;
    fanState = false;         // Stop blower to avoid over-drying & cracking
    ventAngle = 10;           // Keep minimal vent to prevent moisture condensation
    setLedStatus(false, false, false);
    triggerAlarm(false);
    return;
  }

  // CHECK 4: Ambient High Humidity Protection (e.g., Rain/Dew RH > 80%)
  if (currentHumidity > maxAmbientHumidity) {
    currentState = STATE_DRYING;
    fanState = true;
    ventAngle = 15;           // Restrict exhaust vent to avoid sucking in wet outside air
    setLedStatus(true, false, false);
    triggerAlarm(false);
    return;
  }

  // DEFAULT 5: Active Smart Drying Optimization
  currentState = STATE_DRYING;
  fanState = true;

  // Proportional vent modulation:
  // If moisture is high (>20%), open vent wider (60°-80°) for rapid moisture removal
  // As moisture approaches target (<16%), reduce vent (30°-45°) to retain solar thermal energy
  if (currentMoisture > 22.0) {
    ventAngle = 75;
  } else if (currentMoisture > 16.0) {
    ventAngle = 45;
  } else {
    ventAngle = 30;
  }

  setLedStatus(true, false, false);
  triggerAlarm(false);
}

// ==========================================
// ACTUATOR DRIVER
// ==========================================
void setActuators() {
  // Relay control (LOW = ON, HIGH = OFF for standard 5V relay module)
  digitalWrite(PIN_FAN_RELAY, fanState ? LOW : HIGH);

  // Position Servo Exhaust Flap
  ventServo.write(constrain(ventAngle, 0, 90));
}

void triggerAlarm(bool on) {
  buzzerActive = on;
  if (on) {
    // Intermittent pulse tone for alarm
    if ((millis() / 400) % 2 == 0) {
      digitalWrite(PIN_BUZZER, HIGH);
    } else {
      digitalWrite(PIN_BUZZER, LOW);
    }
  } else {
    digitalWrite(PIN_BUZZER, LOW);
  }
}

void setLedStatus(bool normal, bool vent, bool alarm) {
  digitalWrite(PIN_LED_NORMAL, normal ? HIGH : LOW);
  digitalWrite(PIN_LED_VENT, vent ? HIGH : LOW);
  digitalWrite(PIN_LED_ALARM, alarm ? HIGH : LOW);
}

// ==========================================
// JSON TELEMETRY STREAM
// ==========================================
void sendJsonTelemetry() {
  const char* stateStr = "IDLE";
  switch (currentState) {
    case STATE_DRYING:      stateStr = "DRYING"; break;
    case STATE_VENTILATING: stateStr = "VENTILATING"; break;
    case STATE_COMPLETED:   stateStr = "COMPLETED"; break;
    case STATE_ALARM_ERROR: stateStr = "ALARM_ERROR"; break;
    default:                stateStr = "IDLE"; break;
  }

  // Compact JSON string formatted for AI Engine & Web Dashboard
  Serial.print(F("{\"temp\":"));
  Serial.print(currentTemp, 1);
  Serial.print(F(",\"hum\":"));
  Serial.print(currentHumidity, 1);
  Serial.print(F(",\"moist\":"));
  Serial.print(currentMoisture, 1);
  Serial.print(F(",\"target_moist\":"));
  Serial.print(targetMoisture, 1);
  Serial.print(F(",\"solar_pct\":"));
  Serial.print(solarIrradiance, 0);
  Serial.print(F(",\"bat_v\":"));
  Serial.print(batteryVoltage, 2);
  Serial.print(F(",\"pv_v\":"));
  Serial.print(solarPvVoltage, 2);
  Serial.print(F(",\"fan\":"));
  Serial.print(fanState ? 1 : 0);
  Serial.print(F(",\"vent\":"));
  Serial.print(ventAngle);
  Serial.print(F(",\"state\":\""));
  Serial.print(stateStr);
  Serial.print(F("\",\"seed\":\""));
  Serial.print(currentSeedType);
  Serial.print(F("\",\"elapsed_s\":"));
  Serial.print(totalDryingSeconds);
  Serial.println(F("}"));
}

// ==========================================
// SD CARD DATA LOGGING
// ==========================================
void logToSdCard() {
  File logFile = SD.open("DATALOG.CSV", FILE_WRITE);
  if (logFile) {
    logFile.print(totalDryingSeconds);
    logFile.print(F(","));
    logFile.print(currentTemp, 1);
    logFile.print(F(","));
    logFile.print(currentHumidity, 1);
    logFile.print(F(","));
    logFile.print(currentMoisture, 1);
    logFile.print(F(","));
    logFile.print(solarIrradiance, 0);
    logFile.print(F(","));
    logFile.print(batteryVoltage, 2);
    logFile.print(F(","));
    logFile.print(solarPvVoltage, 2);
    logFile.print(F(","));
    logFile.print(fanState ? 1 : 0);
    logFile.print(F(","));
    logFile.print(ventAngle);
    logFile.print(F(","));
    logFile.println((int)currentState);
    logFile.close();
  }
}

// ==========================================
// OLED DISPLAY UPDATE
// ==========================================
void updateOledDisplay() {
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);

  // Header Banner
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.print(F("PRAKASHAN ["));
  display.print(currentSeedType);
  display.print(F("]"));

  display.drawLine(0, 10, 127, 10, SSD1306_WHITE);

  // Sensor Telemetry Line 1: Temp & RH
  display.setCursor(0, 14);
  display.print(F("T: "));
  display.print(currentTemp, 1);
  display.print(F("C  RH: "));
  display.print(currentHumidity, 0);
  display.print(F("%"));

  // Sensor Telemetry Line 2: Moisture (Current vs Target)
  display.setCursor(0, 26);
  display.print(F("Moist: "));
  display.print(currentMoisture, 1);
  display.print(F("% -> "));
  display.print(targetMoisture, 0);
  display.print(F("%"));

  // System Power & Actuator Line 3
  display.setCursor(0, 38);
  display.print(F("Bat:"));
  display.print(batteryVoltage, 1);
  display.print(F("V Fan:"));
  display.print(fanState ? F("ON ") : F("OFF"));
  display.print(F(" V:"));
  display.print(ventAngle);
  display.print(F("o"));

  // Status Footer
  display.drawLine(0, 50, 127, 50, SSD1306_WHITE);
  display.setCursor(0, 54);
  switch (currentState) {
    case STATE_DRYING:
      display.print(F("STATUS: DRYING..."));
      break;
    case STATE_VENTILATING:
      display.print(F("WARN: OVERHEAT VENT"));
      break;
    case STATE_COMPLETED:
      display.print(F("SUCCESS: DRY COMPLETE"));
      break;
    case STATE_ALARM_ERROR:
      display.print(F("ERROR: CHECK SENSORS"));
      break;
    default:
      display.print(F("STATUS: STANDBY"));
      break;
  }

  display.display();
}

// ==========================================
// SERIAL COMMAND INTERFACE
// ==========================================
void handleSerialCommands() {
  String cmd = Serial.readStringUntil('\n');
  cmd.trim();

  if (cmd.startsWith("SET_TARGET:")) {
    float val = cmd.substring(11).toFloat();
    if (val >= 6.0 && val <= 25.0) {
      targetMoisture = val;
      Serial.print(F("{\"ack\":\"TARGET_SET\",\"value\":"));
      Serial.print(targetMoisture);
      Serial.println(F("}"));
    }
  } else if (cmd.startsWith("SET_SEED:")) {
    String seed = cmd.substring(9);
    seed.toUpperCase();
    seed.toCharArray(currentSeedType, 15);

    // Preset target moisture and thermal safety limits per crop
    if (seed == "PADDY" || seed == "RICE") {
      targetMoisture = 13.0; maxSafeTemp = 42.0;
    } else if (seed == "WHEAT") {
      targetMoisture = 12.0; maxSafeTemp = 40.0;
    } else if (seed == "MAIZE" || seed == "CORN") {
      targetMoisture = 13.5; maxSafeTemp = 43.0;
    } else if (seed == "SOYBEAN") {
      targetMoisture = 11.0; maxSafeTemp = 38.0;
    } else if (seed == "MUSTARD") {
      targetMoisture = 8.5;  maxSafeTemp = 36.0;
    }

    Serial.print(F("{\"ack\":\"SEED_PROFILE_LOADED\",\"seed\":\""));
    Serial.print(currentSeedType);
    Serial.print(F("\",\"target\":"));
    Serial.print(targetMoisture);
    Serial.print(F(",\"max_temp\":"));
    Serial.print(maxSafeTemp);
    Serial.println(F("}"));
  } else if (cmd == "START") {
    currentState = STATE_DRYING;
    dryingStartTime = millis();
    Serial.println(F("{\"ack\":\"DRYING_STARTED\"}"));
  } else if (cmd == "STOP") {
    currentState = STATE_IDLE;
    fanState = false;
    ventAngle = 0;
    setActuators();
    Serial.println(F("{\"ack\":\"DRYING_STOPPED\"}"));
  } else if (cmd == "CALIB_AIR") {
    CALIB_AIR_ADC = readFilteredAdc(PIN_MOISTURE_ADC, 20);
    Serial.print(F("{\"ack\":\"CALIB_AIR_SAVED\",\"adc\":"));
    Serial.print(CALIB_AIR_ADC);
    Serial.println(F("}"));
  } else if (cmd == "CALIB_WET") {
    CALIB_WET_ADC = readFilteredAdc(PIN_MOISTURE_ADC, 20);
    Serial.print(F("{\"ack\":\"CALIB_WET_SAVED\",\"adc\":"));
    Serial.print(CALIB_WET_ADC);
    Serial.println(F("}"));
  }
}
