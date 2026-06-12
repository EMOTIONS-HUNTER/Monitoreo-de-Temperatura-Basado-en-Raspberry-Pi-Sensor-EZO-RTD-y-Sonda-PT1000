# Especificación de Arquitectura del Sistema
## Sistema de Monitoreo de Parámetros Fisicoquímicos para Fotobiorreactor

**Revisión:** 2.0  
**Estado:** Vigente  

---

## 1. Visión General del Sistema

El sistema implementa una arquitectura de cuatro capas desacopladas que operan de forma asíncrona sobre una red local. El flujo de datos se inicia en el hardware físico del sensor (bus I²C) y se propaga hasta el navegador web del operador mediante una cadena de transformaciones bien definidas. En la fase actual de desarrollo, la capa de hardware es emulada por un servidor de simulación (*mock*) Node.js que reproduce fielmente las latencias y los formatos de respuesta de los módulos Atlas Scientific EZO.

### 1.1. Diagrama de Capas

```
┌──────────────────────────────────────────────────────────────────────┐
│  CAPA 4 — PRESENTACIÓN                                               │
│  Navegador web (HTML5, CSS3, Vanilla JS ES6+, Chart.js, SheetJS)     │
│  Polling cada 1000 ms → GET /api/sensors/:type                       │
│  Envío de comandos → POST /api/sensors/:type/command                 │
├──────────────────────────────────────────────────────────────────────┤
│  CAPA 3 — ENRUTAMIENTO Y PROXY                                       │
│  Nginx, puerto 8888                                                  │
│  - Entrega de archivos estáticos del frontend (HTML, CSS, JS)        │
│  - Proxy inverso transparente: /api/* → http://127.0.0.1:3000        │
├──────────────────────────────────────────────────────────────────────┤
│  CAPA 2 — LÓGICA DE NEGOCIO Y API                                    │
│  Node.js + Express, puerto 3000                                      │
│  - GET /api/sensors/:type → 60 registros simulados, latencia 400 ms  │
│  - POST /api/sensors/:type/command → parser léxico EZO completo      │
├──────────────────────────────────────────────────────────────────────┤
│  CAPA 1 — ADQUISICIÓN DE DATOS (HARDWARE / SIMULADO)                 │
│  Demonios C nativos en Raspberry Pi (producción futura)              │
│  Lectura por I²C: /dev/i2c-1 @ 100 kHz                              │
│  Módulos: EZO-RTD (0x66), EZO-pH (0x63), EZO-DO (0x61), EZO-EC (0x64)│
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Topología de Red Local y Flujo de Datos Asíncrono

### 2.1. Topología

El sistema opera exclusivamente en una red de área local (LAN). Un único nodo Raspberry Pi actúa como servidor de todos los servicios. Los clientes son navegadores web en la misma red. No existe comunicación hacia redes externas en la configuración de producción.

```
  [Navegador del operador]
         │
         │  HTTP, puerto 8888
         ▼
  [Nginx — Proxy Inverso]
    │             │
    │ Estático    │ /api/* → proxy
    ▼             ▼
  [frontend/]  [Node.js Express — puerto 3000]
                   │
                   │  Simula protocolo I²C EZO (fase actual)
                   │  ─────────────────────────────────────
                   │  Producción futura: lectura real de
                   │  archivos JSON escritos por demonios C
                   ▼
              [data/EZORTD.json]
              [data/EZOPH.json ]   ← escritos por demonios C
              [data/EZODO.json ]      (Capa 1 / hardware)
              [data/EZOEC.json ]
```

### 2.2. Flujo de Datos Asíncrono — Lectura en Vivo

```
1. El navegador ejecuta setInterval(updateDashboard, 1000)
2. dashboard.js llama a fetch('/api/sensors/rtd'), fetch('/api/sensors/ph'), etc.
3. Las peticiones alcanzan Nginx en el puerto 8888
4. Nginx reenvía /api/* → http://127.0.0.1:3000/api/*
5. Express evalúa el parámetro :type y genera 60 registros simulados
6. El servidor responde con un arreglo JSON tras una latencia de 400 ms
7. dashboard.js parsea la respuesta, actualiza el DOM y evalúa alarmas
8. renderAlarmSummary() actualiza el resumen de riesgo global
```

### 2.3. Flujo de Datos Asíncrono — Comando EZO (Consola de Hardware)

```
1. El operador selecciona el sensor y emite un comando desde la interfaz
2. mock-service.js ejecuta: POST /api/sensors/:type/command
   Body: { "command": "cal,mid,7.00" }
3. Nginx reenvía la petición al puerto 3000
4. El parser léxico de Express descompone el comando por comas:
   parts = ["cal", "mid", "7.00"], baseCmd = "cal"
5. Se aplica la latencia de procesamiento químico correspondiente (600 ms para CAL)
6. El servidor responde: { "success": true, "sensor": "PH", "response": "*OK" }
7. mock-service.js imprime el intercambio TX/RX en el terminal virtual de la UI
```

---

## 3. Especificación de la API REST

### 3.1. Endpoint de Telemetría

**`GET /api/sensors/:type`**

Parámetros de ruta:

| Parámetro | Valores válidos | Descripción |
|---|---|---|
| `type` | `rtd`, `ph`, `do`, `ec`, `all` | Identificador del módulo sensor |

Latencia simulada: 400 ms (emula el tiempo de procesamiento I²C más la conversión del ADC interno del EZO).

Respuesta exitosa — tipo específico (HTTP 200):

```json
[
  {
    "Timestamp": "2025-05-30T14:22:01.000Z",
    "Sensor": "RTD",
    "Valor": "25.04"
  },
  ...
]
```

Respuesta exitosa — tipo `all` (HTTP 200):

```json
[
  {
    "Timestamp": "2025-05-30T14:22:01.000Z",
    "Temperatura_C": "25.04",
    "pH": "7.21",
    "DO_mgL": "8.52",
    "EC_uS": "1048"
  },
  ...
]
```

Respuesta de error — tipo no reconocido (HTTP 400):

```json
{ "error": "Sensor no válido" }
```

### 3.2. Endpoint de Comandos EZO

**`POST /api/sensors/:type/command`**

Cuerpo de la petición (`Content-Type: application/json`):

```json
{ "command": "<cadena_de_comando_EZO>" }
```

Respuesta exitosa (HTTP 200):

```json
{
  "success": true,
  "sensor": "PH",
  "command": "cal,mid,7.00",
  "response": "*OK"
}
```

### 3.3. Tabla de Comandos EZO Soportados por el Parser Léxico

| Comando base | Aplica a | Latencia simulada | Respuesta representativa |
|---|---|---|---|
| `i` | Todos | 300 ms | `?I,RTD,2.12` |
| `status` | Todos | 300 ms | `?STATUS,P,5.03` |
| `r` | Todos | 900 ms | `25.047` / `7.22` / `8.51` / `1052` |
| `cal` | Todos | 600 ms | `*OK` / `?CAL,1` |
| `sleep` | Todos | 0 ms | `[SLEEP MODE ACTIVADO]` |
| `factory` | Todos | 800 ms | `*OK` |
| `find` | Todos | 300 ms | `*OK` |
| `led` | Todos | 300 ms | `?LED,1` / `*OK` |
| `plock` | Todos | 300 ms | `?PLOCK,1` / `*OK` |
| `i2c` | Todos | 300 ms | `*OK` |
| `t`, `s`, `p` | Todos | 300 ms | `?T,25.0` / `*OK` |
| `slope` | PH | 300 ms | `?Slope,99.7,100.3,-0.89` |
| `k` | EC | 300 ms | `?K,1.0` / `*OK` |
| `tc` | EC | 300 ms | `?TC,1.90` / `*OK` |
| `o` | EC | 300 ms | `?O,EC,TDS,S,SG` / `*OK` |
| Desconocido | Todos | 300 ms | `*ER` |

---

## 4. Especificación Técnica de la Capa de Hardware

### 4.1. Protocolo de Comunicación I²C con Módulos EZO

Todos los módulos EZO de Atlas Scientific implementan el protocolo I²C con la siguiente secuencia de operación para una lectura (comando `R`):

```
1. ioctl(fd, I2C_SLAVE, ADDR)    — seleccionar dirección del esclavo
2. write(fd, "R", 1)             — emitir el comando de lectura (ASCII 0x52)
3. usleep(1000000)               — esperar 1000 ms para conversión analógica interna
4. read(fd, response, 32)        — leer la respuesta del módulo
5. Verificar response[0] == 0x01 — código de estado: 0x01 indica éxito
6. atof(&response[1])            — parsear el float ASCII desde el byte 1 en adelante
```

Tabla de códigos de estado en `response[0]`:

| Código | Significado |
|---|---|
| `0x01` | Éxito — dato válido disponible |
| `0x02` | Error de sintaxis en el comando |
| `0xFE` | Pendiente — conversión no completada |
| `0xFF` | Sin datos disponibles |

### 4.2. Mapa de Direcciones I²C del Bus

| Módulo | Dirección I²C | Constante en código fuente |
|---|---|---|
| EZO-RTD | `0x66` | `EZORTD_I2C_ADDR` |
| EZO-pH | `0x63` | `EZOPH_I2C_ADDR` |
| EZO-DO | `0x61` | `EZODO_I2C_ADDR` |
| EZO-EC | `0x64` | `EZOEC_I2C_ADDR` |

Ninguna dirección colisiona en el espacio de 7 bits del protocolo I²C estándar. El bus opera en modo maestro único (*single-master*), lo que elimina la necesidad de arbitraje.

---

## 5. Arquitectura de Hardware Propuesta — Fase 9: Shield PCB con Aislamiento Galvánico

### 5.1. Justificación Técnica del Aislamiento Galvánico

La operación de sensores electroquímicos en un medio líquido conductor presenta una condición de riesgo inherente: la existencia de **corrientes parásitas de bucle de masa** (*ground loop currents*). Este fenómeno se produce cuando dos o más sensores sumergidos en el mismo líquido establecen caminos de retorno de corriente a través del propio medio líquido, creando diferencias de potencial espurias entre sus masas de referencia.

Las consecuencias operativas de esta condición son las siguientes:

**Para el módulo EZO-pH:** La sonda de pH opera mediante la detección de una diferencia de potencial electroquímico (típicamente entre −414 mV y +414 mV para el rango de 0 a 14 pH) generada en el electrodo de vidrio. Una corriente parásita que atraviese el medio líquido introduce un potencial de interferencia directamente sumado a esta señal de alta impedancia, produciendo lecturas de pH sistemáticamente desplazadas y no reproducibles.

**Para el módulo EZO-EC:** La medición de conductividad eléctrica se realiza mediante la inyección de una señal de corriente alterna de frecuencia controlada a través de electrodos de acero inoxidable o platino sumergidos. La presencia de corrientes parásitas de corriente continua procedentes de otros sistemas altera la conductividad aparente del medio, introduciendo errores proporcionales a la magnitud de la corriente de interferencia.

**Para el módulo EZO-DO:** Aunque la sonda de oxígeno disuelto es en términos eléctricos menos sensible que el electrodo de pH, las corrientes parásitas pueden inducir polarización electrolítica en los electrodos de platino de las sondas galvánicas, degradando irreversiblemente la membrana de politetrafluoroetileno (PTFE) y alterando la cinética de reducción del oxígeno.

### 5.2. Solución de Diseño: Aisladores Digitales I²C y Convertidores DC-DC Aislados

La arquitectura de la PCB propuesta para la Fase 9 implementa una barrera galvánica completa en cada canal de sensor mediante dos componentes:

**Aislador digital bidireccional I²C — Texas Instruments ISO1540:**

El ISO1540 es un aislador de capacitancia de silicio que implementa los canales SDA y SCL del bus I²C de forma completamente aislada, con una rigidez dieléctrica de 2500 V RMS. El dispositivo detecta el estado lógico de cada línea en el lado primario (Raspberry Pi) y reproduce la señal en el lado secundario (módulo EZO) sin conexión eléctrica directa. Sus características operativas relevantes son:

- Velocidad máxima de transferencia: 1 Mbps (compatible con el modo *Fast-mode Plus* de I²C)
- Corriente de cortocircuito de salida: ±4 mA (compatible con los pull-ups del bus)
- Tiempo de propagación: < 15 ns
- Consumo en standby: < 1 mA por canal

**Convertidor DC-DC aislado — Mornsun B0303S-1W (o equivalente):**

El ISO1540 requiere dos dominios de alimentación físicamente separados: VCC1 (lado Raspberry Pi, 3.3 V) y VCC2 (lado módulo EZO). Si ambos dominios comparten la misma referencia de tierra, la barrera galvánica del aislador digital resulta inoperante, ya que el bucle de masa se cierra a través del plano de tierra compartido de la PCB.

El B0303S-1W es un convertidor DC-DC de 1 W, entrada 3.3 V, salida 3.3 V, con aislamiento galvánico de 1500 V DC entre sus terminales de entrada y salida. Su interposición entre el plano de tierra de la Raspberry Pi y el plano de tierra de cada módulo EZO garantiza que no exista ningún camino eléctrico directo entre ambos dominios, eliminando efectivamente el bucle de masa.

### 5.3. Esquema Conceptual del Aislamiento por Canal

```
  Dominio Raspberry Pi (GND_PI)          Dominio Sensor (GND_EZO)
  ─────────────────────────────          ────────────────────────
  3.3V ──┬─────────────────────────────── VCC_in (B0303S) ──► VCC_out → VCC_EZO
         │                                     │                    │
         │                               [BARRERA 1500V]            │
         │                                                     GND_EZO (flotante respecto a GND_PI)
         │
         ├── SDA_PI ──► ISO1540 ──────────────────────────────────► SDA_EZO
         │              [BARRERA 2500V RMS]
         └── SCL_PI ──► ISO1540 ──────────────────────────────────► SCL_EZO
```

Este esquema se replica de forma independiente para cada uno de los cuatro módulos EZO, garantizando el aislamiento no solo respecto a la Raspberry Pi sino también entre los sensores entre sí, lo que elimina por completo los caminos de corriente parásita a través del medio líquido del fotobiorreactor.

---

## 6. Sistema de Evaluación de Alarmas

### 6.1. Lógica de Evaluación

El módulo `evaluateSensorAlarm()` de `dashboard.js` implementa una máquina de estados de cuatro niveles para cada sensor, evaluada en cada ciclo de actualización (1000 ms):

```
Estado OFFLINE:   JSON faltante, HTTP error, valor no numérico
Estado CRITICAL:  valor < limits.min  OR  valor > limits.max
Estado WARNING:   valor dentro del rango, pero dentro del 10% de los límites
Estado NORMAL:    valor dentro del rango, fuera de la banda de advertencia
```

La banda de advertencia se calcula como:

```
margen_advertencia = (limits.max - limits.min) × WARNING_MARGIN_RATIO
WARNING si: valor ≤ (limits.min + margen_advertencia)  OR
            valor ≥ (limits.max - margen_advertencia)
```

donde `WARNING_MARGIN_RATIO = 0.10` (configurable en `dashboard.js`).

### 6.2. Umbrales Operativos Configurados

Definidos en `config/alarms.json`:

| Variable | Mínimo | Máximo | Unidad |
|---|---|---|---|
| Temperatura | 20.0 | 30.0 | °C |
| pH | 6.8 | 7.5 | pH |
| Oxígeno Disuelto | 4.0 | 12.0 | mg/L |
| Conductividad Eléctrica | 500 | 2500 | µS/cm |

---

## 7. Módulo de Exportación de Datos

### 7.1. Exportación CSV

La función `handleExport(sensorType)` en `export-service.js` recupera el historial mediante `fetchHistoricalData()`, convierte el arreglo de objetos JSON a texto CSV mediante `convertToCSV()` y fuerza la descarga del archivo en el navegador mediante un enlace temporal con `URL.createObjectURL()`.

### 7.2. Exportación XLSX Multipagina

La función `handleExportExcel()` en `export-excel.js` itera sobre los cuatro sensores, recupera los datos de cada uno, crea una hoja de cálculo independiente con `XLSX.utils.json_to_sheet()` y las consolida en un único libro de trabajo (`Workbook`) mediante `XLSX.utils.book_append_sheet()`. El archivo binario `.xlsx` se descarga mediante `XLSX.writeFile()`.