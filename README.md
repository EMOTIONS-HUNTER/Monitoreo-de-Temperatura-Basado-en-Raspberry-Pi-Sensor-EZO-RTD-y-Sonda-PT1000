# EZO RTD Temperature Monitor — Basic UI Dashboard

## Overview

This project implements a real-time temperature monitoring system based on the **Atlas Scientific EZO-RTD™** sensor module, interfaced via I²C to a Raspberry Pi. It extends a previous air quality monitoring platform (originally built around the HTU21D sensor) by replacing the temperature/humidity measurement stage with a high-precision RTD (Resistance Temperature Detector) circuit that provides temperature-only readings with significantly improved accuracy.

The system follows a layered architecture: a C daemon reads sensor data over I²C, writes it to a JSON file, and a lightweight HTML/CSS/JS dashboard served by Nginx polls that file every second to display live temperature readings in a browser.

---

## Hardware

### Sensor: Atlas Scientific EZO-RTD™ (ISCCB-2 Module)

The EZO-RTD is a complete circuit board that conditions RTD signals and communicates digitally. It supports both UART and I²C protocols. In this project it operates in **I²C mode**.

Key specifications:

| Parameter | Value |
|---|---|
| I²C Address | `0x66` |
| Supply Voltage | 3.3 V – 5.0 V |
| Temperature Range | −126.000 °C to 1254.000 °C |
| Resolution | 0.001 °C |
| Accuracy | ±(0.1 °C + 0.0017 × |T|) |
| Communication | I²C / UART |
| Response Time | ≈ 1 s per reading |

### Wiring — ISCCB-2 → Raspberry Pi

| ISCCB-2 Pin | Raspberry Pi Pin | Signal |
|---|---|---|
| VCC | Pin 1 | 3.3 V |
| GND | Pin 6 | Ground |
| SDA | Pin 3 (GPIO2) | I²C Data |
| SCL | Pin 5 (GPIO3) | I²C Clock |
| OFF | — | Not connected |

> **Note:** The `OFF` pin is used to put the EZO circuit into low-power sleep mode. It is left unconnected in this implementation, meaning the circuit remains always active.

---

## Repository Structure

```
basic-ui-dashboard/
├── data/
│   ├── EZORTD.json          # Live temperature output (written by daemon)
│   ├── EZORTD.csv           # CSV log with timestamps (written by daemon)
│   └── HTU21D.json          # Legacy HTU21D data (retained from previous project)
├── images/
│   ├── thermometer-outline.svg
│   ├── water-outline.svg
│   ├── cloud-outline.svg
│   └── sunny-outline.svg
├── sensors/
│   ├── EZORTD/
│   │   ├── ezortd.h         # EZO RTD library header
│   │   ├── ezortd.c         # I²C communication implementation
│   │   ├── main.c           # One-shot executable (single reading → stdout)
│   │   ├── ezortd_daemon.c  # Continuous daemon (writes JSON + CSV log)
│   │   └── Makefile
│   └── HTU21D/              # Legacy sensor (retained for reference)
│       ├── htu21d.h
│       ├── htu21d.c
│       ├── main.c
│       └── Makefile
├── index.html               # Minimal dashboard (temperature only)
├── index-css.html           # Extended dashboard (temperature, humidity, CO₂, pressure)
└── README.md
```

---

## Prerequisites

### Enable I²C on the Raspberry Pi

```sh
sudo raspi-config
# Navigate to: Interface Options → I2C → Enable
sudo reboot
```

### Install Required Packages

```sh
sudo apt update
sudo apt install i2c-tools build-essential
```

### Verify Sensor Detection

After wiring, confirm the EZO-RTD responds at address `0x66`:

```sh
sudo i2cdetect -y 1
```

Expected output (address `0x66` should be visible):

```
     0  1  2  3  4  5  6  7  8  9  a  b  c  d  e  f
00:
...
60: -- -- -- -- -- -- 66 -- -- -- -- -- -- -- -- --
```

> The EZO-RTD uses I²C bus 1 on the Raspberry Pi (pins 3 and 5). Confirm with `ls /dev/i2c-*`.

---

## Building the Sensor Programs

### EZO RTD (primary sensor)

```sh
cd sensors/EZORTD
make
```

This produces two targets:

- **`EZORTD`** — single-shot binary. Reads one temperature sample and prints it as JSON to stdout:

```sh
./EZORTD
{ "temperature": 24.414 }
```

- **`ezortd_daemon`** (compiled separately) — continuous loop that writes `data/EZORTD.json` and appends to a CSV log every second:

```sh
gcc -o ezortd_daemon ezortd_daemon.c ezortd.c -I.
./ezortd_daemon &
```

> Adjust the output file paths inside `ezortd_daemon.c` to match your local repository path before compiling.

---

## Serving the Dashboard

### Install and Configure Nginx

```sh
sudo apt install nginx
```

Edit the default site configuration:

```sh
sudo nano /etc/nginx/sites-available/default
```

Replace the `root` directive:

```nginx
root /home/pi/path/to/basic-ui-dashboard;
```

Restart Nginx:

```sh
sudo systemctl restart nginx
```

Open a browser and navigate to the device's hostname or IP address:

```
http://<raspberry-pi-ip>/
```

or, if mDNS is configured:

```
http://<hostname>.local/
```

The dashboard (`index.html`) polls `data/EZORTD.json` every **1 second** and displays the current temperature value.

---

## Automating Data Updates

To keep the JSON file continuously updated, run the daemon as a background service or configure it to start on boot using `systemd`.

### Minimal systemd unit (recommended)

Create `/etc/systemd/system/ezortd.service`:

```ini
[Unit]
Description=EZO RTD Temperature Daemon
After=network.target

[Service]
ExecStart=/home/pi/path/to/sensors/EZORTD/ezortd_daemon
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start:

```sh
sudo systemctl enable ezortd
sudo systemctl start ezortd
```

### Alternative: crontab (lower resolution, simpler)

```sh
sudo crontab -e
```

Add (updates every minute):

```sh
* * * * * /home/pi/path/to/sensors/EZORTD/EZORTD > /home/pi/path/to/data/EZORTD.json
```

---

## Dashboard Files

### `index.html` — Temperature-only Display

Minimal single-sensor dashboard. Fetches `data/EZORTD.json` and refreshes every 1 second. Suitable for monitoring a single RTD probe.

### `index-css.html` — Multi-sensor Dashboard

Extended dashboard supporting temperature, humidity, CO₂, and atmospheric pressure from multiple JSON sources. Sensor cards are currently wired to `HTU21D.json`; the other fetch calls are commented out pending integration of additional sensors.

---

## Migration Notes from HTU21D

The previous version of this project used the HTU21D sensor for combined temperature and humidity measurements. The EZO-RTD replaces only the temperature measurement stage. Key differences:

| Aspect | HTU21D | EZO-RTD |
|---|---|---|
| I²C Address | `0x40` | `0x66` |
| I²C Bus | Bus 1 | Bus 1 |
| Measurements | Temperature + Humidity | Temperature only |
| Resolution | 0.01 °C | 0.001 °C |
| Communication library | `libi2c` (SMBus) | Raw I²C (`linux/i2c-dev.h`) |
| Read command | SMBus block read (`0xE3`) | ASCII `"R"` command, 1 s delay |

The HTU21D source files are retained in `sensors/HTU21D/` for reference.

---

## Troubleshooting

**Sensor not detected at `0x66`:**
Check that I²C mode is selected on the EZO-RTD. The default factory mode is UART. To switch to I²C, consult the [Atlas Scientific EZO-RTD datasheet](https://atlas-scientific.com/circuits/ezo-rtd-circuit/) and follow the UART-to-I²C mode switching procedure.

**`ioctl: Operation not permitted`:**
Run the executable with `sudo` or add the user to the `i2c` group:
```sh
sudo usermod -aG i2c $USER
```

**JSON file not updating:**
Verify the daemon is running (`ps aux | grep ezortd_daemon`) and that the output path in `ezortd_daemon.c` is correct and writable.

**Browser shows `--` (no data):**
Confirm Nginx is serving files from the correct directory and that `data/EZORTD.json` exists and is valid JSON.

---

## Future Work

- Integrate remaining sensors: BH1750 (light), BMP581 (pressure), ZMOD4410 (TVOC/IAQ)
- Add historical data visualization using the CSV log
- Implement WebSocket-based push updates to replace polling
- Package the daemon as a proper `systemd` service with logging
- Add temperature alarm thresholds with visual/audible notification
