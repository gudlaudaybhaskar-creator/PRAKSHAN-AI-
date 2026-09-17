# PRAKASHAN AI
### AI-Powered Smart Solar Seed Dryer & Germination Preserver
> **"Drying solutions for global agriculture"**
> *A Low-Cost, Renewable Energy Agricultural Innovation for MSMEs, Seed Banks, and Smallholder Farmers*

---

## 🌾 Project Overview

**PRAKASHAN AI** is an intelligent solar-powered agricultural seed dryer engineered on the **Arduino Uno (ATmega328P)**. It combines physics-informed thin-layer drying kinetics and lightweight machine learning to achieve the target seed moisture content safely without degrading embryo vitality or germination vigor.

---

## 🚀 Key System Features

1. **Intelligent Microclimate Control**: Real-time closed-loop monitoring of chamber temperature, relative humidity, and capacitive seed moisture.
2. **Seed Germination Embryo Protection**: Automated thermal cutoff preventing drying chamber temperatures from exceeding critical limits ($36\text{--}43^\circ\text{C}$ per seed species).
3. **Adaptive Airflow & Motorized Exhaust Flap**: Modulates 12V DC blower and servo-driven exhaust flap based on instantaneous moisture gradient and solar irradiance.
4. **AI Remaining Drying Time Predictor**: Hybrid Page Thin-Layer Kinetics + Machine Learning Regressor forecasting remaining drying duration (hours/minutes) and future moisture decay curves.
5. **Off-Grid Solar Powered**: Sized for standard 50W–100W 12V Solar PV panel, 12V deep-cycle battery, and solar charge controller.
6. **Modern Interactive Web Dashboard**: Features direct browser **Web Serial USB connection** to Arduino Uno, official branding logo, and a built-in **Real-Time Simulation Engine** with dynamic Chart.js telemetry graphs.
7. **Offline MicroSD Data Logger**: Records time-series drying logs in CSV format for research, compliance, and seed certification records.

---

## 📁 Repository Structure

```text
prakshan_ai/
│
├── arduino/
│   ├── prakshan_ai.ino                         # Arduino Uno firmware (wired USB Serial only)
│   └── prakshan_ai_esp32_wifi/
│       └── prakshan_ai_esp32_wifi.ino          # ESP32 wireless firmware (Wi-Fi AP + BLE)
│
├── python/
│   ├── requirements.txt                # Python dependencies
│   ├── dataset_generator.py            # Agricultural thin-layer drying dataset synthesizer
│   ├── train_model.py                  # Scikit-Learn training & Edge ML parameter exporter
│   ├── prakshan_ai_core.py             # Real-time serial bridge & offline inference engine
│   ├── server.py                       # Cloud/Local HTTP API & Web Server
│   └── edge_model_weights.json         # Standalone zero-dependency edge weights
│
├── dashboard/
│   ├── logo.jpg                        # Official Prakashan AI Brand Logo
│   ├── index.html                      # Modern responsive web dashboard UI
│   ├── styles.css                      # Glassmorphism dark/light agricultural tech styling
│   ├── app.js                          # Web Serial API & simulation controller
│   ├── manifest.json                   # Android PWA & APK Web Manifest
│   ├── sw.js                           # Offline caching service worker
│   ├── vercel.json                     # Vercel cloud deployment config
│   └── netlify.toml                    # Netlify cloud deployment config
│
├── docs/
│   ├── deployment_guide.md             # Complete cloud, edge & web deployment manual
│   ├── apk_build_guide.md              # Step-by-step Android APK compilation guide
│   ├── circuit_diagram.md              # Wiring schematics, pinout matrix & solar sizing
│   ├── sensor_calibration.md           # 2-point capacitive sensor calibration guide
│   └── testing_and_troubleshooting.md  # Bench test protocol & troubleshooting matrix
│
└── README.md                           # Master system documentation
```

---

## 📡 ESP32 Wireless Connectivity (Wi-Fi + Bluetooth LE)

The ESP32 firmware (`arduino/prakshan_ai_esp32_wifi/prakshan_ai_esp32_wifi.ino`) provides **dual wireless connectivity** — a Wi-Fi Access Point and a BLE GATT server running simultaneously.

### Wi-Fi Access Point
| Parameter  | Value                        |
| :--------- | :--------------------------- |
| SSID       | `PRAKASHAN_AI_DRYER`         |
| Password   | `prakashan123`               |
| Default IP | `192.168.4.1`                |
| Endpoint   | `http://192.168.4.1/api/telemetry` |

### Bluetooth Low Energy (BLE)
| Parameter            | Value                                            |
| :------------------- | :----------------------------------------------- |
| Device Name          | `PRAKASHAN_AI_DRYER_BLE`                         |
| Service (NUS)        | `6e400001-b5a3-f393-e0a9-e50e24dcca9e`           |
| TX Characteristic    | `6e400003-b5a3-f393-e0a9-e50e24dcca9e` (Notify)  |
| RX Characteristic    | `6e400002-b5a3-f393-e0a9-e50e24dcca9e` (Write)   |
| Telemetry Format     | Newline-terminated JSON (same schema as `/api/telemetry`) |

> **Library Note:** The firmware uses the **built-in ESP32 BLE library** (`BLEDevice.h`) that ships with the ESP32 Arduino Core. No additional library installation is needed. If you experience RAM pressure or reliability issues on older ESP32 modules, you may optionally switch to the [NimBLE-Arduino](https://github.com/h2zero/NimBLE-Arduino) library (install via Library Manager).

### Quick Verification Checklist
1. Upload the sketch to your ESP32 board (Arduino IDE → Board: "ESP32 Dev Module").
2. Open Serial Monitor at **115200 baud**.
3. Confirm the boot summary shows:
   - `[Wi-Fi] Access Point Created successfully.` with the AP IP address.
   - `[BLE] BLE advertising started.` with the device name.
4. **Test Wi-Fi:** Join the `PRAKASHAN_AI_DRYER` network, then open `http://192.168.4.1/api/telemetry` in a browser.
5. **Test BLE:** Open the dashboard (`dashboard/index.html`) in Chrome, click **"Connect Bluetooth"**, select `PRAKASHAN_AI_DRYER_BLE`, and verify live telemetry streams in.

---

## ⚡ Quickstart Guide

### 1. Uploading Arduino Firmware
1. Open the [Arduino IDE](https://www.arduino.cc/en/software).
2. Install required libraries via the Library Manager:
   - `DHT sensor library` by Adafruit
   - `Adafruit SSD1306` & `Adafruit GFX Library`
   - `Servo` (Built-in)
   - `SD` (Built-in)
3. Open `arduino/prakshan_ai.ino`.
4. Select **Arduino Uno** and your COM port, then click **Upload**.

### 2. Launching the Web Dashboard
1. Open `dashboard/index.html` directly in **Google Chrome** or **Microsoft Edge**.
2. To test with physical hardware: Click **"Connect USB Serial"**, select your Arduino Uno port, and watch live data stream!
3. To test without physical hardware: Leave **Simulation Mode** active to observe live drying cycles, heat spikes, and AI estimations.

### 3. Running the Python AI Engine (Optional)
```bash
cd python
python prakshan_ai_core.py
```

---

## 📊 Crop Profiles & Preset Specifications

| Seed Type | Target Moisture (%) | Safe Max Temp (°C) | Optimum Drying Range (°C) |
| :--- | :---: | :---: | :---: |
| **Paddy (Rice)** | 13.0% | 42.0°C | 35°C – 40°C |
| **Wheat** | 12.0% | 40.0°C | 32°C – 38°C |
| **Maize (Corn)** | 13.5% | 43.0°C | 36°C – 41°C |
| **Soybean** | 11.0% | 38.0°C | 30°C – 35°C |
| **Mustard** | 8.5% | 36.0°C | 28°C – 34°C |

---

## 💡 MSME Innovation & Cost Advantage

- **Total Prototype BOM Cost**: $\approx \$45 \text{--} \$65$ (Excluding solar panel & battery).
- **Zero Operating Electricity Cost**: 100% solar thermal + 12V PV powered.
- **High Germination Preservation**: Prevents thermal damage caused by uncontrolled open-sun drying, preserving up to 98% seed germination rate.
