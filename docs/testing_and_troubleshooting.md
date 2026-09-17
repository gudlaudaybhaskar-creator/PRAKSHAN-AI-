# Testing Protocol & Troubleshooting Guide: PRAKASHAN AI
### "Drying solutions for global agriculture"

This document provides agricultural guidelines, bench test procedures, telemetry packet samples, and systematic troubleshooting steps for the **Prakashan AI Smart Solar Seed Dryer**.

---

## 1. Agricultural Germination Safety Limits Matrix

Maintaining seed temperature strictly below crop-specific thermal thresholds is critical. If seed temperature exceeds the safe limit, seed proteins and germination enzymes denature, permanently destroying seed vigor.

| Crop / Seed Type | Safe Storage Moisture (%) | Max Safe Chamber Temp (°C) | Optimum Drying Temp Range (°C) | Airflow Requirement |
| :--- | :--- | :--- | :--- | :--- |
| **Paddy (Rice)** | **13.0%** | **42.0°C** | 35.0°C – 40.0°C | Moderate (50–70 CFM) |
| **Wheat** | **12.0%** | **40.0°C** | 32.0°C – 38.0°C | High (60–80 CFM) |
| **Maize (Corn)** | **13.5%** | **43.0°C** | 36.0°C – 41.0°C | High (70–90 CFM) |
| **Soybean** | **11.0%** | **38.0°C** | 30.0°C – 35.0°C | Gentle (40–55 CFM) |
| **Mustard / Rapeseed** | **8.5%** | **36.0°C** | 28.0°C – 34.0°C | Gentle (35–50 CFM) |

---

## 2. Step-by-Step Hardware Bench Testing Protocol

Follow these steps prior to loading seed into the drying chamber:

### Step 1: Power-On Self-Test (POST)
1. Connect the regulated 5V power supply to Arduino Uno.
2. Confirm the OLED display illuminates and displays the **PRAKASHAN AI** boot splash screen.
3. Observe the Serial Monitor at **115200 baud**. You should see the boot message:
   ```json
   {"system":"PRAKASHAN_AI","status":"BOOT_COMPLETE","tagline":"Drying solutions for global agriculture","version":"2.0"}
   ```

### Step 2: Actuator & Relay Verification
1. Open the Serial Monitor and send: `START`.
2. Confirm the Relay click is heard, the Green Status LED turns ON, and the 12V Blower Fan begins spinning.
3. Observe the Servo Motor moving the exhaust flap from 0° (closed) to 45°/75°.
4. Send command `STOP` and ensure the fan stops immediately and the flap closes to 0°.

### Step 3: High-Temperature Overheat Protection Simulation
1. Gently warm the DHT22 sensor with warm air (e.g. hairdryer held at distance) until temperature crosses $42^\circ\text{C}$.
2. Verify:
   - System state switches immediately from `DRYING` to `VENTILATING`.
   - Yellow LED turns ON.
   - Servo flap swings to **90° (Full Exhaust Flush)**.
   - Blower fan runs at maximum power to evacuate hot air.

### Step 4: MicroSD Card Data Logging Verification
1. Power down the system, remove the MicroSD card, and insert it into a PC.
2. Open `DATALOG.CSV` and verify recorded entries:
   ```csv
   Timestamp_s,Temp_C,Humidity_pct,Moisture_pct,Solar_pct,Bat_V,PV_V,Fan,Vent_deg,State
   15,35.4,46.2,19.2,85,12.65,18.20,1,45,1
   30,35.6,45.8,19.1,86,12.64,18.15,1,45,1
   ```

---

## 3. Sample Telemetry Packets & AI Model Output

### Arduino Uno Raw Telemetry JSON (Sent over Serial every 1.0s):
```json
{
  "temp": 36.8,
  "hum": 44.5,
  "moist": 18.2,
  "target_moist": 13.0,
  "solar_pct": 82,
  "bat_v": 12.65,
  "pv_v": 18.20,
  "fan": 1,
  "vent": 45,
  "state": "DRYING",
  "seed": "PADDY",
  "elapsed_s": 3600
}
```

### Prakashan AI Prediction Engine Output:
```json
{
  "temp": 36.8,
  "hum": 44.5,
  "moist": 18.2,
  "ai_insights": {
    "estimated_remaining_mins": 144.5,
    "estimated_remaining_hrs": 2.41,
    "emc_pct": 11.45,
    "germination_health_pct": 100,
    "max_safe_temp_c": 42.0,
    "moisture_delta": 5.2,
    "drying_efficiency_score": 93.4,
    "forecast_curve": [
      {"t_offset_mins": 30, "predicted_moisture": 17.12},
      {"t_offset_mins": 60, "predicted_moisture": 16.04},
      {"t_offset_mins": 90, "predicted_moisture": 14.96},
      {"t_offset_mins": 120, "predicted_moisture": 13.88}
    ],
    "active_alerts": []
  }
}
```

---

## 4. Comprehensive Troubleshooting Matrix

| Symptom / Fault | Potential Root Cause | Recommended Corrective Action |
| :--- | :--- | :--- |
| **OLED displays "CHECK SENSORS" & Buzzer beeping** | DHT22 pin loose, or moisture reading $<2\%$ or $>50\%$ | Check D2 connection. Inspect capacitive probe wiring on A0. Ensure probe is inserted in seed bed. |
| **Blower Fan does not turn ON when State is "DRYING"** | Relay coil not energized or 12V battery discharged | Check Relay VCC (5V) and IN (D8). Verify battery voltage is $>11.8\,\text{V}$ on Pin A2. Check relay NO/COM terminals. |
| **Servo flap jittering or resetting Arduino** | Servo motor drawing peak current spikes from Arduino 5V pin | Power servo motor VCC from a dedicated 5V buck converter output rail with common GND (never directly from Arduino 5V pin during high load). |
| **Moisture reading fluctuates rapidly** | Electrical noise on analog input line | Ensure multi-sample averaging is enabled (in code: `readFilteredAdc(PIN_MOISTURE_ADC, 12)`). Add $0.1\,\mu\text{F}$ capacitor across A0 and GND. |
| **Drying time estimation is too long (>10 hours)** | Chamber humidity is excessively high, or solar collector shaded | Ensure exhaust vent is open. Clear any obstructions from solar air inlet duct. |
| **SD card initialization failed (`SD.begin() fails`)** | SPI wiring error or card not formatted as FAT16/FAT32 | Ensure CS is connected to Pin 10, MOSI to D11, MISO to D12, SCK to D13. Format SD card with FAT32 file system. |
| **Web Serial connection error in Dashboard** | Browser permissions or baud rate mismatch | Use Google Chrome / Microsoft Edge. Ensure baud rate is set to **115200**. Close any other Arduino Serial Monitor windows before connecting. |

---

## 5. ESP32 Wireless (Wi-Fi + BLE) Boot Verification

After uploading `arduino/prakshan_ai_esp32_wifi/prakshan_ai_esp32_wifi.ino` to your ESP32:

### Quick Boot Checklist
1. Open Serial Monitor at **115200 baud** and press the ESP32 RESET button.
2. Confirm you see the boot summary block with:
   - `[Wi-Fi] Access Point Created successfully.` — AP SSID, password, and IP printed.
   - `[BLE] BLE advertising started.` — device name `PRAKASHAN_AI_DRYER_BLE` printed.
3. If either radio fails, the boot summary will show `FAILED` for that radio — check the detailed error messages above the summary.

### Wi-Fi AP Verification
1. On your phone or laptop, scan for Wi-Fi networks.
2. Connect to **PRAKASHAN_AI_DRYER** (password: `prakashan123`).
3. Open a browser and navigate to `http://192.168.4.1/api/telemetry`.
4. You should see a JSON response with live sensor telemetry.

### BLE Verification
1. Open `dashboard/index.html` in **Google Chrome** (desktop or Android).
2. Click **"Connect Bluetooth"**.
3. In the device picker, select **PRAKASHAN_AI_DRYER_BLE**.
4. Confirm the dashboard status shows "BLUETOOTH WIRELESS CONNECTED" and live telemetry values update every ~1 second.

### BLE UUIDs (for nRF Connect or other BLE debugging tools)
| UUID | Role |
| :--- | :--- |
| `6e400001-b5a3-f393-e0a9-e50e24dcca9e` | Nordic UART Service |
| `6e400002-b5a3-f393-e0a9-e50e24dcca9e` | RX Characteristic (Write — phone → device) |
| `6e400003-b5a3-f393-e0a9-e50e24dcca9e` | TX Characteristic (Notify — device → phone) |

---

## 6. ESP32 Wireless Troubleshooting Matrix

| Symptom / Fault | Potential Root Cause | Recommended Corrective Action |
| :--- | :--- | :--- |
| **Serial shows `softAP() failed` repeatedly** | Brownout reset due to insufficient power supply, or Wi-Fi/BLE coexistence issue | Use a USB cable plugged into a powered hub (not a passive splitter). Ensure the ESP32 is powered by a 5V/1A+ source. Try a different ESP32 board. |
| **Wi-Fi AP starts but BLE does not advertise** | Insufficient heap memory, or BLE init failure | Check Serial for `[BLE]` error messages. Reduce Wi-Fi TX power: add `WiFi.setTxPower(WIFI_POWER_8_5dBm);` before `WiFi.softAP()`. Try flashing a minimal BLE-only sketch to confirm the BLE radio works. |
| **Dashboard "Connect Bluetooth" shows no devices** | Web Bluetooth not enabled, or device not advertising | Ensure you're using Chrome (not Firefox/Safari). Check `chrome://bluetooth-internals` for nearby devices. Verify Serial Monitor shows `[BLE] BLE advertising started.` |
| **BLE connects but telemetry data is garbled** | MTU mismatch or chunk reassembly issue | The firmware chunks notifications at 20 bytes. The dashboard reassembles newline-terminated lines. Ensure no other BLE apps are connected to the same device simultaneously. |
| **BLE disconnects and doesn't reconnect** | Advertising not restarting after disconnect | Serial should show `[BLE] Client disconnected — restarting advertising...`. If not, reset the ESP32. This is handled automatically in the firmware's `onDisconnect` callback. |
| **Both Wi-Fi and BLE work but ESP32 reboots randomly** | Power supply brownout under dual-radio load | The ESP32 draws ~240mA peak with both radios active. Use a robust 5V/2A USB power supply. Add a 100µF capacitor across the ESP32 3.3V and GND pins. |

