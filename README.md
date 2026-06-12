# Sistema de Monitoreo de Parámetros Fisicoquímicos para Fotobiorreactor

**Estado del Proyecto:** Desarrollo Activo (Fase de Pruebas de Integración y Simulación I2C)
**Plataforma de Hardware:** Raspberry Pi 4 Model B
**Pila Tecnológica:** Node.js, Express, Vanilla JavaScript, Nginx, C/C++

## 1. Resumen del Proyecto

Este repositorio documenta la arquitectura de software y los lineamientos de diseño de hardware para un sistema de adquisición de datos en tiempo real orientado a fotobiorreactores. Aunque el repositorio fue inicializado bajo el título de un proyecto para la sonda de temperatura PT1000, el sistema actual constituye una plataforma integral para el monitoreo simultáneo de cuatro parámetros críticos utilizando módulos OEM de la serie EZO de Atlas Scientific:

* **Temperatura** (Sonda RTD PT1000)
* **Potencial de Hidrógeno** (Sonda de pH)
* **Oxígeno Disuelto** (Sonda DO galvánica/óptica)
* **Conductividad Eléctrica** (Sonda EC)

## 2. Arquitectura del Sistema

La solución implementa una topología de red distribuida localmente, utilizando un modelo Cliente-Servidor optimizado por un proxy inverso para la gestión del tráfico y la mitigación de restricciones de intercambio de recursos de origen cruzado (CORS).

### 2.1. Capa de Presentación (Frontend)
Interfaz gráfica de usuario (GUI) asíncrona desarrollada en HTML5, CSS3 y JavaScript puro (ES6+). Implementa rutinas de *polling* de alta frecuencia (1000 ms) para la actualización de métricas en tiempo real y renderizado de series temporales mediante la biblioteca `Chart.js`.

### 2.2. Capa de Enrutamiento y Proxy (Nginx)
Servidor web Nginx configurado en el puerto `8888`. Actúa como servidor de archivos estáticos para la capa de presentación y opera como proxy inverso, redirigiendo todas las solicitudes HTTP bajo el prefijo `/api/` hacia el proceso de Node.js en el puerto `3000`.

### 2.3. Capa de Lógica de Negocio y API (Backend)
Servidor HTTP desarrollado en entorno Node.js utilizando el framework Express. Sus responsabilidades principales incluyen:
* Exposición de endpoints RESTful para la transmisión de telemetría.
* Simulación de retardos y latencias físicas inherentes al protocolo I2C (300 ms - 900 ms).
* Implementación de un analizador léxico (*Lexical Parser*) capaz de procesar el conjunto de instrucciones oficial de Atlas Scientific (calibración, compensación ambiental y diagnóstico).

### 2.4. Capa Física (Adquisición de Datos)
Demonios ejecutables compilados en C/C++ responsables de la interrogación directa de los registros de hardware en el bus I2C de la Raspberry Pi a través de los pines GPIO (SDA/SCL).

## 3. Características Técnicas Implementadas

* **Motor de Evaluación de Alarmas:** Subsistema lógico que compara la telemetría en tiempo real contra umbrales de operación críticos y de advertencia definidos paramétricamente en el archivo `config/alarms.json`.
* **Consola de Hardware Virtual:** Emulador integrado en la interfaz de usuario que permite la inyección de cadenas de comandos estandarizadas hacia los módulos EZO, facilitando rutinas de calibración multipunto y configuración de registros de compensación.
* **Módulo de Exportación de Datos:** Procesamiento de arreglos de datos históricos en el cliente y serialización a formato `.xlsx` utilizando la biblioteca `SheetJS`, permitiendo la extracción de registros tabulares para análisis posterior.

## 4. Estructura del Directorio Fuente

```text
/
├── api/                   
│   └── server.js           # Lógica de enrutamiento Express y simulador de protocolo EZO
├── config/                
│   ├── alarms.json         # Definición de límites operativos de seguridad
│   └── sensors.json        # Metadatos y resolución de los instrumentos
├── data/                  
│   └── *.json              # Vectores de estado transitorios poblados por procesos C++
├── frontend/              
│   ├── index.html          # Interfaz principal de control
│   ├── dashboard.js        # Rutinas de renderizado y evaluación de estado
│   ├── mock-service.js     # Interfaz de comunicación asíncrona con el backend
│   ├── export-service.js   # Lógica de construcción de conjuntos de datos para gráficos
│   └── export-excel.js     # Formateo y serialización de archivos de hoja de cálculo
├── logs/                  
│   └── *.csv               # Registros históricos persistentes para series temporales
├── sensors/               
│   └── */*.c               # Código fuente de los controladores de hardware (I2C)
└── README.md