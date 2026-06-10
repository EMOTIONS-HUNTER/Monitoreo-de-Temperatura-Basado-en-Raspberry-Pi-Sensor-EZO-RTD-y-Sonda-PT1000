# System Architecture — EZO RTD Temperature Monitor

> **Purpose of this document:** Provide a complete architectural snapshot of the project so that any contributor (or AI assistant) can understand the full system — hardware, firmware, data pipeline, and frontend — without reading every source file individually.

---

## 1. System Overview

The system is a **single-node embedded IoT monitoring platform** composed of four layers:

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 4 — Presentation      index.html / index-css.html    │
│             Browser polls JSON via HTTP every 1 s           │
├─────────────────────────────────────────────────────────────┤
│  Layer 3 — Web Server        Nginx (static file server)     │
│             Serves HTML, SVG assets, and JSON data files    │
├─────────────────────────────────────────────────────────────┤
│  Layer 2 — Backend Daemon    ezortd_daemon (C binary)       │
│             Reads I²C → writes JSON + appends CSV           │
├─────────────────────────────────────────────────────────────┤
│  Layer 1 — Hardware / HAL    EZO-RTD via I²C on RPi         │
│             Atlas Scientific ISCCB-2 @ 0x66, I²C bus 1     │
└─────────────────────────────────────────────────────────────┘
```

**Host board:** Raspberry Pi (any model with 40-pin GPIO; developed on Raspberry Pi Zero or similar)
**OS:** Raspberry Pi OS (Debian-based, Linux kernel)
**Language:** C (backend), HTML/CSS/JavaScript (frontend)
**IPC mechanism:** File system — JSON files in `data/` act as the shared state between daemon and web server

---

## 2. Hardware Layer

### 2.1 Sensor — Atlas Scientific EZO-RTD™ (ISCCB-2)

The EZO-RTD is a signal-conditioning circuit for Pt-100 or Pt-1000 RTD probes. It digitizes the analog RTD signal internally and exposes a clean digital interface via I²C or UART.

| Property | Value |
|---|---|
| Module | Atlas Scientific ISCCB-2 |
| Protocol in use | I²C |
| I²C Address | `0x66` (fixed, factory default) |
| I²C Bus | Bus 1 (`/dev/i2c-1`) |
| Supply voltage | 3.3 V |
| Read command | ASCII string `"R"` (1 byte) |
| Response time | ~1000 ms after issuing `"R"` |
| Response format | Byte 0: status code (`0x01` = success); Bytes 1–N: null-terminated ASCII float |
| Resolution | 0.001 °C |

### 2.2 Physical Wiring

```
EZO-RTD (ISCCB-2)          Raspberry Pi 40-pin Header
─────────────────          ──────────────────────────
VCC  ──────────────────────  Pin 1   (3.3 V)
GND  ──────────────────────  Pin 6   (GND)
SDA  ──────────────────────  Pin 3   (GPIO2, I²C1 SDA)
SCL  ──────────────────────  Pin 5   (GPIO3, I²C1 SCL)
OFF  ──── not connected
```

> The `OFF` pin (active-low sleep input) is left floating/unconnected; the circuit is permanently powered. Future implementations may drive this pin from a GPIO to enable power management.

### 2.3 I²C Bus Configuration

- **Bus:** `/dev/i2c-1`
- **Speed:** 100 kHz (standard mode; the EZO-RTD supports up to 400 kHz Fast Mode)
- **Pull-ups:** Provided internally by the Raspberry Pi (1.8 kΩ on SDA/SCL lines)
- **Enable:** `sudo raspi-config` → Interface Options → I2C → Enable

---

## 3. Firmware / HAL Layer (C)

### 3.1 Source Files

| File | Role |
|---|---|
| `sensors/EZORTD/ezortd.h` | Public API: I²C address constant, `getTemperature()` declaration |
| `sensors/EZORTD/ezortd.c` | `getTemperature()` implementation |
| `sensors/EZORTD/main.c` | One-shot binary: single read → JSON to stdout |
| `sensors/EZORTD/ezortd_daemon.c` | Daemon: infinite loop, writes JSON + CSV every second |
| `sensors/EZORTD/Makefile` | Builds `EZORTD` binary (one-shot target) |

### 3.2 `getTemperature()` — Protocol Detail

```c
// Signature
int getTemperature(int fd, double *temperature);
// Returns 0 on success, -1 on error
```

**Communication sequence:**

```
1. ioctl(fd, I2C_SLAVE, 0x66)     — select slave address
2. write(fd, "R", 1)              — issue read command (ASCII 'R')
3. usleep(1000000)                — wait 1000 ms for conversion
4. read(fd, response, 32)         — read up to 32 bytes
5. Check response[0] == 0x01      — status byte: 0x01 = success
6. atof(&response[1])             — parse ASCII float from bytes 1..N
```

**Error codes in `response[0]`:**

| Code | Meaning |
|---|---|
| `0x01` | Success |
| `0x02` | Syntax error in command |
| `0xFF` | No data (not ready) |
| `0xFE` | Pending (not ready yet) |

### 3.3 One-Shot Executable (`EZORTD`)

Compiled from `main.c + ezortd.c`. Opens `/dev/i2c-1`, calls `getTemperature()` once, prints result as JSON to stdout, exits.

```sh
./EZORTD
{ "temperature": 24.414 }
```

Used for testing and for cron-based updates.

### 3.4 Daemon (`ezortd_daemon`)

Compiled from `ezortd_daemon.c + ezortd.c`. Runs an infinite loop with 1-second sleep between iterations. On each iteration:

1. Reads temperature via `getTemperature()`
2. Overwrites `data/EZORTD.json` with current value
3. Appends a Unix-timestamp + temperature row to `logs/temp.csv`

**Output paths** (hardcoded in source — update before compiling):

```c
// JSON
"/home/cristian/airquality/basic-ui-dashboard/data/EZORTD.json"
// CSV log
"/home/cristian/airquality/basic-ui-dashboard/logs/temp.csv"
```

**JSON output format:**

```json
{ "temperature": 24.414 }
```

**CSV output format:**

```
timestamp,temperature        ← header row (from EZORTD.csv template)
1717027200,24.414            ← Unix epoch (seconds), float to 3 decimal places
```

---

## 4. Data Pipeline

```
[EZO-RTD sensor]
       │
       │  I²C (0x66, /dev/i2c-1)
       ▼
[ezortd_daemon — C process]
       │
       ├──► data/EZORTD.json    (overwrite, every 1 s)
       │        { "temperature": 24.414 }
       │
       └──► logs/temp.csv       (append, every 1 s)
                1717027200,24.414
                       │
                       ▼
              [Future: historical chart]

[Nginx — static file server]
       │
       │  HTTP GET ./data/EZORTD.json
       ▼
[Browser — index.html]
       │
       │  setInterval(fetchData, 1000)
       ▼
[DOM update — temp-value element]
```

---

## 5. Web Server Layer

**Server:** Nginx (static file serving only — no application logic)

**Document root:** Set to the repository root directory in `/etc/nginx/sites-available/default`:

```nginx
root /home/pi/<repo-path>;
```

**Served assets:**

| Path | Description |
|---|---|
| `/` or `/index.html` | Minimal temperature dashboard |
| `/index-css.html` | Extended multi-sensor dashboard |
| `/data/EZORTD.json` | Live temperature JSON (written by daemon) |
| `/images/*.svg` | Ionicons SVG assets (thermometer, water, cloud, sun) |

No server-side scripting is used. The daemon writes files to disk; Nginx serves them as-is.

---

## 6. Frontend Layer

### 6.1 `index.html` — Minimal Dashboard

Single-sensor display. Pure HTML + inline CSS + vanilla JS.

**Data source:** `GET ./data/EZORTD.json`

**Polling interval:** 1000 ms (`setInterval`)

**DOM targets:**

| Element ID | Content |
|---|---|
| `temp-value` | `data.temperature.toFixed(3) + " ℃"` |
| `last-update` | `"Updated: " + new Date().toLocaleTimeString()` |

### 6.2 `index-css.html` — Extended Dashboard

Multi-sensor card layout using Roboto (Google Fonts), flexbox, and CSS animations.

**Data sources (partially commented out):**

```javascript
const res = await Promise.all([
  // fetch("./data/BH1750.json"),   // light — pending
  // fetch("./data/BMP180.json"),   // pressure — pending
  fetch("./data/HTU21D.json"),      // temp + humidity (legacy sensor, active)
  // fetch("./data/MH_Z19.json")    // CO₂ — pending
]);
```

**Polling interval:** 6000 ms

**DOM targets:** `temp-value`, `humidity-value`, `co2-value`, `pressure-value`

---

## 7. Key Constants and Configuration

| Constant | Value | Location |
|---|---|---|
| EZO-RTD I²C address | `0x66` | `sensors/EZORTD/ezortd.h` |
| HTU21D I²C address | `0x40` | `sensors/HTU21D/htu21d.h` |
| I²C bus device | `/dev/i2c-1` | `sensors/EZORTD/main.c`, `ezortd_daemon.c` |
| Sensor read delay | 1,000,000 µs (1 s) | `sensors/EZORTD/ezortd.c` |
| Daemon loop interval | `sleep(1)` — 1 s | `sensors/EZORTD/ezortd_daemon.c` |
| JSON output path | `/home/cristian/…/data/EZORTD.json` | `ezortd_daemon.c` (**update per deployment**) |
| CSV log path | `/home/cristian/…/logs/temp.csv` | `ezortd_daemon.c` (**update per deployment**) |
| Frontend poll interval (primary) | 1000 ms | `index.html` |
| Frontend poll interval (extended) | 6000 ms | `index-css.html` |
| Nginx document root | `/home/pi/<repo-path>` | `/etc/nginx/sites-available/default` |

---

## 8. Build System

### EZO RTD

```makefile
CC=gcc
CFLAGS=-I.
OBJ=main.o ezortd.o

%.o: %.c
    $(CC) -c -o $@ $< $(CFLAGS)

EZORTD: $(OBJ)
    $(CC) -o $@ $^ $(CFLAGS)
```

No external libraries required. Uses only standard Linux I²C headers: `<linux/i2c-dev.h>`, `<sys/ioctl.h>`.

### HTU21D (legacy)

```makefile
EXTRA_LIBS=-li2c
```

Requires `libi2c` (`sudo apt install libi2c-dev`). Uses SMBus wrappers from `<i2c/smbus.h>`.

---

## 9. Legacy Sensor — HTU21D

Retained in `sensors/HTU21D/` for reference and backward compatibility with `index-css.html`.

| Property | Value |
|---|---|
| I²C Address | `0x40` |
| Measurements | Temperature + Relative Humidity |
| Temperature formula | `T = -46.85 + 175.72 × raw / 65536.0` |
| Humidity formula | `RH = -6 + 125 × raw / 65536.0` |
| Library dependency | `libi2c` |
| Command | SMBus block read (`0xE3` temp, `0xE5` humidity) |

---

## 10. Planned Sensors (Not Yet Integrated)

| Sensor | Measurement | Interface | Data file |
|---|---|---|---|
| BH1750 | Ambient light (lux) | I²C | `data/BH1750.json` |
| BMP581 | Atmospheric pressure (hPa) | I²C | `data/BMP581.json` |
| ZMOD4410 | TVOC / IAQ index | I²C | `data/ZMOD4410.json` |

---

## 11. File I/O Summary

| File | Writer | Reader | Format | Update Rate |
|---|---|---|---|---|
| `data/EZORTD.json` | `ezortd_daemon` | Nginx → browser | JSON object | 1 s |
| `logs/temp.csv` | `ezortd_daemon` | (manual / future viz) | CSV (epoch, float) | 1 s (append) |
| `data/HTU21D.json` | `HTU21D` binary (manual / cron) | Nginx → browser | JSON object | On demand |
| `data/EZORTD.csv` | (template only — unused) | — | CSV | — |

---

## 12. Security and Deployment Notes

- The Nginx instance serves on port 80 with no authentication. Suitable for a local LAN network only.
- The daemon runs as root (required for I²C access unless the user is added to the `i2c` group). Use `sudo usermod -aG i2c $USER` to avoid running as root.
- File paths in `ezortd_daemon.c` are hardcoded and must be updated per deployment before compilation.
- No input validation is performed on the JSON data in the browser; malformed JSON causes a silent catch/error in the console.
