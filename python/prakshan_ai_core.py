"""
=============================================================================
PRAKASHAN AI - Core Real-Time Inference & Agricultural Decision Engine
"Drying solutions for global agriculture"
=============================================================================
Connects to Arduino Uno serial stream (or runs in standalone edge simulation),
processes live multi-sensor telemetry, runs lightweight ML predictions for
drying completion time, calculates seed germination vitality index, and
detects environmental anomalies.
=============================================================================
"""

import sys
import os
import time
import json
import math
import random
from typing import Dict, Any, Optional

# Load Edge Calibration Weights
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
WEIGHTS_PATH = os.path.join(CURRENT_DIR, "edge_model_weights.json")

class PrakashanAICore:
    def __init__(self, weights_path: str = WEIGHTS_PATH):
        self.weights_path = weights_path
        self.config = self._load_config()
        self.history_buffer = []
        self.max_history = 120
        self.ml_model = self._load_scikit_model()
        
    def _load_config(self) -> Dict[str, Any]:
        if os.path.exists(self.weights_path):
            with open(self.weights_path, "r", encoding="utf-8") as f:
                return json.load(f)
        else:
            # Embedded default parameters
            return {
                "seed_profiles": {
                    "PADDY":   {"safe_max_temp": 42.0, "target_moist": 13.0, "A": 11.5, "B": -0.045, "C": 2.65},
                    "WHEAT":   {"safe_max_temp": 40.0, "target_moist": 12.0, "A": 10.8, "B": -0.040, "C": 2.50},
                    "MAIZE":   {"safe_max_temp": 43.0, "target_moist": 13.5, "A": 12.0, "B": -0.050, "C": 2.70},
                    "SOYBEAN": {"safe_max_temp": 38.0, "target_moist": 11.0, "A": 8.5,  "B": -0.035, "C": 2.20},
                    "MUSTARD": {"safe_max_temp": 36.0, "target_moist": 8.5,  "A": 6.8,  "B": -0.028, "C": 1.95},
                }
            }

    def _load_scikit_model(self):
        model_path = os.path.join(CURRENT_DIR, "prakshan_ai_model.joblib")
        if os.path.exists(model_path):
            try:
                import joblib
                print(f"[+] Loaded Scikit-Learn ML model from {model_path}")
                return joblib.load(model_path)
            except Exception as e:
                print(f"[!] Note: Using lightweight Edge ML engine ({e})")
        return None

    def calculate_emc(self, seed: str, temp: float, rh: float) -> float:
        """Calculates equilibrium moisture content (%) based on Oswin isotherm."""
        profile = self.config.get("seed_profiles", {}).get(seed.upper(), {"A": 11.5, "B": -0.045, "C": 2.65})
        a_val = profile.get("A", 11.5) + profile.get("B", -0.045) * temp
        ratio = max(0.05, min(0.95, rh / 100.0))
        denom = max(0.01, 1.0 - ratio)
        emc = a_val * ((ratio / denom) ** (1.0 / profile.get("C", 2.65)))
        return round(max(5.0, min(22.0, emc)), 2)

    def predict_remaining_time(self, temp: float, rh: float, moist: float, 
                               target: float, solar: float, elapsed_s: int, 
                               seed: str) -> float:
        """
        Estimates remaining drying time in minutes using ML Regressor or Thin-Layer Physics.
        """
        if moist <= target:
            return 0.0

        moisture_delta = moist - target
        seed_upper = seed.upper()
        
        # Method A: Scikit-Learn Inference if model is loaded
        if self.ml_model is not None:
            try:
                seed_code_map = {"PADDY": 0, "WHEAT": 1, "MAIZE": 2, "SOYBEAN": 3, "MUSTARD": 4}
                s_code = seed_code_map.get(seed_upper, 0)
                thermal_pot = temp * (100.0 - rh) / 100.0
                elapsed_mins = elapsed_s / 60.0
                
                features = [[temp, rh, moist, target, moisture_delta, solar, elapsed_mins, thermal_pot, s_code]]
                pred_mins = float(self.ml_model.predict(features)[0])
                return round(max(0.0, pred_mins), 1)
            except Exception:
                pass

        # Method B: Robust Hybrid Physics-Informed Edge Predictor (Zero-dependency)
        emc = self.calculate_emc(seed_upper, temp, rh)
        usable_driving_force = max(0.5, moist - emc)
        
        # Effective drying rate constant k (1/hr)
        t_kelvin = temp + 273.15
        k_base = 0.42 * math.exp(-28500.0 / (8.314 * t_kelvin)) * 1200.0
        k_eff = k_base * (1.0 + (solar / 100.0) * 0.3) * (1.0 - (rh / 150.0))
        k_eff = max(0.05, k_eff)
        
        # Page model inversion: t = (-ln((target - emc) / (moist - emc)))^(1/n) / k
        target_diff = max(0.1, target - emc)
        ratio = target_diff / usable_driving_force
        
        if ratio < 1.0:
            est_hours = ((-math.log(ratio)) ** (1.0 / 0.84)) / k_eff
            est_minutes = est_hours * 60.0
        else:
            est_minutes = moisture_delta * 18.0
            
        return round(max(0.0, est_minutes), 1)

    def calculate_germination_health(self, temp: float, max_safe_temp: float) -> int:
        """
        Computes Seed Germination Vitality Index (0-100%).
        Cereals and legumes undergo thermal enzyme denaturation above critical thresholds.
        """
        if temp <= (max_safe_temp - 4.0):
            return 100
        elif temp <= max_safe_temp:
            # Mild thermal stress
            penalty = (temp - (max_safe_temp - 4.0)) * 5.0
            return int(max(80, 100 - penalty))
        else:
            # Overheat danger zone
            excess = temp - max_safe_temp
            health = 80 - (excess * 25.0)
            return int(max(0, health))

    def detect_anomalies(self, temp: float, rh: float, moist: float, 
                         max_safe_temp: float) -> list:
        """Performs real-time anomaly detection and safety alerts."""
        alerts = []
        if temp >= max_safe_temp:
            alerts.append({
                "code": "OVERHEAT_CRITICAL",
                "severity": "DANGER",
                "message": f"Chamber temp ({temp}°C) exceeds seed safety threshold ({max_safe_temp}°C). Flap opened!"
            })
        if rh >= 82.0:
            alerts.append({
                "code": "HIGH_AMBIENT_HUMIDITY",
                "severity": "WARNING",
                "message": f"Ambient humidity is very high ({rh}%). Restricting vent flap to prevent seed moisture absorption."
            })
        if moist < 5.0 or moist > 45.0:
            alerts.append({
                "code": "SENSOR_RANGE_FAULT",
                "severity": "CRITICAL",
                "message": f"Moisture reading ({moist}%) is out of realistic physical bounds. Inspect probe."
            })
        return alerts

    def process_telemetry(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Main processing pipeline for each incoming telemetry frame.
        """
        temp = float(raw_data.get("temp", 32.0))
        rh = float(raw_data.get("hum", 50.0))
        moist = float(raw_data.get("moist", 18.0))
        target_m = float(raw_data.get("target_moist", 13.0))
        solar = float(raw_data.get("solar_pct", 75.0))
        elapsed_s = int(raw_data.get("elapsed_s", 0))
        seed = str(raw_data.get("seed", "PADDY")).upper()
        
        profile = self.config.get("seed_profiles", {}).get(seed, {"safe_max_temp": 42.0, "target_moist": 13.0})
        max_safe_temp = profile.get("safe_max_temp", 42.0)
        
        # AI Predictions
        rem_mins = self.predict_remaining_time(temp, rh, moist, target_m, solar, elapsed_s, seed)
        emc = self.calculate_emc(seed, temp, rh)
        health_idx = self.calculate_germination_health(temp, max_safe_temp)
        alerts = self.detect_anomalies(temp, rh, moist, max_safe_temp)
        
        # Generate 2-hour future predicted moisture curve (sample every 30 mins)
        forecast = []
        for future_min in [30, 60, 90, 120]:
            if rem_mins > 0:
                prog = min(1.0, future_min / max(1.0, rem_mins))
                future_m = moist - (moist - target_m) * prog
            else:
                future_m = target_m
            forecast.append({"t_offset_mins": future_min, "predicted_moisture": round(max(target_m, future_m), 2)})

        # Store in rolling buffer
        self.history_buffer.append({
            "timestamp": time.time(),
            "temp": temp,
            "rh": rh,
            "moist": moist,
            "solar": solar,
            "rem_mins": rem_mins
        })
        if len(self.history_buffer) > self.max_history:
            self.history_buffer.pop(0)

        # Enriched AI Telemetry Packet
        enriched_packet = {
            **raw_data,
            "ai_insights": {
                "estimated_remaining_mins": rem_mins,
                "estimated_remaining_hrs": round(rem_mins / 60.0, 2),
                "emc_pct": emc,
                "germination_health_pct": health_idx,
                "max_safe_temp_c": max_safe_temp,
                "moisture_delta": round(moist - target_m, 2),
                "drying_efficiency_score": round(max(10, min(100, (temp / 40.0) * (100.0 - rh) * 1.2)), 1),
                "forecast_curve": forecast,
                "active_alerts": alerts
            }
        }
        return enriched_packet

def run_serial_bridge(port: str = "COM3", baud: int = 115200):
    """Connects to real Arduino Uno serial port and processes data."""
    try:
        import serial
        print(f"[*] Opening Serial connection to Arduino on {port} @ {baud} baud...")
        ser = serial.Serial(port, baud, timeout=2)
        time.sleep(2)
        ai_engine = PrakashanAICore()
        
        print("[+] Prakashan AI Core active. Streaming live intelligence...")
        while True:
            line = ser.readline().decode("utf-8", errors="ignore").strip()
            if line.startswith("{") and line.endswith("}"):
                try:
                    data = json.loads(line)
                    result = ai_engine.process_telemetry(data)
                    print(json.dumps(result, indent=2))
                except json.JSONDecodeError:
                    pass
    except ImportError:
        print("[!] pyserial not installed. Run 'pip install pyserial' or use standalone simulation.")
    except Exception as e:
        print(f"[!] Serial bridge error: {e}")

if __name__ == "__main__":
    print("=================================================================")
    print("  PRAKASHAN AI - Smart Solar Seed Dryer Intelligence Engine")
    print("  'Drying solutions for global agriculture'")
    print("=================================================================")
    
    ai_engine = PrakashanAICore()
    
    # Run test inference on sample telemetry packet
    sample_packet = {
        "temp": 38.4,
        "hum": 42.1,
        "moist": 18.6,
        "target_moist": 13.0,
        "solar_pct": 85.0,
        "bat_v": 12.65,
        "pv_v": 18.20,
        "fan": 1,
        "vent": 45,
        "state": "DRYING",
        "seed": "PADDY",
        "elapsed_s": 3600
    }
    
    print("\n[*] Processing Sample Solar Drying Telemetry Frame:")
    output = ai_engine.process_telemetry(sample_packet)
    print(json.dumps(output, indent=2))
    
    print(f"\n[+] Remaining Drying Time: {output['ai_insights']['estimated_remaining_mins']} mins ({output['ai_insights']['estimated_remaining_hrs']} hrs)")
    print(f"[+] Germination Health Score: {output['ai_insights']['germination_health_pct']}%")
    print(f"[+] Equilibrium Moisture:   {output['ai_insights']['emc_pct']}%")
