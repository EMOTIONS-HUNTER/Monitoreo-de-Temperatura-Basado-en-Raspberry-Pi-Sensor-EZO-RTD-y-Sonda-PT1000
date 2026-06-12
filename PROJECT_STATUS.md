# Project Status - Photobioreactor Dashboard v1.0 + Phase 3

## Estado general

Este repositorio contiene un sistema de monitoreo local para un fotobiorreactor basado en sensores Atlas Scientific EZO. La arquitectura actual separa la captura de datos en C, los archivos de intercambio en `data/`, los historiales CSV en `logs/` y un dashboard web estatico en `frontend/`, pensado para desplegarse posteriormente en Raspberry Pi con Nginx.

## Arquitectura actual

El flujo principal del sistema es:

1. Los sensores Atlas Scientific se comunican por I2C con la Raspberry Pi.
2. Los programas en `sensors/` leen cada circuito EZO.
3. Cada lectura actual se escribe como JSON en `data/`.
4. Los historiales se almacenan como CSV en `logs/`.
5. Nginx sirve el repositorio como contenido estatico.
6. `frontend/index.html` carga `dashboard.css`, Chart.js y `dashboard.js`.
7. El navegador consulta los JSON cada segundo y actualiza las lecturas actuales.
8. La seccion `Alarm Summary` evalua umbrales desde `config/alarms.json`.
9. La seccion `Historical Trends` consulta los CSV cada 10 segundos y actualiza las graficas.

No hay backend web ni base de datos en esta version. El filesystem funciona como interfaz entre los daemons de sensores y el frontend.

## Sensores y archivos de datos actuales

| Sensor | Variable | Archivo JSON | Unidad |
|---|---|---|---|
| EZO-RTD | Temperatura | `data/EZORTD.json` | degC |
| EZO-pH | pH | `data/EZOPH.json` | pH |
| EZO-DO | Oxigeno disuelto | `data/EZODO.json` | mg/L |
| EZO-EC | Conductividad | `data/EZOEC.json` | uS/cm |

## Archivos de historial

| Variable | Archivo CSV | Grafica |
|---|---|---|
| Temperatura | `logs/temperature.csv` | Temperature vs Time |
| pH | `logs/ph.csv` | pH vs Time |
| Oxigeno disuelto | `logs/do.csv` | Dissolved Oxygen vs Time |
| Conductividad | `logs/ec.csv` | Conductivity vs Time |

Formato CSV soportado:

```csv
timestamp,value
1717027200,25.488
```

El frontend tambien acepta timestamps ISO 8601 en la primera columna.

## Archivos utilizados

| Ruta | Proposito |
|---|---|
| `frontend/index.html` | Estructura del dashboard, seccion `System Status` y seccion `Historical Trends`. |
| `frontend/dashboard.css` | Estilos responsive para metricas, estado del sistema y graficas. |
| `frontend/dashboard.js` | Lectura periodica de JSON, validacion de datos, lectura CSV y actualizacion de Chart.js. |
| `data/EZORTD.json` | Lectura actual de temperatura. |
| `data/EZOPH.json` | Lectura actual de pH. |
| `data/EZODO.json` | Lectura actual de oxigeno disuelto. |
| `data/EZOEC.json` | Lectura actual de conductividad. |
| `logs/temperature.csv` | Historial de temperatura para graficas. |
| `logs/ph.csv` | Historial de pH para graficas. |
| `logs/do.csv` | Historial de oxigeno disuelto para graficas. |
| `logs/ec.csv` | Historial de conductividad para graficas. |
| `config/sensors.json` | Configuracion declarativa de sensores Atlas Scientific. |
| `config/alarms.json` | Umbrales configurables para estados NORMAL, WARNING y CRITICAL. |
| `sensors/EZORTD/` | Codigo C existente para lectura EZO-RTD. |
| `sensors/EZOPH/` | Codigo C existente para lectura EZO-pH. |
| `sensors/EZODO/` | Codigo C existente para lectura EZO-DO. |
| `sensors/EZOEC/` | Codigo C existente para lectura EZO-EC. |

## Funciones implementadas en v1.0

- Dashboard profesional para monitoreo del fotobiorreactor.
- Lectura de temperatura, pH, oxigeno disuelto y conductividad.
- Actualizacion automatica de lecturas actuales cada 1 segundo.
- Fecha y hora de ultima actualizacion.
- Validacion independiente por sensor.
- Estado `OFFLINE` cuando un JSON no existe, no responde, contiene JSON invalido o no incluye un valor numerico valido.
- Estado global del sistema: `ALL SYSTEMS ONLINE`, `PARTIAL DATA` o `SYSTEM OFFLINE`.
- Seccion inferior `System Status`.
- Conteo de sensores activos y sensores offline.
- Diseno responsive para escritorio, tablet y movil.

## Funciones implementadas en Phase 2 - Historical Trends

- Nueva seccion `Historical Trends` debajo de `System Status`.
- Integracion de Chart.js para graficas de linea.
- Cuatro graficas independientes:
  - Temperature vs Time.
  - pH vs Time.
  - Dissolved Oxygen vs Time.
  - Conductivity vs Time.
- Lectura de historiales desde `logs/temperature.csv`, `logs/ph.csv`, `logs/do.csv` y `logs/ec.csv`.
- Actualizacion automatica de graficas cada 10 segundos.
- Estado visual `No historical data available` cuando un CSV no existe, esta vacio o no contiene datos numericos validos.
- Parser CSV reutilizable con soporte principal para `timestamp,value` y compatibilidad adicional con encabezados como `time`, `date`, nombres de variable y `reading`.
- Las instancias Chart.js se conservan en memoria y las actualizaciones cambian datasets existentes con `chart.update("none")`.
- Configuracion Chart.js para dashboard cientifico: `responsive: true`, `maintainAspectRatio: false` y `animation: false`.
- Funciones reutilizables para futuras graficas:
  - `readHistoricalData()`
  - `parseHistoricalCsv()`
  - `buildChartDataset()`
  - `getChartOptions()`
  - `renderHistoricalChart()`
  - `updateHistoricalTrends()`
- Diseno responsive para dos columnas en escritorio y una columna en movil.

## Funciones implementadas en Phase 3 - Alarmas y umbrales configurables

- Archivo `config/alarms.json` normalizado con umbrales por variable:
  - Temperatura: 20 a 30 degC.
  - pH: 6.8 a 7.5.
  - Oxigeno disuelto: 4.0 a 12.0 mg/L.
  - Conductividad: 500 a 2500 uS/cm.
- El frontend lee `../config/alarms.json` durante el ciclo de actualizacion.
- Cada sensor se evalua como:
  - `NORMAL`: valor dentro del rango y fuera de la banda de advertencia.
  - `WARNING`: valor dentro del rango, pero cerca de `min` o `max`.
  - `CRITICAL`: valor por debajo de `min` o por encima de `max`.
  - `OFFLINE`: JSON faltante, invalido o sin valor numerico.
- La banda `WARNING` usa el 10% del ancho del rango configurado, definido en `WARNING_MARGIN_RATIO`.
- Las tarjetas cambian visualmente por estado:
  - Verde para `NORMAL`.
  - Amarillo para `WARNING`.
  - Rojo para `CRITICAL`.
  - Gris para `OFFLINE`.
- Nueva seccion `Alarm Summary` con:
  - `Active Critical Alarms`.
  - `Active Warnings`.
  - `Offline Sensors`.
  - `Overall Risk Level`.
- Lista activa de sensores en alarma u offline.
- Estructura de eventos de alarma preparada para integraciones futuras:
  - `sensorId`
  - `sensorName`
  - `severity`
  - `value`
  - `message`
  - `createdAt`

## Arquitectura de alarmas

El flujo de alarmas es:

1. `dashboard.js` lee los JSON de sensores desde `data/`.
2. `dashboard.js` lee los umbrales desde `config/alarms.json`.
3. `evaluateSensorAlarm()` compara cada valor contra `min` y `max`.
4. `renderSystemStatus()` actualiza el estado general.
5. `renderAlarmSummary()` actualiza conteos, riesgo global y lista de alarmas.

La logica queda encapsulada para que una fase posterior pueda enviar los eventos generados por `getAlarmEvents()` a correo, Telegram o MQTT sin acoplar esas salidas al renderizado visual.

## Dependencias nuevas

| Dependencia | Uso | Carga |
|---|---|---|
| Chart.js | Renderizado de graficas historicas de linea | CDN en `frontend/index.html` |

Nota de despliegue: Chart.js por CDN requiere conectividad desde el navegador. Para una Raspberry Pi aislada o una red local sin internet, se recomienda descargar una copia local versionada y servirla desde `frontend/vendor/`.

## Nomenclatura de historiales CSV

Se detecto una inconsistencia entre `logs/temp.csv` y `logs/temperature.csv`:

- `frontend/dashboard.js` consume `logs/temperature.csv`.
- El archivo presente en `logs/` es `temperature.csv`.
- Versiones anteriores de `ARCHITECTURE.md` y `sensors/EZORTD/ezortd_daemon.c` apuntaban a `logs/temp.csv`.

Nomenclatura unica propuesta y aplicada para todo el proyecto:

| Variable | Nombre canonico |
|---|---|
| Temperatura | `logs/temperature.csv` |
| pH | `logs/ph.csv` |
| Oxigeno disuelto | `logs/do.csv` |
| Conductividad | `logs/ec.csv` |

La razon es mantener nombres descriptivos, consistentes con las etiquetas cientificas del dashboard y faciles de extender en exportaciones futuras.

## Proximas fases

1. Historial CSV persistente
   - Unificar la escritura de logs en `logs/` o `data/`.
   - Definir encabezados estables para cada sensor.
   - Registrar timestamp ISO y valor numerico por lectura.

2. Controles de rango para graficas
   - Agregar rangos de tiempo: 5 min, 1 h, 24 h.
   - Permitir pausa/reanudacion de actualizacion historica.
   - Mostrar minimos, maximos y promedios por ventana.

3. Notificaciones de alarmas
   - Enviar eventos de `getAlarmEvents()` por correo.
   - Enviar alertas por Telegram.
   - Publicar alarmas por MQTT.
   - Preparar salidas GPIO locales para alarmas criticas.

4. Exportacion CSV
   - Descargar historiales por sensor.
   - Exportar ventanas de tiempo seleccionadas.
   - Mantener compatibilidad con herramientas de analisis cientifico.

5. Exportacion Excel
   - Generar archivos `.xlsx` con hojas por sensor.
   - Incluir metadatos del experimento.
   - Preparar tablas y graficas basicas.

6. Calibracion Atlas Scientific
   - Crear interfaz guiada para rutinas de calibracion.
   - Registrar fecha, operador y resultado de calibracion.
   - Proteger comandos criticos con confirmaciones.

7. Comandos EZO desde la web
   - Agregar una API local para enviar comandos a los circuitos EZO.
   - Implementar endpoints seguros para lectura, calibracion y diagnostico.
   - Separar permisos de monitoreo y administracion.

## Notas de despliegue

Para Raspberry Pi con Nginx, el `root` del sitio debe apuntar al directorio raiz del repositorio. El dashboard se abre desde:

```text
/frontend/index.html
```

Desde esa ubicacion, el frontend lee los datos usando rutas relativas hacia `../data/*.json` y `../logs/*.csv`.

Chart.js se carga desde CDN en esta fase. Para uso sin internet en la Raspberry Pi, la siguiente mejora recomendada es descargar una copia local versionada de Chart.js y servirla desde `frontend/vendor/`.
