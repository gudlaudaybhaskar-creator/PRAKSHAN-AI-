/**
 * ============================================================================
 * PRAKASHAN AI - Smart Solar Seed Dryer Dashboard Controller
 * "Drying solutions for global agriculture"
 * ============================================================================
 * Features:
 * - Real-time Web Serial API for direct USB connection to Arduino Uno
 * - High-fidelity physics-based offline simulation engine
 * - AI ML Drying Completion Time & Moisture Curve Forecast
 * - Live Chart.js telemetry graphs
 * - Seed profile switching & germination thermal safety protection
 * ============================================================================
 */

// Global State
const appState = {
  isSimulating: true,
  serialConnected: false,
  serialPort: null,
  serialReader: null,
  
  // Active Crop Profile
  activeSeed: "PADDY",
  targetMoisture: 13.0,
  maxSafeTemp: 42.0,
  
  // Real-time Telemetry Data
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
  historyHum: []
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
const DOM = {
  connStatusPill: document.getElementById("connStatusPill"),
  connStatusText: document.getElementById("connStatusText"),
  btnConnectSerial: document.getElementById("btnConnectSerial"),
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
  
  alertFeedContainer: document.getElementById("alertFeedContainer"),
  alertCountBadge: document.getElementById("alertCountBadge")
};

// Chart Instances
let moistureChartInstance = null;
let tempHumChartInstance = null;

// ============================================================================
// INITIALIZATION
// ============================================================================
document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();
  initCharts();
  bindEventListeners();
  initSimulationBaseline();
  
  // Start Main Update Loop (1000ms interval)
  setInterval(mainSystemTick, 1000);
});

// ============================================================================
// CHARTS INITIALIZATION (Chart.js)
// ============================================================================
function initCharts() {
  const chartOptionsBase = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
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
  const ctxMoist = document.getElementById("moistureChart").getContext("2d");
  moistureChartInstance = new Chart(ctxMoist, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Current Seed Moisture (%)",
          data: [],
          borderColor: "#38bdf8",
          backgroundColor: "rgba(56, 189, 248, 0.1)",
          borderWidth: 2.5,
          tension: 0.35,
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
  const ctxTempHum = document.getElementById("tempHumChart").getContext("2d");
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
          tension: 0.35,
          yAxisID: "yTemp",
          pointRadius: 2
        },
        {
          label: "Relative Humidity (%)",
          data: [],
          borderColor: "#06b6d4",
          backgroundColor: "rgba(6, 182, 212, 0.08)",
          borderWidth: 2,
          tension: 0.35,
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
  const profile = CROP_PROFILES[appState.activeSeed];
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
    appState.historyMoisture.push(m);
    appState.historyTarget.push(profile.target);
    appState.historyTemp.push(34.5 + Math.random() * 2.0);
    appState.historyHum.push(52.0 - Math.random() * 3.0);
  }
  updateChartsUI();
}

// ============================================================================
// AI THIN-LAYER DRYING LOGIC & COMPUTATION
// ============================================================================
function computeAiInsights() {
  const profile = CROP_PROFILES[appState.activeSeed];
  
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
// SIMULATION ENGINE TICK (When no USB device connected)
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
    addAlert("Drying Complete!", `Target moisture of ${appState.targetMoisture}% reached successfully. Preserved 100% germination rate.`, "info");
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
  
  // Periodic Chart Update (Every 4 seconds)
  if (appState.elapsedSeconds % 4 === 0) {
    const now = new Date();
    const timeLabel = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    appState.historyLabels.push(timeLabel);
    appState.historyMoisture.push(parseFloat(appState.moisture.toFixed(2)));
    appState.historyTarget.push(appState.targetMoisture);
    appState.historyTemp.push(parseFloat(appState.temp.toFixed(1)));
    appState.historyHum.push(parseFloat(appState.humidity.toFixed(1)));
    
    if (appState.historyLabels.length > 25) {
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
      DOM.targetSlider.value = appState.targetMoisture;
      DOM.sliderValDisplay.textContent = `${appState.targetMoisture.toFixed(1)}%`;
      
      if (appState.isSimulating) {
        initSimulationBaseline();
      }
      
      sendSerialCommand(`SET_SEED:${seedKey}`);
      addAlert(`Loaded ${profile.name} Profile`, `Target Moisture: ${profile.target}% • Safe Max Temp: ${profile.maxTemp}°C`, "info");
    });
  });

  // Slider change
  DOM.targetSlider.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    appState.targetMoisture = val;
    DOM.sliderValDisplay.textContent = `${val.toFixed(1)}%`;
    sendSerialCommand(`SET_TARGET:${val}`);
  });

  // Action Buttons
  DOM.btnStartDryer.addEventListener("click", () => {
    appState.systemState = "DRYING";
    appState.fanActive = true;
    sendSerialCommand("START");
    addAlert("Drying Cycle Resumed", "DC Blower fan and smart vent tracking activated.", "info");
  });

  DOM.btnStopDryer.addEventListener("click", () => {
    appState.systemState = "IDLE";
    appState.fanActive = false;
    appState.ventAngle = 0;
    sendSerialCommand("STOP");
    addAlert("Emergency Stop", "System shut down. Blower fan stopped and vents sealed.", "warn");
  });

  DOM.btnVentFlush.addEventListener("click", () => {
    appState.ventAngle = 90;
    appState.fanActive = true;
    addAlert("Manual Vent Flush", "Vent flap positioned to 90° for rapid chamber purge.", "info");
  });

  // Simulation Toggle
  DOM.btnToggleSim.addEventListener("click", () => {
    appState.isSimulating = !appState.isSimulating;
    if (appState.isSimulating) {
      DOM.simToggleText.textContent = "Sim: Active";
      DOM.connStatusText.textContent = "SIMULATION MODE";
      DOM.connStatusPill.querySelector(".status-dot").className = "status-dot simulated";
    } else {
      DOM.simToggleText.textContent = "Sim: Paused";
      DOM.connStatusText.textContent = "STANDBY";
      DOM.connStatusPill.querySelector(".status-dot").className = "status-dot";
    }
  });

  // Web Serial API Connection
  DOM.btnConnectSerial.addEventListener("click", connectUsbSerial);
}

// ============================================================================
// WEB SERIAL API (Direct USB connection to Arduino Uno)
// ============================================================================
async function connectUsbSerial() {
  if (!("serial" in navigator)) {
    alert("Web Serial API is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
    return;
  }

  try {
    appState.serialPort = await navigator.serial.requestPort();
    await appState.serialPort.open({ baudRate: 115200 });
    
    appState.serialConnected = true;
    appState.isSimulating = false;
    DOM.simToggleText.textContent = "Sim: Inactive";
    DOM.connStatusText.textContent = "ARDUINO USB CONNECTED";
    DOM.connStatusPill.querySelector(".status-dot").className = "status-dot connected";
    DOM.btnConnectSerial.innerHTML = `<i data-lucide="check"></i> <span>Connected</span>`;
    lucide.createIcons();
    
    addAlert("USB Serial Connected", "Receiving high-frequency telemetry from Arduino Uno (115200 baud).", "info");
    readSerialLoop();
  } catch (err) {
    console.error("Serial connection failed:", err);
    addAlert("Serial Connection Error", err.message, "danger");
  }
}

async function readSerialLoop() {
  const textDecoder = new TextDecoderStream();
  const readableStreamClosed = appState.serialPort.readable.pipeTo(textDecoder.writable);
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
        lineBuffer = lines.pop(); // Keep partial line
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
            try {
              const data = JSON.parse(trimmed);
              handleIncomingTelemetry(data);
            } catch (e) {
              console.warn("JSON parse error from serial:", trimmed);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Serial read error:", error);
  } finally {
    reader.releaseLock();
  }
}

function handleIncomingTelemetry(data) {
  if (data.temp !== undefined) appState.temp = data.temp;
  if (data.hum !== undefined) appState.humidity = data.hum;
  if (data.moist !== undefined) appState.moisture = data.moist;
  if (data.solar_pct !== undefined) appState.solarPct = data.solar_pct;
  if (data.bat_v !== undefined) appState.batVoltage = data.bat_v;
  if (data.pv_v !== undefined) appState.pvVoltage = data.pv_v;
  if (data.fan !== undefined) appState.fanActive = (data.fan === 1);
  if (data.vent !== undefined) appState.ventAngle = data.vent;
  if (data.state !== undefined) appState.systemState = data.state;
  if (data.elapsed_s !== undefined) appState.elapsedSeconds = data.elapsed_s;
}

async function sendSerialCommand(cmd) {
  if (!appState.serialConnected || !appState.serialPort) return;
  try {
    const encoder = new TextEncoder();
    const writer = appState.serialPort.writable.getWriter();
    await writer.write(encoder.encode(cmd + "\n"));
    writer.releaseLock();
  } catch (err) {
    console.error("Failed to send command to Arduino:", err);
  }
}

// ============================================================================
// ALERT SYSTEM
// ============================================================================
function addAlert(title, message, type = "info") {
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
  lucide.createIcons();
  
  // Keep last 10 alerts
  while (DOM.alertFeedContainer.children.length > 10) {
    DOM.alertFeedContainer.removeChild(DOM.alertFeedContainer.lastChild);
  }
}
