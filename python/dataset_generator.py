"""
=============================================================================
PRAKASHAN AI - Agricultural Seed Drying Dataset Generator
"Drying solutions for global agriculture"
Physics-Informed Thin-Layer Drying Simulation (Page & Henderson Models)
=============================================================================
This module synthesizes realistic solar seed drying trial datasets across
different crops (Paddy, Wheat, Maize, Soybean, Mustard) under varied
environmental and solar irradiance profiles.
=============================================================================
"""

import math
import random
import csv
import os

# Equilibrium Moisture Content (EMC) parameters using modified Oswin equation
# EMC = (A + B*T) * (RH / (100 - RH))^(1/C)
EMC_PARAMS = {
    "PADDY":   {"A": 11.5, "B": -0.045, "C": 2.65, "safe_max_temp": 42.0, "target_moist": 13.0, "initial_range": (20.0, 26.0)},
    "WHEAT":   {"A": 10.8, "B": -0.040, "C": 2.50, "safe_max_temp": 40.0, "target_moist": 12.0, "initial_range": (18.0, 24.0)},
    "MAIZE":   {"A": 12.0, "B": -0.050, "C": 2.70, "safe_max_temp": 43.0, "target_moist": 13.5, "initial_range": (22.0, 28.0)},
    "SOYBEAN": {"A": 8.5,  "B": -0.035, "C": 2.20, "safe_max_temp": 38.0, "target_moist": 11.0, "initial_range": (16.0, 22.0)},
    "MUSTARD": {"A": 6.8,  "B": -0.028, "C": 1.95, "safe_max_temp": 36.0, "target_moist": 8.5,  "initial_range": (14.0, 19.0)},
}

def calculate_emc(seed_type: str, temp_c: float, rh_pct: float) -> float:
    """Computes equilibrium moisture content (%) based on Oswin isotherm."""
    params = EMC_PARAMS.get(seed_type, EMC_PARAMS["PADDY"])
    rh = max(5.0, min(95.0, rh_pct))
    t = max(15.0, min(65.0, temp_c))
    
    a_term = params["A"] + params["B"] * t
    ratio = rh / (100.0 - rh)
    emc = a_term * (ratio ** (1.0 / params["C"]))
    return max(4.0, min(25.0, emc))

def calculate_drying_rate_k(temp_c: float, airflow_cfm: float, solar_pct: float) -> float:
    """
    Computes drying rate constant k (1/hour) using Arrhenius thermal activation.
    k increases with chamber temperature, convective airflow, and solar radiant flux.
    """
    t_kelvin = temp_c + 273.15
    e_a = 28500.0  # Activation energy J/mol
    r_gas = 8.314  # Gas constant J/(mol*K)
    k_0 = 1250.0   # Pre-exponential frequency factor
    
    # Base thermal drying kinetic
    k_thermal = k_0 * math.exp(-e_a / (r_gas * t_kelvin))
    
    # Convective & Radiant enhancement factor
    flow_factor = 1.0 + (airflow_cfm / 100.0) * 0.4
    solar_factor = 1.0 + (solar_pct / 100.0) * 0.25
    
    return k_thermal * flow_factor * solar_factor

def generate_drying_run(seed_type: str, run_id: int):
    """Simulates a complete solar drying batch experiment from harvest moisture down to target."""
    config = EMC_PARAMS[seed_type]
    m0 = random.uniform(*config["initial_range"])
    target_m = config["target_moist"]
    
    # Base environmental diurnal parameters
    base_ambient_temp = random.uniform(25.0, 34.0)
    base_ambient_rh = random.uniform(40.0, 65.0)
    solar_peak = random.uniform(70.0, 100.0)
    
    # Drying page model exponent n (grain geometry factor)
    n_exponent = random.uniform(0.78, 0.88)
    
    records = []
    current_m = m0
    t_mins = 0
    step_mins = 5  # Telemetry sample every 5 minutes
    
    while current_m > (target_m - 0.5) and t_mins <= 600:
        # Solar diurnal curve: sin wave peak at midday
        solar_hour_factor = math.sin(math.pi * min(1.0, max(0.0, (t_mins + 120) / 480.0)))
        solar_pct = max(10.0, min(100.0, solar_peak * solar_hour_factor + random.gauss(0, 2.5)))
        
        # Chamber temperature boosted by solar greenhouse collector
        chamber_temp = base_ambient_temp + (solar_pct / 100.0) * 12.0 + random.gauss(0, 0.4)
        
        # Chamber relative humidity inversely related to temperature
        chamber_rh = max(20.0, base_ambient_rh - (solar_pct / 100.0) * 20.0 + random.gauss(0, 0.8))
        
        # Blower fan speed (CFM) controlled based on moisture & temp
        fan_airflow = 60.0 if current_m > 16.0 else 40.0
        
        # Equilibrium Moisture Content
        emc = calculate_emc(seed_type, chamber_temp, chamber_rh)
        
        # Page thin layer model: M(t) = Me + (M0 - Me) * exp(-k * (t_hours)^n)
        t_hours = t_mins / 60.0
        k = calculate_drying_rate_k(chamber_temp, fan_airflow, solar_pct)
        
        if current_m > emc:
            # Moisture decay over delta t
            decay_factor = math.exp(-k * (step_mins / 60.0) ** n_exponent)
            current_m = emc + (current_m - emc) * decay_factor
            # Small random sensor noise
            sensed_moisture = current_m + random.gauss(0, 0.08)
        else:
            sensed_moisture = current_m
            
        records.append({
            "run_id": run_id,
            "seed_type": seed_type,
            "elapsed_minutes": t_mins,
            "chamber_temp_c": round(chamber_temp, 2),
            "chamber_rh_pct": round(chamber_rh, 2),
            "solar_pct": round(solar_pct, 1),
            "current_moisture_pct": round(sensed_moisture, 2),
            "target_moisture_pct": target_m,
            "emc_pct": round(emc, 2),
            "fan_state": 1 if chamber_temp < config["safe_max_temp"] else 1,
            "vent_angle_deg": 75 if sensed_moisture > 20 else (45 if sensed_moisture > 15 else 30)
        })
        
        t_mins += step_mins

    # Calculate actual remaining drying time (Ground Truth label for ML)
    total_batch_duration = t_mins - step_mins
    for row in records:
        row["remaining_time_mins"] = max(0, total_batch_duration - row["elapsed_minutes"])
        
    return records

def generate_full_dataset(num_runs_per_seed: int = 40, output_path: str = "prakshan_drying_dataset.csv"):
    """Generates a comprehensive multi-grain drying dataset and saves to CSV."""
    all_records = []
    run_counter = 1
    
    print(f"[*] Generating physics-grounded agricultural dataset for Prakashan AI...")
    for seed in EMC_PARAMS.keys():
        for _ in range(num_runs_per_seed):
            batch = generate_drying_run(seed, run_counter)
            all_records.extend(batch)
            run_counter += 1
            
    # Save to CSV
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    fieldnames = [
        "run_id", "seed_type", "elapsed_minutes", "chamber_temp_c", 
        "chamber_rh_pct", "solar_pct", "current_moisture_pct", 
        "target_moisture_pct", "emc_pct", "fan_state", 
        "vent_angle_deg", "remaining_time_mins"
    ]
    
    with open(output_path, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_records)
        
    print(f"[+] Successfully generated {len(all_records)} sensor records across {run_counter-1} drying runs.")
    print(f"[+] Saved dataset to: {output_path}")
    return output_path

if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    data_file = os.path.join(current_dir, "prakshan_drying_dataset.csv")
    generate_full_dataset(num_runs_per_seed=30, output_path=data_file)
