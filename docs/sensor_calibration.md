# Sensor Calibration Procedure: PRAKASHAN AI
### "Drying solutions for global agriculture"

Accurate sensor calibration is critical to ensure seed embryo viability and precise prediction of residual drying time.

---

## 1. Capacitive Seed Moisture Sensor (v1.2 / Analog)

Unlike resistive probes, **Capacitive Moisture Sensors** measure changes in electrical permittivity ($\epsilon_r$) without exposing bare metal to grain acids or moisture, preventing corrosion.

```text
                  ┌──────────────────────┐
                  │ Capacitive Sensor v1.2│
                  │   [ Probe Body ]     │
                  └──────────┬───────────┘
                             │ (Analog 0-3.0V)
                             ▼
                     Arduino Pin A0
```

### Calibration Protocol (2-Point Agricultural Standard)

1. **Step 1: Dry Baseline Calibration ($ADC_{\text{air}}$)**
   - Take a clean, dry sample of the seed (e.g. Paddy at $\approx 8\text{--}10\%$ moisture or hold the probe in dry ambient air).
   - Place probe fully into the dry seed bed.
   - Read the stable raw 10-bit ADC output via Serial (`CALIB_AIR`).
   - Typical $ADC_{\text{air}}$ value: **$\approx 700 \text{--} 740$**.

2. **Step 2: Saturated Wet Baseline Calibration ($ADC_{\text{wet}}$)**
   - Take a sample of fresh harvest or soaked seed (moisture content $\approx 35.0\%$).
   - Immerse probe into the saturated grain mass.
   - Record the raw ADC value (`CALIB_WET`).
   - Typical $ADC_{\text{wet}}$ value: **$\approx 300 \text{--} 330$**.

### Calibration Transfer Function

$$\text{Moisture (\%)} = \left(\frac{ADC_{\text{air}} - ADC_{\text{measured}}}{ADC_{\text{air}} - ADC_{\text{wet}}}\right) \times M_{\text{span}}$$

Where:
- $ADC_{\text{air}} = 720.0$
- $ADC_{\text{wet}} = 310.0$
- $M_{\text{span}} = 35.0\%$ (Saturation moisture span)

In Arduino C++:
```cpp
float readCalibratedMoisture() {
  int rawADC = readFilteredAdc(PIN_MOISTURE_ADC, 12);
  float moist = ((CALIB_AIR_ADC - rawADC) / (CALIB_AIR_ADC - CALIB_WET_ADC)) * 35.0;
  return constrain(moist, 5.0, 45.0);
}
```

---

## 2. Temperature & Relative Humidity Sensor (DHT22 / AM2302)

The **DHT22** uses a capacitive humidity sensor and high-precision NTC thermistor:
- **Temperature Range**: $-40^\circ\text{C}$ to $+80^\circ\text{C}$ ($\pm 0.5^\circ\text{C}$ accuracy)
- **Humidity Range**: $0\text{--}100\%$ RH ($\pm 2\%$ accuracy)
- **Sampling Period**: Minimum $2.0\,\text{seconds}$ between reads.

### Verification Checklist:
- Place a certified reference digital hygrometer next to the DHT22 in the drying tray.
- Verify readings under ambient condition ($25^\circ\text{C}$, $50\%$ RH).
- The firmware includes a safety clamp: Any reading outside $0\text{--}75^\circ\text{C}$ triggers a sensor disconnect fault alarm immediately.

---

## 3. Ambient Solar Irradiance Sensor (LDR)

An LDR (Light Dependent Resistor) in series with a $10\,\text{k}\Omega$ pull-down resistor forms a light-sensitive voltage divider:

```text
  +5V ─── [ LDR ] ───┬─── [ 10 kΩ Resistor ] ─── GND
                     │
                 Arduino Pin A1
```

### Irradiance Scaling:
- In dark/cloudy conditions: LDR resistance $> 50\,\text{k}\Omega \implies \text{ADC} \approx 100\text{--}200$.
- In bright direct solar sunlight: LDR resistance $< 1\,\text{k}\Omega \implies \text{ADC} \approx 850\text{--}980$.
- Formula: $\text{Solar Irradiance (\%)} = \left(\frac{ADC_{\text{filtered}}}{1023}\right) \times 100\%$

---

## 4. 12V Battery & PV Voltage Calibration

To compensate for slight resistor tolerances ($\pm 1\%$), measure the actual battery voltage with a digital multimeter ($V_{\text{actual}}$) and adjust the scaling factor:

$$\text{Calibration Factor} = \frac{V_{\text{actual}}}{V_{\text{reported}}}$$

Update in `prakshan_ai.ino`:
```cpp
const float ADC_VOLT_FACTOR = (5.0 / 1024.0) * 11.0 * CALIBRATION_FACTOR;
```
