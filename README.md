# HYPOGUARD
IoT-Based Hypoglycemia Monitoring and Early Warning System

<p align="center">
  An IoT-based monitoring system designed to observe physiological signals and detect potential early signs of hypoglycemia through real-time sensor data.
</p>

---

## Overview

**HYPOGUARD** is an Internet of Things (IoT)-based health monitoring project designed to monitor physiological parameters associated with potential hypoglycemic conditions.

The system integrates multiple sensors to collect physiological data, processes the measurements through an ESP32 microcontroller, and transmits the data to a server using the MQTT communication protocol.

By combining Heart Rate (HR), Electrodermal Activity (EDA), and body movement data, HYPOGUARD aims to provide continuous monitoring and an early warning mechanism based on predefined physiological conditions.

## Objectives

- Monitor physiological parameters in real time.
- Collect and process heart rate and inter-beat interval (IBI) data.
- Monitor Electrodermal Activity (EDA) as an indicator of changes in sympathetic nervous system activity.
- Analyze body movement and activity patterns.
- Transmit sensor data to a server through MQTT.
- Provide a multi-level warning system based on predefined conditions.

## System Architecture

HYPOGUARD uses an IoT architecture consisting of sensor acquisition, microcontroller processing, MQTT communication, and server-side data handling.

```text
+-----------------------------+
|          SENSORS            |
|                             |
|  MAX30100  |  GSR  | MPU6050|
+-----------------------------+
              |
              v
+-----------------------------+
|            ESP32            |
|                             |
| - Data Acquisition          |
| - Signal Processing         |
| - Status Classification     |
| - OLED Display              |
+-----------------------------+
              |
              v
+-----------------------------+
|         MQTT BROKER         |
|          RabbitMQ           |
+-----------------------------+
              |
              v
+-----------------------------+
|         MQTT HANDLER        |
|                             |
| - Subscribe to Topics       |
| - Receive Sensor Data       |
| - Process Incoming Payloads |
+-----------------------------+
              |
              v
+-----------------------------+
|           SERVER            |
|                             |
| - Data Processing           |
| - Statistical Analysis      |
| - MySQL Database            |
+-----------------------------+
```

## Hardware Components

| Component | Function |
|---|---|
| ESP32 | Main microcontroller and data processing unit |
| MAX30100 | Heart rate and pulse interval monitoring |
| GSR Sensor | Electrodermal Activity (EDA) measurement |
| MPU6050 | Body movement and activity monitoring |
| OLED Display | Displays monitoring results and system status |

## Technology Stack

| Technology | Purpose |
|---|---|
| C++ / Arduino IDE | ESP32 firmware development |
| MQTT | Lightweight communication protocol |
| RabbitMQ | MQTT message broker |
| Node.js | Backend and server-side processing |
| MySQL | Sensor data storage |
| Quasar Framework | Frontend development (if enabled) |
| Axios | HTTP communication between frontend and backend |

## Monitored Parameters

### 1. Heart Rate (HR)

Heart rate monitoring uses the MAX30100 sensor to collect pulse measurements.

Parameters:
- Heart Rate (BPM)
- Inter-Beat Interval (IBI)
- Heart Rate Variability-related statistical features

Statistical processing:
- Standard Deviation (SD)
- Coefficient of Variation (CV)

### 2. Electrodermal Activity (EDA)

EDA is measured using a Galvanic Skin Response (GSR) sensor.

The measurements are used to observe changes in skin conductance associated with sympathetic nervous system activity.

Statistical processing:
- EDA measurements
- Standard Deviation (SD)
- Coefficient of Variation (CV)

### 3. Body Movement

The MPU6050 accelerometer and gyroscope are used to observe body movement and activity patterns.

Movement classification includes:
- **TIDUR** — Sleep-like inactivity condition.
- **GERAK SESAAAT** — Temporary movement.
- **BANGUN** — Awake or active condition.

## MQTT Communication

HYPOGUARD uses MQTT to transmit sensor measurements from the ESP32 to the server.

**Broker Configuration**

| Parameter | Configuration |
|---|---|
| Protocol | MQTT |
| Broker | RabbitMQ |
| Default MQTT Port | 1883 |
| Client ID | hypoguard_esp32 |

**MQTT Topics**

| Topic | Sensor |
|---|---|
| `hypoguard/max` | MAX30100 |
| `hypoguard/eda` | GSR / EDA |
| `hypoguard/mpu` | MPU6050 |

The backend subscribes to the corresponding topics to receive and process incoming sensor measurements.

> Note: Broker credentials and connection details should be configured locally and must never be committed to the public repository.

## Warning Classification

HYPOGUARD is designed with a four-level warning classification system:

| Status | Description |
|---|---|
| NORMAL | No predefined warning condition detected |
| WASPADA | Initial warning condition |
| SIAGA | Increased warning level |
| AWAS | Highest warning level |

The warning classification is intended to be determined from predefined sensor-based conditions and signal analysis.

## Repository Structure

```text
HYPOGUARD/
│
├── firmware/
│   ├── hypoguard.ino
│   └── libraries/
│
├── backend/
│   ├── controllers/
│   ├── mqtt/
│   ├── config/
│   ├── models/
│   ├── routes/
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   └── package.json
│
├── docs/
│   ├── architecture/
│   └── documentation/
│
├── .gitignore
└── README.md
```

*Adjust the directory structure according to the actual repository.*

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR-USERNAME/HYPOGUARD.git
cd HYPOGUARD
```

### 2. Configure ESP32

1. Open the firmware project using Arduino IDE.
2. Install the required libraries.
3. Configure Wi-Fi credentials.
4. Configure MQTT broker settings.
5. Connect the sensors to the ESP32.
6. Upload the firmware.

### 3. Configure the Backend

Navigate to the backend directory:

```bash
cd backend
npm install
```

Create a local `.env` file based on `.env.example` and configure the database and MQTT connection.

Start the backend:

```bash
npm start
```

### 4. Configure the Database

Create the MySQL database and configure the required tables according to the backend database schema.

### 5. Run the Frontend (Optional)

```bash
cd frontend
npm install
npm run dev
```

## Development Status

| Component | Status |
|---|---|
| ESP32 Integration | In Development |
| MAX30100 Monitoring | In Development |
| GSR / EDA Monitoring | In Development |
| MPU6050 Monitoring | In Development |
| OLED Display | In Development |
| MQTT Communication | In Development |
| Backend Integration | In Development |
| MySQL Database | In Development |
| Web Dashboard | In Development |

## Project Scope and Disclaimer

HYPOGUARD is a technology development and research prototype.

The system is intended to explore the potential of combining physiological sensor measurements for hypoglycemia-related monitoring and early warning.

**HYPOGUARD is not a medical diagnostic device and does not directly measure blood glucose levels.** Sensor measurements and warning classifications should not be interpreted as confirmation of hypoglycemia.

Clinical validation and further testing are necessary before the system can be considered for medical use.

## Future Development

- Improve sensor signal quality and measurement reliability.
- Optimize real-time MQTT data transmission.
- Develop more robust physiological data analysis.
- Improve warning classification algorithms.
- Integrate historical data visualization.
- Conduct system testing and validation.

## Contributors

Developed as an IoT-based health monitoring and research project.

**Project:** HYPOGUARD

**Field:** Internet of Things (IoT), Health Technology, Embedded Systems, and Data Monitoring.

---

<p align="center">
  <b>HYPOGUARD</b><br>
  <i>Monitoring Today, Protecting Tomorrow.</i>
</p>
