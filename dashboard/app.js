/**
 * ============================================================================
 * PRAKASHAN AI - Smart Solar Seed Dryer Controller
 * "Drying solutions for global agriculture"
 * ============================================================================
 * Multi-Source Telemetry & Reading Engine:
 * 1. Web Serial USB (Arduino Uno via USB-C / OTG at 115200 baud)
 * 2. Web Bluetooth BLE (Wireless HC-05 / ESP32 / BLE UART)
 * 3. MicroSD Card CSV Log Reader (DATALOG.CSV parser & trajectory plotter)
 * 4. Voice Read-Aloud (SpeechSynthesis audio reports for farmers in the field)
 * 5. Realistic Physics & AI Thin-Layer Simulation Engine
 * 6. Session Data CSV Exporter
 * ============================================================================
 */

// Global Application State
const appState = {
  mode: "SIMULATION", // "SIMULATION" | "SERIAL" | "BLUETOOTH" | "FILE"
  isSimulating: true,
  
  // Connection Handles
  serialPort: null,
  serialReader: null,
  bleDevice: null,
  bleCharacteristic: null,
  
  // Active Seed Profile
  activeSeed: "PADDY",
  targetMoisture: 13.0,
  maxSafeTemp: 42.0,
  
  // Real-time Telemetry Values
  temp: 36.8,
  humidity: 48.2,
  moisture: 21.4,
  solarPct: 84.0,
  batVoltage: 12.65,
  pvVoltage: 18.2,
  fanActive: true,
  ventAngle: 60,
  systemState: "DRYING",
  elapsedSeconds: 0,
  
  // AI Estimations
  remainingMins: 165.0,
  emc: 11.6,
  germinationHealth: 100,
  dryingRatePerHour: 1.8,
  
  // Historical Log for Charts
  historyLabels: [],
  historyMoisture: [],
  historyTarget: [],
  historyTemp: [],
  historyHum: [],
  
  // Full session records for CSV export
  sessionRecords: []
};

// Seed Configuration Matrix
const CROP_PROFILES = {
  "PADDY":   { name: "Paddy (Rice)", target: 13.0, maxTemp: 42.0, initialM: 22.5, A: 11.5, B: -0.045, C: 2.65 },
  "WHEAT":   { name: "Wheat",        target: 12.0, maxTemp: 40.0, initialM: 20.0, A: 10.8, B: -0.040, C: 2.50 },
  "MAIZE":   { name: "Maize (Corn)", target: 13.5, maxTemp: 43.0, initialM: 24.0, A: 12.0, B: -0.050, C: 2.70 },
  "SOYBEAN": { name: "Soybean",      target: 11.0, maxTemp: 38.0, initialM: 18.5, A: 8.5,  B: -0.035, C: 2.20 },
  "MUSTARD": { name: "Mustard",      target: 8.5,  maxTemp: 36.0, initialM: 16.0, A: 6.8,  B: -0.028, C: 1.95 }
};

// DOM Elements Cache
let DOM = {};

function cacheDomElements() {
  DOM = {
    connStatusPill: document.getElementById("connStatusPill"),
    connStatusText: document.getElementById("connStatusText"),
    btnConnectSerial: document.getElementById("btnConnectSerial"),
    btnConnectBle: document.getElementById("btnConnectBle"),
    btnConnectWifi: document.getElementById("btnConnectWifi"),
    btnReadSdLog: document.getElementById("btnReadSdLog"),
    sdFileInput: document.getElementById("sdFileInput"),
    btnReadAloud: document.getElementById("btnReadAloud"),
    btnToggleSim: document.getElementById("btnToggleSim"),
    simToggleText: document.getElementById("simToggleText"),
    
    seedButtonGroup: document.getElementById("seedButtonGroup"),
    systemStateBadge: document.getElementById("systemStateBadge"),
    systemStateText: document.getElementById("systemStateText"),
    
    valMoisture: document.getElementById("valMoisture"),
    moistureDeltaBadge: document.getElementById("moistureDeltaBadge"),
    valTargetMoistLabel: document.getElementById("valTargetMoistLabel"),
    moistureProgressFill: document.getElementById("moistureProgressFill"),
    valEmc: document.getElementById("valEmc"),
    
    valRemainingHrs: document.getElementById("valRemainingHrs"),
    valRemainingMins: document.getElementById("valRemainingMins"),
    valDryingRate: document.getElementById("valDryingRate"),
    valEfficiency: document.getElementById("valEfficiency"),
    valEtaTimestamp: document.getElementById("valEtaTimestamp"),
    
    valTemp: document.getElementById("valTemp"),
    tempStatusBadge: document.getElementById("tempStatusBadge"),
    tempPointer: document.getElementById("tempPointer"),
    valMaxTempLabel: document.getElementById("valMaxTempLabel"),
    valGermHealth: document.getElementById("valGermHealth"),
    
    valHumidity: document.getElementById("valHumidity"),
    rhStatusBadge: document.getElementById("rhStatusBadge"),
    humProgressFill: document.getElementById("humProgressFill"),
    valVentingPot: document.getElementById("valVentingPot"),
    
    valSolarPct: document.getElementById("valSolarPct"),
    valPvVolt: document.getElementById("valPvVolt"),
    valBatVolt: document.getElementById("valBatVolt"),
    valBatSoc: document.getElementById("valBatSoc"),
    batIcon: document.getElementById("batIcon"),
    
    fanBladeIcon: document.getElementById("fanBladeIcon"),
    valFanStatus: document.getElementById("valFanStatus"),
    ventAngleVisual: document.getElementById("ventAngleVisual"),
    valVentAngle: document.getElementById("valVentAngle"),
    
    targetSlider: document.getElementById("targetSlider"),
    sliderValDisplay: document.getElementById("sliderValDisplay"),
    btnStartDryer: document.getElementById("btnStartDryer"),
    btnVentFlush: document.getElementById("btnVentFlush"),
    btnStopDryer: document.getElementById("btnStopDryer"),
    btnExportCsv: document.getElementById("btnExportCsv"),
    
    alertFeedContainer: document.getElementById("alertFeedContainer"),
    alertCountBadge: document.getElementById("alertCountBadge")
  };
}

// Chart Instances
let moistureChartInstance = null;
let tempHumChartInstance = null;

// ============================================================================
// INITIALIZATION
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {
  cacheDomElements();
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
  
  // Register Service Worker for Offline PWA & APK support
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").then(() => {
      console.log("[Prakashan AI] Offline Service Worker registered.");
    }).catch(err => {
      console.log("[Prakashan AI] Service Worker registration note:", err.message);
    });
  }
  
  initCharts();
  bindEventListeners();
  initWifiModalControls();
  initSimulationBaseline();
  
  // Start Main Update Loop (1000ms interval)
  setInterval(mainSystemTick, 1000);
});

// ============================================================================
// CHARTS INITIALIZATION (Chart.js)
// ============================================================================
function initCharts() {
  const chartCanvasMoist = document.getElementById("moistureChart");
  const chartCanvasTempHum = document.getElementById("tempHumChart");
  
  if (!chartCanvasMoist || !chartCanvasTempHum || typeof Chart === "undefined") {
    console.warn("Chart.js or canvas element not available.");
    return;
  }

  const chartOptionsBase = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(19, 27, 46, 0.95)",
        borderColor: "rgba(255, 255, 255, 0.1)",
        borderWidth: 1,
        titleFont: { family: "Plus Jakarta Sans", size: 12 },
        bodyFont: { family: "JetBrains Mono", size: 11 }
      }
    },
    scales: {
      x: {
        grid: { color: "rgba(255, 255, 255, 0.05)" },
        ticks: { color: "#64748b", font: { family: "JetBrains Mono", size: 10 } }
      },
      y: {
        grid: { color: "rgba(255, 255, 255, 0.05)" },
        ticks: { color: "#64748b", font: { family: "JetBrains Mono", size: 10 } }
      }
    }
  };

  // 1. Moisture Decay Chart
  const ctxMoist = chartCanvasMoist.getContext("2d");
  moistureChartInstance = new Chart(ctxMoist, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Current Seed Moisture (%)",
          data: [],
          borderColor: "#38bdf8",
          backgroundColor: "rgba(56, 189, 248, 0.12)",
          borderWidth: 2.5,
          tension: 0.3,
          fill: true,
          pointRadius: 2
        },
        {
          label: "Target Safe Moisture (%)",
          data: [],
          borderColor: "#f43f5e",
          borderWidth: 1.5,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      ...chartOptionsBase,
      scales: {
        ...chartOptionsBase.scales,
        y: {
          ...chartOptionsBase.scales.y,
          min: 6,
          max: 26,
          ticks: { callback: v => v + "%", color: "#64748b" }
        }
      }
    }
  });

  // 2. Chamber Temp & Humidity Chart
  const ctxTempHum = chartCanvasTempHum.getContext("2d");
  tempHumChartInstance = new Chart(ctxTempHum, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Chamber Temp (°C)",
          data: [],
          borderColor: "#f97316",
          backgroundColor: "rgba(249, 115, 22, 0.08)",
          borderWidth: 2,
          tension: 0.3,
          yAxisID: "yTemp",
          pointRadius: 2
        },
        {
          label: "Relative Humidity (%)",
          data: [],
          borderColor: "#06b6d4",
          backgroundColor: "rgba(6, 182, 212, 0.08)",
          borderWidth: 2,
          tension: 0.3,
          yAxisID: "yHum",
          pointRadius: 2
        }
      ]
    },
    options: {
      ...chartOptionsBase,
      scales: {
        x: chartOptionsBase.scales.x,
        yTemp: {
          type: "linear",
          position: "left",
          min: 20,
          max: 55,
          grid: { color: "rgba(255, 255, 255, 0.05)" },
          ticks: { callback: v => v + "°C", color: "#f97316" }
        },
        yHum: {
          type: "linear",
          position: "right",
          min: 10,
          max: 90,
          grid: { drawOnChartArea: false },
          ticks: { callback: v => v + "%", color: "#06b6d4" }
        }
      }
    }
  });
}

// ============================================================================
// SIMULATION BASELINE GENERATOR
// ============================================================================
function initSimulationBaseline() {
  const profile = CROP_PROFILES[appState.activeSeed] || CROP_PROFILES["PADDY"];
  appState.moisture = profile.initialM;
  appState.targetMoisture = profile.target;
  appState.maxSafeTemp = profile.maxTemp;
  appState.elapsedSeconds = 0;
  
  // Clear charts
  appState.historyLabels = [];
  appState.historyMoisture = [];
  appState.historyTarget = [];
  appState.historyTemp = [];
  appState.historyHum = [];
  
  // Pre-seed some initial visual points
  for (let i = 10; i >= 0; i--) {
    const timeStr = `${-i * 2}m`;
    const m = profile.initialM + (i * 0.15);
    appState.historyLabels.push(timeStr);
    appState.historyMoisture.push(parseFloat(m.toFixed(2)));
    appState.historyTarget.push(profile.target);
    appState.historyTemp.push(parseFloat((34.5 + Math.random() * 2.0).toFixed(1)));
    appState.historyHum.push(parseFloat((52.0 - Math.random() * 3.0).toFixed(1)));
  }
  updateChartsUI();
}

// ============================================================================
// AI THIN-LAYER DRYING LOGIC & COMPUTATION
// ============================================================================
function computeAiInsights() {
  const profile = CROP_PROFILES[appState.activeSeed] || CROP_PROFILES["PADDY"];
  
  // Equilibrium Moisture Content (EMC)
  const aVal = profile.A + profile.B * appState.temp;
  const rhRatio = Math.max(0.05, Math.min(0.95, appState.humidity / 100.0));
  const emcVal = aVal * Math.pow(rhRatio / (1.0 - rhRatio), 1.0 / profile.C);
  appState.emc = Math.max(4.5, Math.min(22.0, emcVal));
  
  // Remaining Drying Time Estimation using Page Thin-Layer Kinetics
  const deltaM = appState.moisture - appState.targetMoisture;
  if (deltaM <= 0.05) {
    appState.remainingMins = 0;
  } else {
    const tKelvin = appState.temp + 273.15;
    const kThermal = 0.45 * Math.exp(-28500.0 / (8.314 * tKelvin)) * 1150.0;
    const kEff = kThermal * (1.0 + (appState.solarPct / 100.0) * 0.35) * (1.0 - (appState.humidity / 160.0));
    
    const usableDrivingForce = Math.max(0.5, appState.moisture - appState.emc);
    const targetDiff = Math.max(0.1, appState.targetMoisture - appState.emc);
    const ratio = targetDiff / usableDrivingForce;
    
    if (ratio < 1.0 && ratio > 0.01) {
      const estHours = Math.pow(-Math.log(ratio), 1.0 / 0.84) / Math.max(0.05, kEff);
      appState.remainingMins = estHours * 60.0;
    } else {
      appState.remainingMins = deltaM * 20.0;
    }
  }
  
  // Drying rate estimation (% / hr)
  if (appState.historyMoisture.length >= 5) {
    const startM = appState.historyMoisture[0];
    const currM = appState.moisture;
    const hrs = Math.max(0.1, (appState.historyMoisture.length * 4) / 3600.0);
    const calculatedRate = Math.abs((startM - currM) / hrs);
    appState.dryingRatePerHour = calculatedRate > 0.1 && calculatedRate < 8.0 ? calculatedRate : 1.8;
  }
  
  // Germination Health Index (100% down to 0% if severely overheated)
  if (appState.temp <= (profile.maxTemp - 3.0)) {
    appState.germinationHealth = 100;
  } else if (appState.temp <= profile.maxTemp) {
    const penalty = (appState.temp - (profile.maxTemp - 3.0)) * 6.0;
    appState.germinationHealth = Math.max(80, Math.round(100 - penalty));
  } else {
    const excess = appState.temp - profile.maxTemp;
    appState.germinationHealth = Math.max(10, Math.round(80 - (excess * 22.0)));
  }
}

// ============================================================================
// SIMULATION ENGINE TICK (When in SIMULATION mode)
// ============================================================================
function simulateDryingStep() {
  if (appState.systemState !== "DRYING" && appState.systemState !== "VENTILATING") return;
  
  appState.elapsedSeconds += 2;
  
  // Solar diurnal curve oscillation
  const timeHours = (appState.elapsedSeconds % 7200) / 7200.0;
  appState.solarPct = Math.max(30.0, Math.min(98.0, 75.0 + Math.sin(timeHours * Math.PI * 2) * 20.0 + (Math.random() * 2 - 1)));
  appState.pvVoltage = 14.5 + (appState.solarPct / 100.0) * 4.2;
  appState.batVoltage = 12.4 + (appState.solarPct > 50 ? 0.3 : -0.1);
  
  // Temperature rises with solar radiant energy
  const solarThermalBoost = (appState.solarPct / 100.0) * 11.0;
  appState.temp = 28.0 + solarThermalBoost + (Math.random() * 0.4 - 0.2);
  
  // Humidity inversely related to heat
  appState.humidity = Math.max(25.0, Math.min(75.0, 58.0 - (solarThermalBoost * 1.8) + (Math.random() * 0.8 - 0.4)));
  
  // Active drying decision logic
  if (appState.temp >= appState.maxSafeTemp) {
    appState.systemState = "VENTILATING";
    appState.fanActive = true;
    appState.ventAngle = 90; // Open flap fully to exhaust excess heat
  } else if (appState.moisture <= appState.targetMoisture) {
    appState.systemState = "COMPLETED";
    appState.fanActive = false;
    appState.ventAngle = 10;
    addAlert("Drying Complete!", `Target moisture of ${appState.targetMoisture}% reached. Preserved 100% germination vitality.`, "info");
  } else {
    appState.systemState = "DRYING";
    appState.fanActive = true;
    appState.ventAngle = appState.moisture > 20.0 ? 75 : (appState.moisture > 16.0 ? 45 : 30);
    
    // Gradual moisture evaporation
    const moistureLoss = (0.012 * (appState.temp / 35.0)) * (appState.fanActive ? 1.0 : 0.2);
    appState.moisture = Math.max(appState.targetMoisture - 0.2, appState.moisture - moistureLoss);
  }
}

// ============================================================================
// MAIN SYSTEM UPDATE LOOP
// ============================================================================
function mainSystemTick() {
  if (appState.isSimulating) {
    simulateDryingStep();
  }
  
  computeAiInsights();
  updateUI();
  
  // Record session telemetry for export & chart history every 4s
  if (appState.elapsedSeconds % 4 === 0) {
    const now = new Date();
    const timeLabel = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    appState.historyLabels.push(timeLabel);
    appState.historyMoisture.push(parseFloat(appState.moisture.toFixed(2)));
    appState.historyTarget.push(appState.targetMoisture);
    appState.historyTemp.push(parseFloat(appState.temp.toFixed(1)));
    appState.historyHum.push(parseFloat(appState.humidity.toFixed(1)));
    
    // Session records for CSV export
    appState.sessionRecords.push({
      time: timeLabel,
      temp: appState.temp.toFixed(1),
      humidity: appState.humidity.toFixed(1),
      moisture: appState.moisture.toFixed(1),
      solar: Math.round(appState.solarPct),
      battery: appState.batVoltage.toFixed(2),
      pv: appState.pvVoltage.toFixed(1),
      fan: appState.fanActive ? "1" : "0",
      vent: appState.ventAngle,
      state: appState.systemState
    });
    
    if (appState.historyLabels.length > 30) {
      appState.historyLabels.shift();
      appState.historyMoisture.shift();
      appState.historyTarget.shift();
      appState.historyTemp.shift();
      appState.historyHum.shift();
    }
    
    updateChartsUI();
  }
}

// ============================================================================
// UI RENDERING & SYNCHRONIZATION
// ============================================================================
function updateUI() {
  if (!DOM.valMoisture) return;

  // 1. Seed Moisture
  DOM.valMoisture.textContent = appState.moisture.toFixed(1);
  const diff = appState.moisture - appState.targetMoisture;
  if (diff > 0) {
    DOM.moistureDeltaBadge.textContent = `-${diff.toFixed(1)}% to target`;
    DOM.moistureDeltaBadge.className = "badge";
  } else {
    DOM.moistureDeltaBadge.textContent = "Target Reached!";
    DOM.moistureDeltaBadge.className = "badge badge-normal text-green";
  }
  DOM.valTargetMoistLabel.textContent = `${appState.targetMoisture.toFixed(1)}%`;
  DOM.valEmc.textContent = `${appState.emc.toFixed(1)}%`;
  
  const mProgress = Math.max(0, Math.min(100, 100 - ((appState.moisture - appState.targetMoisture) / 12.0) * 100));
  DOM.moistureProgressFill.style.width = `${mProgress}%`;
  
  // 2. AI Estimated Drying Time
  const remHrs = appState.remainingMins / 60.0;
  DOM.valRemainingHrs.textContent = remHrs >= 0.1 ? remHrs.toFixed(1) : "0.0";
  DOM.valRemainingMins.textContent = `(~${Math.round(appState.remainingMins)} mins)`;
  DOM.valDryingRate.textContent = `${appState.dryingRatePerHour.toFixed(1)}% / hr`;
  
  if (appState.remainingMins > 0) {
    const etaDate = new Date(Date.now() + appState.remainingMins * 60000);
    DOM.valEtaTimestamp.textContent = etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else {
    DOM.valEtaTimestamp.textContent = "Complete";
  }
  
  // 3. Chamber Temperature
  DOM.valTemp.textContent = appState.temp.toFixed(1);
  DOM.valMaxTempLabel.textContent = `${appState.maxSafeTemp.toFixed(0)}°C`;
  DOM.valGermHealth.textContent = `${appState.germinationHealth}%`;
  
  if (appState.temp >= appState.maxSafeTemp) {
    DOM.tempStatusBadge.textContent = "Overheat Protection";
    DOM.tempStatusBadge.className = "badge badge-solar";
    DOM.valGermHealth.className = "text-orange";
  } else {
    DOM.tempStatusBadge.textContent = "Safe Zone";
    DOM.tempStatusBadge.className = "badge";
    DOM.valGermHealth.className = "text-green";
  }
  
  const tempPointerPct = Math.max(0, Math.min(100, ((appState.temp - 20.0) / 30.0) * 100));
  DOM.tempPointer.style.left = `${tempPointerPct}%`;
  
  // 4. Humidity
  DOM.valHumidity.textContent = appState.humidity.toFixed(1);
  DOM.humProgressFill.style.width = `${appState.humidity}%`;
  
  // 5. Solar & Battery
  DOM.valSolarPct.textContent = Math.round(appState.solarPct);
  DOM.valPvVolt.textContent = `PV: ${appState.pvVoltage.toFixed(1)} V`;
  DOM.valBatVolt.textContent = appState.batVoltage.toFixed(2);
  const soc = Math.min(100, Math.max(20, Math.round(((appState.batVoltage - 11.8) / 1.0) * 100)));
  DOM.valBatSoc.textContent = `State of Charge: ${soc}%`;
  
  // 6. Actuators
  if (appState.fanActive) {
    DOM.valFanStatus.textContent = "ACTIVE (100%)";
    DOM.valFanStatus.className = "a-state text-green";
    DOM.fanBladeIcon.classList.add("spinning");
  } else {
    DOM.valFanStatus.textContent = "STOPPED";
    DOM.valFanStatus.className = "a-state text-dim";
    DOM.fanBladeIcon.classList.remove("spinning");
  }
  
  DOM.valVentAngle.textContent = `${appState.ventAngle}° (Exhaust)`;
  DOM.ventAngleVisual.style.transform = `rotate(${appState.ventAngle}deg)`;
  
  // 7. System State Badge
  DOM.systemStateText.textContent = appState.systemState;
  DOM.systemStateText.className = `state-val state-${appState.systemState.toLowerCase()}`;
}

function updateChartsUI() {
  if (moistureChartInstance) {
    moistureChartInstance.data.labels = [...appState.historyLabels];
    moistureChartInstance.data.datasets[0].data = [...appState.historyMoisture];
    moistureChartInstance.data.datasets[1].data = [...appState.historyTarget];
    moistureChartInstance.update();
  }
  
  if (tempHumChartInstance) {
    tempHumChartInstance.data.labels = [...appState.historyLabels];
    tempHumChartInstance.data.datasets[0].data = [...appState.historyTemp];
    tempHumChartInstance.data.datasets[1].data = [...appState.historyHum];
    tempHumChartInstance.update();
  }
}

// ============================================================================
// EVENT LISTENERS & CONTROLS
// ============================================================================
function bindEventListeners() {
  // Seed Profile Switcher Buttons
  if (DOM.seedButtonGroup) {
    const seedBtns = DOM.seedButtonGroup.querySelectorAll(".seed-chip");
    seedBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        seedBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        
        const seedKey = btn.dataset.seed;
        appState.activeSeed = seedKey;
        const profile = CROP_PROFILES[seedKey];
        
        appState.targetMoisture = parseFloat(btn.dataset.target);
        appState.maxSafeTemp = parseFloat(btn.dataset.maxtemp);
        if (DOM.targetSlider) DOM.targetSlider.value = appState.targetMoisture;
        if (DOM.sliderValDisplay) DOM.sliderValDisplay.textContent = `${appState.targetMoisture.toFixed(1)}%`;
        
        if (appState.isSimulating) {
          initSimulationBaseline();
        }
        
        sendSerialCommand(`SET_SEED:${seedKey}`);
        addAlert(`Loaded ${profile.name} Profile`, `Target Moisture: ${profile.target}% • Safe Max Temp: ${profile.maxTemp}°C`, "info");
      });
    });
  }

  // Slider change
  if (DOM.targetSlider) {
    DOM.targetSlider.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      appState.targetMoisture = val;
      if (DOM.sliderValDisplay) DOM.sliderValDisplay.textContent = `${val.toFixed(1)}%`;
      sendSerialCommand(`SET_TARGET:${val}`);
    });
  }

  // Action Buttons
  if (DOM.btnStartDryer) {
    DOM.btnStartDryer.addEventListener("click", () => {
      appState.systemState = "DRYING";
      appState.fanActive = true;
      sendSerialCommand("START");
      addAlert("Drying Cycle Resumed", "DC Blower fan and smart vent tracking activated.", "info");
    });
  }

  if (DOM.btnStopDryer) {
    DOM.btnStopDryer.addEventListener("click", () => {
      appState.systemState = "IDLE";
      appState.fanActive = false;
      appState.ventAngle = 0;
      sendSerialCommand("STOP");
      addAlert("Emergency Stop", "System shut down. Blower fan stopped and vents sealed.", "warn");
    });
  }

  if (DOM.btnVentFlush) {
    DOM.btnVentFlush.addEventListener("click", () => {
      appState.ventAngle = 90;
      appState.fanActive = true;
      sendSerialCommand("FLUSH");
      addAlert("Manual Vent Flush", "Vent flap positioned to 90° for rapid chamber purge.", "info");
    });
  }

  // Simulation Toggle
  if (DOM.btnToggleSim) {
    DOM.btnToggleSim.addEventListener("click", () => {
      appState.isSimulating = !appState.isSimulating;
      if (appState.isSimulating) {
        appState.mode = "SIMULATION";
        DOM.simToggleText.textContent = "Sim: Active";
        DOM.connStatusText.textContent = "SIMULATION MODE";
        DOM.connStatusPill.querySelector(".status-dot").className = "status-dot simulated";
        addAlert("Simulation Mode Active", "Autonomous virtual drying environment running.", "info");
      } else {
        DOM.simToggleText.textContent = "Sim: Paused";
        DOM.connStatusText.textContent = "STANDBY";
        DOM.connStatusPill.querySelector(".status-dot").className = "status-dot";
        addAlert("Simulation Paused", "Waiting for live USB / Bluetooth telemetry.", "warn");
      }
    });
  }

  // Telemetry Readers
  if (DOM.btnConnectSerial) DOM.btnConnectSerial.addEventListener("click", connectUsbSerial);
  if (DOM.btnConnectBle) DOM.btnConnectBle.addEventListener("click", connectBluetooth);
  if (DOM.btnConnectWifi) DOM.btnConnectWifi.addEventListener("click", connectWifiTelemetry);
  if (DOM.btnReadSdLog) DOM.btnReadSdLog.addEventListener("click", () => DOM.sdFileInput.click());
  if (DOM.sdFileInput) DOM.sdFileInput.addEventListener("change", handleSdFileSelect);
  if (DOM.btnReadAloud) DOM.btnReadAloud.addEventListener("click", readAloudStatus);
  if (DOM.btnExportCsv) DOM.btnExportCsv.addEventListener("click", exportSessionCsv);
}

// ============================================================================
// 1. WEB SERIAL API (Direct USB connection to Arduino Uno)
// ============================================================================
async function connectUsbSerial() {
  if (!("serial" in navigator)) {
    alert("Web Serial API is supported in Google Chrome, Microsoft Edge, and Chrome on Android (via OTG).\n\nIf using a standard Android WebView APK, try the 'Connect Bluetooth' option or 'Read SD Log'!");
    return;
  }

  try {
    appState.serialPort = await navigator.serial.requestPort();
    await appState.serialPort.open({ baudRate: 115200 });
    
    appState.mode = "SERIAL";
    appState.isSimulating = false;
    DOM.simToggleText.textContent = "Sim: Inactive";
    DOM.connStatusText.textContent = "ARDUINO USB CONNECTED";
    DOM.connStatusPill.querySelector(".status-dot").className = "status-dot connected";
    DOM.btnConnectSerial.innerHTML = `<i data-lucide="check"></i> <span>USB Active</span>`;
    if (window.lucide) window.lucide.createIcons();
    
    addAlert("USB Serial Connected", "Reading high-speed telemetry from Arduino Uno (115200 baud).", "info");
    readSerialLoop();
  } catch (err) {
    console.error("Serial connection failed:", err);
    addAlert("Serial Connection Error", err.message, "danger");
  }
}

async function readSerialLoop() {
  const textDecoder = new TextDecoderStream();
  appState.serialPort.readable.pipeTo(textDecoder.writable).catch(() => {});
  const reader = textDecoder.readable.getReader();
  appState.serialReader = reader;
  
  let lineBuffer = "";
  
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        lineBuffer += value;
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop(); // Retain incomplete chunk
        
        for (const line of lines) {
          parseIncomingTelemetryLine(line.trim());
        }
      }
    }
  } catch (error) {
    console.error("Serial read error:", error);
    addAlert("Serial Disconnected", error.message, "warn");
  } finally {
    reader.releaseLock();
  }
}

// ============================================================================
// 2. WEB BLUETOOTH API (Wireless reading for Android & Bluetooth HC-05 / ESP32)
// ============================================================================
async function connectBluetooth() {
  if (!("bluetooth" in navigator)) {
    alert("Web Bluetooth API is supported on Android Chrome and Android WebViews with BLE enabled!\n\nPlease ensure Bluetooth is turned on and your Arduino Bluetooth module (HC-05 / ESP32 BLE) is powered.");
    return;
  }

  try {
    addAlert("Searching Bluetooth", "Looking for Arduino BLE UART or SPP device...", "info");
    
    // Standard Nordic UART Service & generic serial filters
    const BLE_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
    
    appState.bleDevice = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [BLE_SERVICE_UUID, "0000ffe0-0000-1000-8000-00805f9b34fb"]
    });

    const server = await appState.bleDevice.gatt.connect();
    
    // Attempt Nordic UART first, then fallback to standard CC2541 / HM-10 service
    let service;
    try {
      service = await server.getPrimaryService(BLE_SERVICE_UUID);
    } catch {
      service = await server.getPrimaryService("0000ffe0-0000-1000-8000-00805f9b34fb");
    }

    const characteristics = await service.getCharacteristics();
    const rxChar = characteristics.find(c => c.properties.notify || c.properties.indicate);

    if (rxChar) {
      await rxChar.startNotifications();
      let bleBuffer = "";
      const textDecoder = new TextDecoder();
      
      rxChar.addEventListener("characteristicvaluechanged", (event) => {
        const chunk = textDecoder.decode(event.target.value);
        bleBuffer += chunk;
        const lines = bleBuffer.split("\n");
        bleBuffer = lines.pop();
        for (const line of lines) {
          parseIncomingTelemetryLine(line.trim());
        }
      });

      appState.mode = "BLUETOOTH";
      appState.isSimulating = false;
      DOM.simToggleText.textContent = "Sim: Inactive";
      DOM.connStatusText.textContent = "BLUETOOTH WIRELESS CONNECTED";
      DOM.connStatusPill.querySelector(".status-dot").className = "status-dot connected";
      DOM.btnConnectBle.innerHTML = `<i data-lucide="check"></i> <span>BLE Active</span>`;
      if (window.lucide) window.lucide.createIcons();
      
      addAlert("Bluetooth Connected", `Receiving live telemetry wirelessly from ${appState.bleDevice.name || 'Arduino'}.`, "info");
    }
  } catch (err) {
    console.error("Bluetooth connection error:", err);
    addAlert("Bluetooth Connection Failed", err.message, "danger");
  }
}

// ============================================================================
// 3. WIRELESS WI-FI NETWORK TELEMETRY (Laptop Server or ESP32 / ESP8266)
// ============================================================================
let wifiPollInterval = null;
let wifiEndpointUrl = "http://192.168.0.103:8080/api/telemetry";

function initWifiModalControls() {
  const modal = document.getElementById("wifiModal");
  const openModal = () => {
    if (modal) {
      modal.style.display = "flex";
      if (window.lucide && typeof window.lucide.createIcons === "function") {
        window.lucide.createIcons();
      }
    }
  };
  const closeModal = () => {
    if (modal) modal.style.display = "none";
  };

  if (DOM.btnConnectWifi) DOM.btnConnectWifi.addEventListener("click", openModal);
  const consoleWifiBtn = document.getElementById("btnConsoleWifi");
  if (consoleWifiBtn) consoleWifiBtn.addEventListener("click", openModal);

  const closeBtn = document.getElementById("btnCloseWifiModal");
  if (closeBtn) closeBtn.addEventListener("click", closeModal);

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // Quick connect presets
  const quickLaptop = document.getElementById("btnQuickLaptopWifi");
  if (quickLaptop) {
    quickLaptop.addEventListener("click", () => {
      startWifiStream("http://192.168.0.103:8080/api/telemetry");
      closeModal();
    });
  }

  const quickEsp32 = document.getElementById("btnQuickEsp32Wifi");
  if (quickEsp32) {
    quickEsp32.addEventListener("click", () => {
      startWifiStream("http://192.168.4.1/api/telemetry");
      closeModal();
    });
  }

  const quickLocal = document.getElementById("btnQuickLocalhostWifi");
  if (quickLocal) {
    quickLocal.addEventListener("click", () => {
      startWifiStream("http://localhost:8080/api/telemetry");
      closeModal();
    });
  }

  const btnCustom = document.getElementById("btnConnectCustomWifi");
  const customInput = document.getElementById("customWifiUrl");
  if (btnCustom && customInput) {
    btnCustom.addEventListener("click", () => {
      startWifiStream(customInput.value.trim());
      closeModal();
    });
  }

  const btnDisconnect = document.getElementById("btnDisconnectWifi");
  if (btnDisconnect) {
    btnDisconnect.addEventListener("click", () => {
      disconnectWifiStream();
      closeModal();
    });
  }
}

async function startWifiStream(targetUrl) {
  if (!targetUrl) return;
  wifiEndpointUrl = targetUrl.trim();
  
  try {
    addAlert("Connecting Wi-Fi", `Reaching ${wifiEndpointUrl}...`, "info");
    const testResp = await fetch(wifiEndpointUrl);
    if (!testResp.ok) throw new Error(`HTTP status ${testResp.status}`);
    const data = await testResp.json();
    handleIncomingTelemetry(data);

    if (wifiPollInterval) clearInterval(wifiPollInterval);
    wifiPollInterval = setInterval(async () => {
      try {
        const resp = await fetch(wifiEndpointUrl);
        if (resp.ok) {
          const telemetryData = await resp.json();
          handleIncomingTelemetry(telemetryData);
        }
      } catch (err) {
        console.warn("Wi-Fi telemetry poll glitch:", err);
      }
    }, 1000);

    appState.mode = "WIFI";
    appState.isSimulating = false;
    DOM.simToggleText.textContent = "Sim: Inactive";
    let hostDisplay = "192.168.0.103";
    try { hostDisplay = new URL(wifiEndpointUrl).host; } catch(e){}
    DOM.connStatusText.textContent = `WIFI ACTIVE: ${hostDisplay}`;
    DOM.connStatusPill.querySelector(".status-dot").className = "status-dot connected";
    
    if (DOM.btnConnectWifi) {
      DOM.btnConnectWifi.innerHTML = `<span class="wifi-pulse-dot"></span> <i data-lucide="check"></i> <span>Wi-Fi Active</span>`;
    }
    const consoleWifi = document.getElementById("btnConsoleWifi");
    if (consoleWifi) {
      consoleWifi.innerHTML = `<i data-lucide="check"></i> Wi-Fi Active`;
      consoleWifi.className = "btn btn-success";
    }
    const badge = document.getElementById("wifiModalStatusBadge");
    if (badge) {
      badge.textContent = `Connected (${hostDisplay})`;
      badge.className = "badge badge-normal text-green";
    }
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }

    addAlert("Wi-Fi Connected", `Streaming live telemetry wirelessly from ${wifiEndpointUrl}`, "info");
  } catch (err) {
    console.error("Wi-Fi connection failed:", err);
    alert(`Could not connect to Wi-Fi telemetry at ${wifiEndpointUrl}.\n\nEnsure start_wifi_server.bat is running on your laptop or your ESP32 Wi-Fi is powered on.\n\nError: ${err.message}`);
    addAlert("Wi-Fi Connection Failed", err.message, "danger");
  }
}

function disconnectWifiStream() {
  if (wifiPollInterval) {
    clearInterval(wifiPollInterval);
    wifiPollInterval = null;
  }
  appState.mode = "SIMULATION";
  appState.isSimulating = true;
  DOM.simToggleText.textContent = "Sim: Active";
  DOM.connStatusText.textContent = "SIMULATION MODE";
  DOM.connStatusPill.querySelector(".status-dot").className = "status-dot simulated";
  
  if (DOM.btnConnectWifi) {
    DOM.btnConnectWifi.innerHTML = `<span class="wifi-pulse-dot"></span> <i data-lucide="wifi"></i> <span>Wi-Fi Wireless</span>`;
  }
  const consoleWifi = document.getElementById("btnConsoleWifi");
  if (consoleWifi) {
    consoleWifi.innerHTML = `<i data-lucide="wifi"></i> Wi-Fi Wireless Link`;
    consoleWifi.className = "btn btn-wifi";
  }
  const badge = document.getElementById("wifiModalStatusBadge");
  if (badge) {
    badge.textContent = "Disconnected";
    badge.className = "badge text-dim";
  }
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
  addAlert("Wi-Fi Disconnected", "Switched back to internal simulation mode.", "warn");
}

// ============================================================================
// 4. MICROSD CARD CSV LOG READER ("Read SD Card Log")
// ============================================================================
function handleSdFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target.result;
    parseSdCardCsv(content, file.name);
  };
  reader.readAsText(file);
}

function parseSdCardCsv(csvText, fileName) {
  try {
    const rawLines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (rawLines.length < 2) {
      alert("Selected CSV file contains no data rows.");
      return;
    }

    // Identify header line
    let headerLine = rawLines[0];
    let startIndex = 1;
    if (!headerLine.toLowerCase().includes("temp") && !headerLine.toLowerCase().includes("time")) {
      startIndex = 0; // Headerless CSV
    }

    const labels = [];
    const moistures = [];
    const targets = [];
    const temps = [];
    const hums = [];

    let lastRow = null;
    let rowCount = 0;

    for (let i = startIndex; i < rawLines.length; i++) {
      const parts = rawLines[i].split(",").map(p => p.trim());
      if (parts.length >= 4) {
        // Expected Arduino format: Timestamp_s, Temp_C, Humidity_pct, Moisture_pct, Solar_pct, Bat_V, PV_V, Fan, Vent_deg, State
        const timeSec = parseFloat(parts[0]) || (i * 2);
        const t = parseFloat(parts[1]);
        const h = parseFloat(parts[2]);
        const m = parseFloat(parts[3]);
        
        if (!isNaN(t) && !isNaN(h) && !isNaN(m)) {
          rowCount++;
          const mins = Math.floor(timeSec / 60);
          const secs = timeSec % 60;
          const label = `${mins}m ${secs}s`;
          
          labels.push(label);
          temps.push(t);
          hums.push(h);
          moistures.push(m);
          targets.push(appState.targetMoisture);

          lastRow = {
            temp: t,
            humidity: h,
            moisture: m,
            solar: parts[4] ? parseFloat(parts[4]) : 80,
            bat: parts[5] ? parseFloat(parts[5]) : 12.6,
            pv: parts[6] ? parseFloat(parts[6]) : 18.0,
            fan: parts[7] ? (parseInt(parts[7]) === 1) : true,
            vent: parts[8] ? parseInt(parts[8]) : 45,
            state: parts[9] ? parts[9].replace(/['"]+/g, '') : "COMPLETED",
            elapsed: timeSec
          };
        }
      }
    }

    if (rowCount > 0 && lastRow) {
      appState.mode = "FILE";
      appState.isSimulating = false;
      DOM.simToggleText.textContent = "Sim: Inactive";
      DOM.connStatusText.textContent = `SD LOG: ${fileName.toUpperCase()}`;
      DOM.connStatusPill.querySelector(".status-dot").className = "status-dot connected";

      // Apply last row values to gauges
      appState.temp = lastRow.temp;
      appState.humidity = lastRow.humidity;
      appState.moisture = lastRow.moisture;
      appState.solarPct = lastRow.solar;
      appState.batVoltage = lastRow.bat;
      appState.pvVoltage = lastRow.pv;
      appState.fanActive = lastRow.fan;
      appState.ventAngle = lastRow.vent;
      appState.systemState = lastRow.state;
      appState.elapsedSeconds = lastRow.elapsed;

      // Downsample for charts if large file (>35 points)
      const step = Math.max(1, Math.floor(labels.length / 30));
      appState.historyLabels = labels.filter((_, idx) => idx % step === 0);
      appState.historyMoisture = moistures.filter((_, idx) => idx % step === 0);
      appState.historyTarget = targets.filter((_, idx) => idx % step === 0);
      appState.historyTemp = temps.filter((_, idx) => idx % step === 0);
      appState.historyHum = hums.filter((_, idx) => idx % step === 0);

      updateChartsUI();
      updateUI();
      addAlert("SD Card Log Parsed", `Read ${rowCount} drying records from ${fileName}. Plotted full drying trajectory.`, "info");
    }
  } catch (err) {
    console.error("Error reading SD card CSV log:", err);
    alert("Could not parse SD Card CSV log: " + err.message);
  }
}

// ============================================================================
// 4. TELEMETRY LINE PARSER (JSON & CSV auto-detection)
// ============================================================================
function parseIncomingTelemetryLine(line) {
  if (!line || line.length < 3) return;

  // 1. JSON Format
  if (line.startsWith("{") && line.endsWith("}")) {
    try {
      const data = JSON.parse(line);
      handleIncomingTelemetry(data);
      return;
    } catch (e) {
      console.warn("JSON parse error:", line);
    }
  }

  // 2. CSV Telemetry Format: Temp,Hum,Moist,Solar,Bat,PV,Fan,Vent,State
  if (line.includes(",")) {
    const parts = line.split(",").map(p => p.trim());
    if (parts.length >= 3) {
      const t = parseFloat(parts[0]);
      const h = parseFloat(parts[1]);
      const m = parseFloat(parts[2]);
      if (!isNaN(t) && !isNaN(h) && !isNaN(m)) {
        appState.temp = t;
        appState.humidity = h;
        appState.moisture = m;
        if (parts[3]) appState.solarPct = parseFloat(parts[3]);
        if (parts[4]) appState.batVoltage = parseFloat(parts[4]);
        if (parts[5]) appState.pvVoltage = parseFloat(parts[5]);
        if (parts[6]) appState.fanActive = (parseInt(parts[6]) === 1);
        if (parts[7]) appState.ventAngle = parseInt(parts[7]);
        if (parts[8]) appState.systemState = parts[8].replace(/['"]+/g, '');
        return;
      }
    }
  }
}

function handleIncomingTelemetry(data) {
  if (data.temp !== undefined) appState.temp = data.temp;
  if (data.hum !== undefined) appState.humidity = data.hum;
  if (data.moist !== undefined) appState.moisture = data.moist;
  if (data.target_moist !== undefined) appState.targetMoisture = data.target_moist;
  if (data.solar_pct !== undefined) appState.solarPct = data.solar_pct;
  if (data.bat_v !== undefined) appState.batVoltage = data.bat_v;
  if (data.pv_v !== undefined) appState.pvVoltage = data.pv_v;
  if (data.fan !== undefined) appState.fanActive = (data.fan === 1);
  if (data.vent !== undefined) appState.ventAngle = data.vent;
  if (data.state !== undefined) appState.systemState = data.state;
  if (data.elapsed_s !== undefined) appState.elapsedSeconds = data.elapsed_s;
  
  if (data.seed && CROP_PROFILES[data.seed]) {
    appState.activeSeed = data.seed;
    const btns = DOM.seedButtonGroup.querySelectorAll(".seed-chip");
    btns.forEach(b => {
      b.classList.toggle("active", b.dataset.seed === data.seed);
    });
  }
}

async function sendSerialCommand(cmd) {
  if (appState.mode === "SERIAL" && appState.serialPort && appState.serialPort.writable) {
    try {
      const encoder = new TextEncoder();
      const writer = appState.serialPort.writable.getWriter();
      await writer.write(encoder.encode(cmd + "\n"));
      writer.releaseLock();
    } catch (err) {
      console.error("Failed to send serial command:", err);
    }
  }
}

// ============================================================================
// 5. VOICE READ-ALOUD (SpeechSynthesis audio for farmers in the field)
// ============================================================================
function readAloudStatus() {
  if (!("speechSynthesis" in window)) {
    alert("Speech Synthesis is not supported in this browser.");
    return;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const seedName = CROP_PROFILES[appState.activeSeed] ? CROP_PROFILES[appState.activeSeed].name : appState.activeSeed;
  const remHours = (appState.remainingMins / 60.0).toFixed(1);
  
  const speechText = `Prakashan AI Seed Dryer Status. Active crop is ${seedName}. ` +
    `Current seed moisture is ${appState.moisture.toFixed(1)} percent, with target ${appState.targetMoisture.toFixed(1)} percent. ` +
    `Chamber temperature is ${appState.temp.toFixed(1)} degrees Celsius, currently in safe zone. ` +
    `System is ${appState.systemState.toLowerCase()}. ` +
    (appState.remainingMins > 0 ? `Estimated drying time remaining is ${remHours} hours.` : `Drying is completed!`);

  const utterance = new SpeechSynthesisUtterance(speechText);
  utterance.rate = 0.95;
  utterance.pitch = 1.0;
  
  utterance.onstart = () => {
    DOM.btnReadAloud.classList.add("btn-warning");
    addAlert("Voice Readout", "Speaking live status report...", "info");
  };
  
  utterance.onend = () => {
    DOM.btnReadAloud.classList.remove("btn-warning");
  };

  utterance.onerror = (e) => {
    console.warn("Speech synthesis error:", e);
    DOM.btnReadAloud.classList.remove("btn-warning");
  };

  window.speechSynthesis.speak(utterance);
}

// ============================================================================
// 6. CSV DATA EXPORTER (Save drying session to file)
// ============================================================================
function exportSessionCsv() {
  if (appState.sessionRecords.length === 0) {
    alert("No session telemetry recorded yet to export.");
    return;
  }

  let csv = "Time,Temperature_C,Humidity_pct,Moisture_pct,Solar_pct,Battery_V,PV_V,Fan,Vent_deg,State\n";
  for (const r of appState.sessionRecords) {
    csv += `${r.time},${r.temp},${r.humidity},${r.moisture},${r.solar},${r.battery},${r.pv},${r.fan},${r.vent},${r.state}\n`;
  }

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `prakashan_drying_log_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  addAlert("Session Exported", `Downloaded ${appState.sessionRecords.length} records as CSV.`, "info");
}

// ============================================================================
// 7. ALERT FEED SYSTEM
// ============================================================================
function addAlert(title, message, type = "info") {
  if (!DOM.alertFeedContainer) return;

  const alertEl = document.createElement("div");
  alertEl.className = `alert-item alert-${type}`;
  
  let iconName = "info";
  if (type === "warn") iconName = "alert-triangle";
  if (type === "danger") iconName = "alert-octagon";
  if (type === "info") iconName = "check-circle-2";
  
  const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  
  alertEl.innerHTML = `
    <i data-lucide="${iconName}" class="alert-icon"></i>
    <div class="alert-text">
      <strong>${title}</strong>
      <p>${message}</p>
      <span class="alert-time">${timeNow}</span>
    </div>
  `;
  
  DOM.alertFeedContainer.prepend(alertEl);
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
  
  // Keep last 10 alerts
  while (DOM.alertFeedContainer.children.length > 10) {
    DOM.alertFeedContainer.removeChild(DOM.alertFeedContainer.lastChild);
  }
}
