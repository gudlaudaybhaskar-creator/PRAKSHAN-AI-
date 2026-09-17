# Complete Circuit Diagram & Pin Configuration: PRAKASHAN AI
### "Drying solutions for global agriculture"

**Prakashan AI** is an intelligent, low-cost, off-grid solar-powered seed dryer controller built on the **Arduino Uno (ATmega328P)**. This document provides complete hardware schematics, pin connections, power management architecture, and sizing calculations.

---

## 1. Complete Pin Configuration Table

| Arduino Uno Pin | Component | Interface Type | Function / Signal Description |
| :--- | :--- | :--- | :--- |
| **D2** | DHT22 (AM2302) | 1-Wire Digital | Chamber Temperature (°C) & Relative Humidity (%) |
| **D4** | Green LED | Digital Output | Normal Drying Status Indicator (via 330Ω resistor) |
| **D5** | Yellow LED | Digital Output | High-Temp Exhaust Venting Indicator (via 330Ω) |
| **D6** | Red LED | Digital Output | Thermal Overheat / Sensor Fault Alarm (via 330Ω) |
| **D7** | Active Buzzer | Digital Output | Audio Alarm for Critical Safety Limits |
| **D8** | 5V Relay Module | Digital Output | DC Blower Fan Power Switching (Active LOW) |
| **D9** | Servo Motor (SG90) | PWM Output (50Hz) | Motorized Exhaust Vent Flap Position (0° to 90°) |
| **D10** | MicroSD Card Module | SPI (Chip Select) | SD Card CS Pin |
| **D11** | MicroSD Card Module | SPI (MOSI) | Master Out Slave In |
| **D12** | MicroSD Card Module | SPI (MISO) | Master In Slave Out |
| **D13** | MicroSD Card Module | SPI (SCK) | SPI Serial Clock |
| **A0** | Capacitive Moisture | Analog Input | Seed Bed Moisture Probe (0–5V ADC) |
| **A1** | LDR Sensor | Analog Input | Ambient Solar Irradiance Voltage Divider |
| **A2** | Battery Monitor | Analog Input | 12V Battery Voltage Divider (100kΩ / 10kΩ) |
| **A3** | Solar PV Monitor | Analog Input | Solar Panel Voltage Divider (100kΩ / 10kΩ) |
| **A4 (SDA)** | I2C OLED (SSD1306) | I2C Data | Real-time LCD/OLED Telemetry Display |
| **A5 (SCL)** | I2C OLED (SSD1306) | I2C Clock | Real-time LCD/OLED Telemetry Display |
| **5V / GND** | Logic Power Rail | Power Bus | Powers sensors, OLED, and logic circuits |
| **VIN / GND** | 12V->5V Buck Output | Power Input | Regulated 5V/7V logic power supply |

---

## 2. System Circuit & Connection Diagram (ASCII Schematic)

```text
+========================================================================================+
|                               PRAKASHAN AI SYSTEM SCHEMATIC                            |
|                        "Drying solutions for global agriculture"                       |
+========================================================================================+

 [ SOLAR PV PANEL (50W-100W 18V) ]
         │          │
        (+)        (-)
         │          │
         ▼          ▼
 ┌───────────────────────────────┐
 │ SOLAR CHARGE CONTROLLER (12V) ├───[ 12V 14Ah Lead-Acid / LiFePO4 Battery ]
 └──────┬─────────────────┬──────┘
        │ (+) 12V         │ (-) GND
        │                 │
 ┌──────┴─────────────────┴──────┐
 │ DC-DC BUCK CONVERTER (12V->5V)│
 └──────┬─────────────────┬──────┘
        │ +5V             │ GND (Common Ground)
        │                 │
        ├─────────────────┼────────────────────────────────────────┐
        │                 │                                        │
        ▼                 ▼                                        ▼
 ┌───────────────────────────────┐                          ┌───────────────┐
 │       ARDUINO UNO R3          │                          │ 5V RELAY MOD. │
 │                               │                          │ VCC ──> +5V   │
 │ 5V Rail ───────> Sensors VCC  │                          │ GND ──> GND   │
 │ GND ───────────> Sensors GND  │                          │ IN  <── Pin D8│
 │                               │                          └───┬───────┬───┘
 │ Pin D2 ───────> DHT22 Data    │                              │       │
 │ Pin D4 ───────> Green LED (+) │                              │  NO   │ COM
 │ Pin D5 ───────> Yellow LED (+)│                              │       │
 │ Pin D6 ───────> Red LED (+)   │                              ▼       ▼
 │ Pin D7 ───────> Buzzer (+)    │                      ┌──────────────────────┐
 │ Pin D8 ───────> Relay IN      │                      │ 12V DC BLOWER FAN    │
 │ Pin D9 ───────> Servo PWM     │                      │ (12V from Battery)   │
 │ Pin D10───────> SD CS         │                      └──────────────────────┘
 │ Pin D11───────> SD MOSI       │
 │ Pin D12───────> SD MISO       │                          ┌──────────────────────┐
 │ Pin D13───────> SD SCK        │                          │ EXHAUST VENT SERVO   │
 │                               │                          │ PWM <── Pin D9       │
 │ Pin A0 <─────── Capacitive S. │                          │ VCC ──> +5V          │
 │ Pin A1 <─────── LDR Divider   │                          │ GND ──> GND          │
 │ Pin A2 <─────── Bat Divider   │                          └──────────────────────┘
 │ Pin A3 <─────── PV Divider    │
 │ Pin A4 (SDA)──> OLED SDA      │                          ┌──────────────────────┐
 │ Pin A5 (SCL)──> OLED SCL      │                          │ 0.96" I2C OLED / LCD │
 └───────────────────────────────┘                          │ SDA <── A4, SCL <──A5│
                                                            │ VCC ──> +5V, GND──GND│
                                                            └──────────────────────┘
```

---

## 3. Precision Voltage Divider Sizing for Analog Inputs

To measure voltages above the Arduino 5.0V ADC limit (12V Battery up to 14.8V during charging, Solar PV open-circuit voltage up to 21.5V), precision resistor voltage dividers are used:

```text
  Vin (Battery or PV +)
      │
     [R1] = 100 kΩ (1% metal film)
      │
      ├──────────> Arduino Analog Pin (A2 or A3)
      │
     [R2] = 10 kΩ (1% metal film)
      │
     GND
```

### Voltage Scaling Formula:
$$V_{\text{out}} = V_{\text{in}} \times \frac{R_2}{R_1 + R_2} = V_{\text{in}} \times \frac{10}{100 + 10} = \frac{V_{\text{in}}}{11}$$

$$V_{\text{in}} = \text{ADC} \times \left(\frac{5.0\,\text{V}}{1024}\right) \times 11.0 = \text{ADC} \times 0.05371\,\text{V}$$

- Max measurable voltage: $5.0\,\text{V} \times 11.0 = \mathbf{55.0\,\text{V}}$ (Plenty of safety margin against solar voltage spikes).
- Noise filter: Place a $0.1\,\mu\text{F}$ ceramic capacitor between each analog input pin and GND.

---

## 4. Off-Grid Solar & Battery Sizing Calculations

### Power Budget:
1. **Arduino Uno + Sensors + OLED + SD Module**: $5\,\text{V} \times 120\,\text{mA} = 0.6\,\text{W}$
2. **Servo Motor (Intermittent Flap Positioning)**: $5\,\text{V} \times 150\,\text{mA} \times 0.2 = 0.15\,\text{W}$
3. **12V DC Blower Fan (High-efficiency Brushless)**: $12\,\text{V} \times 0.75\,\text{A} = 9.0\,\text{W}$
4. **Total Peak Consumption**: $\approx \mathbf{9.75\,\text{W}}$

### Daily Energy Requirement:
- Operating hours per day: $8\,\text{hours active drying} + 4\,\text{hours standby} = 10\,\text{hours average}$
- Daily Energy Consumption: $9.75\,\text{W} \times 10\,\text{h} = \mathbf{97.5\,\text{Wh/day}}$

### Sizing Specifications:
- **Solar PV Panel**: A **50W to 100W 18V Monocrystalline Panel** delivers $\approx 250\text{--}450\,\text{Wh/day}$ on typical sunny days, providing $2.5\times$ energy surplus to charge the battery while running the dryer.
- **Battery Capacity**: $12\,\text{V}\ 14\,\text{Ah Lead-Acid}$ or $12.8\,\text{V}\ 12\,\text{Ah LiFePO4}$ ($153.6\,\text{Wh}$) provides **1.5 full days of continuous autonomy** during cloudy or overcast weather.
- **Charge Controller**: $12\,\text{V}\ 10\,\text{A PWM or MPPT}$ controller with low-voltage disconnect (LVD at 11.1V) to prevent deep battery discharge.
