# Sistema de Monitoreo de Parámetros Fisicoquímicos para Fotobiorreactor

**Plataforma de hardware:** Raspberry Pi 4 Model B  
**Estado del proyecto:** Desarrollo activo — Integración de hardware en curso (Fase 9)  
**Pila tecnológica:** C, Node.js, Express, Vanilla JavaScript, Nginx  
**Protocolo de comunicación físico:** I²C (Inter-Integrated Circuit), 100 kHz — 400 kHz  

---

## 1. Resumen Ejecutivo

Este repositorio documenta la arquitectura de software y las especificaciones de diseño de hardware de un sistema de adquisición de datos (DAQ) en tiempo real orientado a fotobiorreactores de escala de laboratorio. El proyecto se inició como un sistema de medición de temperatura de precisión basado en el módulo **EZO-RTD™** de Atlas Scientific y una sonda de platino PT1000; sin embargo, ha evolucionado en una plataforma integral de monitoreo que gestiona de forma simultánea cuatro parámetros fisicoquímicos críticos para el control de cultivos fotosintéticos.

Los cuatro parámetros monitoreados y los módulos OEM asociados son los siguientes:

| Parámetro | Módulo EZO | Dirección I²C | Unidad de medida |
|---|---|---|---|
| Temperatura | EZO-RTD™ (ISCCB-2) | `0x66` | °C |
| Potencial de Hidrógeno | EZO-pH™ | `0x63` | pH |
| Oxígeno Disuelto | EZO-DO™ | `0x61` | mg/L |
| Conductividad Eléctrica | EZO-EC™ | `0x64` | µS/cm |

La arquitectura del sistema implementa una topología de red distribuida localmente, separando de forma explícita las responsabilidades en cuatro capas: presentación (frontend), enrutamiento (Nginx), lógica de negocio y API (Node.js/Express) y adquisición de datos en hardware (demonios en C). Este diseño por capas garantiza la extensibilidad del sistema y permite la sustitución o incorporación de nuevos módulos sensores sin alterar la lógica de presentación.

---

## 2. Pila Tecnológica

### 2.1. Capa de Presentación (Frontend)

- **Lenguaje:** Vanilla JavaScript ES6+, HTML5, CSS3 puro
- **Biblioteca de visualización:** Chart.js (entregada vía CDN)
- **Biblioteca de exportación tabular:** SheetJS (`xlsx.full.min.js`, vía CDN)
- **Ciclo de actualización de lecturas en vivo:** 1000 ms (intervalo de *polling*)
- **Ciclo de actualización de tendencias históricas:** 10 000 ms
- **Idioma de la interfaz:** Español neutro

### 2.2. Capa de Enrutamiento y Proxy

- **Servidor:** Nginx
- **Puerto de entrada:** `8888`
- **Función:** Entrega de archivos estáticos del frontend y proxy inverso transparente hacia el puerto `3000` para el prefijo `/api/`

### 2.3. Capa de Lógica de Negocio y API

- **Entorno de ejecución:** Node.js (≥ v18)
- **Framework HTTP:** Express v5
- **Puerto de escucha:** `3000`
- **Dependencias de producción:** `express ^5.2.1`, `cors ^2.8.6`

### 2.4. Capa de Adquisición de Datos (Hardware)

- **Lenguaje:** C (estándar C99)
- **Interfaz de hardware:** Bus I²C del sistema operativo Linux mediante `/dev/i2c-1`
- **Encabezados del sistema utilizados:** `<linux/i2c-dev.h>`, `<sys/ioctl.h>`
- **Sistema de construcción:** GNU Make

---

## 3. Estructura del Directorio Fuente

```text
/
├── api/
│   └── server.js               # Servidor Express: endpoints REST y parser léxico EZO
│
├── config/
│   ├── alarms.json             # Umbrales operativos configurables por variable
│   └── sensors.json            # Metadatos declarativos de los módulos EZO (dirección I²C, habilitación)
│
├── data/
│   ├── EZORTD.json             # Vector de estado actual: temperatura (escrito por el demonio C)
│   ├── EZOPH.json              # Vector de estado actual: pH
│   ├── EZODO.json              # Vector de estado actual: oxígeno disuelto
│   └── EZOEC.json              # Vector de estado actual: conductividad eléctrica
│
├── frontend/
│   ├── index.html              # Punto de entrada del dashboard de monitoreo
│   ├── dashboard.css           # Hoja de estilos responsiva del sistema
│   ├── dashboard.js            # Lógica principal: polling, evaluación de alarmas, gráficas
│   ├── mock-service.js         # Capa de comunicación asíncrona con el backend (fetch/POST)
│   ├── export-service.js       # Serialización de datos históricos a formato CSV
│   └── export-excel.js         # Generación de reportes multipagina en formato XLSX
│
├── logs/
│   ├── temperature.csv         # Historial persistente de temperatura (escrito por el demonio)
│   ├── ph.csv                  # Historial persistente de pH
│   ├── do.csv                  # Historial persistente de oxígeno disuelto
│   └── ec.csv                  # Historial persistente de conductividad eléctrica
│
├── sensors/
│   ├── EZORTD/
│   │   ├── ezortd.h            # API pública: constante de dirección I²C y firma de getTemperature()
│   │   ├── ezortd.c            # Implementación del protocolo I²C para el EZO-RTD
│   │   ├── main.c              # Ejecutable de lectura única (one-shot), salida JSON a stdout
│   │   ├── ezortd_daemon.c     # Demonio de lectura continua: escribe JSON y appends CSV
│   │   └── Makefile            # Sistema de construcción del módulo RTD
│   │
│   ├── EZOPH/
│   │   ├── ezoph.h             # API pública del módulo pH
│   │   ├── ezoph.c             # Implementación del protocolo I²C para el EZO-pH
│   │   ├── main.c              # Ejecutable de lectura única
│   │   └── Makefile
│   │
│   ├── EZODO/
│   │   ├── ezodo.h             # API pública del módulo DO
│   │   ├── ezodo.c             # Implementación del protocolo I²C para el EZO-DO
│   │   ├── main.c              # Ejecutable de lectura única
│   │   └── Makefile
│   │
│   └── EZOEC/
│       ├── ezoec.h             # API pública del módulo EC
│       ├── ezoec.c             # Implementación del protocolo I²C para el EZO-EC
│       ├── main.c              # Ejecutable de lectura única
│       └── Makefile
│
├── package.json                # Manifiesto de dependencias Node.js
├── package-lock.json           # Árbol de dependencias resuelto y bloqueado
├── README.md                   # Este documento
├── ARCHITECTURE.md             # Especificación técnica de la arquitectura del sistema
└── PROJECT_STATUS.md           # Estado de hitos, riesgos y fases pendientes
```

---

## 4. Instrucciones de Despliegue

### 4.1. Requisitos Previos

- Node.js v18 o superior instalado en el sistema anfitrión
- Nginx instalado (`sudo apt install nginx` en sistemas Debian/Ubuntu)
- Acceso al directorio raíz del repositorio

### 4.2. Inicialización del Servidor de Backend (Node.js)

Desde el directorio raíz del repositorio, instalar las dependencias de producción y levantar el servidor:

```bash
npm install
node api/server.js
```

El servidor quedará escuchando en `http://localhost:3000`. Verificar el inicio exitoso con el mensaje:

```
[MOCK SERVER] Backend Node.js corriendo en http://localhost:3000
```

Para ejecución persistente en segundo plano se recomienda el gestor de procesos `pm2`:

```bash
npm install -g pm2
pm2 start api/server.js --name fotobiorreactor-api
pm2 save
```

### 4.3. Configuración del Proxy Inverso Nginx

Crear o editar el bloque de servidor activo de Nginx. En sistemas Debian-based, el archivo de configuración canónico es `/etc/nginx/sites-available/fotobiorreactor`:

```nginx
server {
    listen 8888;
    server_name localhost;

    # Raíz del contenido estático: directorio raíz del repositorio
    root /ruta/absoluta/al/repositorio;
    index frontend/index.html;

    # Entrega de archivos estáticos del frontend
    location / {
        try_files $uri $uri/ =404;
    }

    # Proxy inverso transparente hacia el backend Node.js
    location /api/ {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    }
}
```

Habilitar el sitio y recargar el servicio:

```bash
sudo ln -s /etc/nginx/sites-available/fotobiorreactor /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 4.4. Acceso al Cliente

Abrir un navegador web y dirigirse a:

```
http://localhost:8888/frontend/index.html
```

El dashboard iniciará automáticamente el ciclo de polling hacia la API y las lecturas en vivo comenzarán a actualizarse con los datos simulados del backend.

### 4.5. Construcción de los Demonios en C (Hardware Real)

Para compilar los controladores de hardware en la Raspberry Pi, ejecutar el siguiente procedimiento por módulo sensor (se ilustra con el módulo RTD):

```bash
cd sensors/EZORTD
make
```

Esto generará el ejecutable `EZORTD`. Antes de compilar el demonio continuo (`ezortd_daemon.c`), actualizar las rutas absolutas codificadas en el código fuente para que correspondan al directorio de despliegue real en la Raspberry Pi.

**Nota:** El bus I²C debe estar habilitado en la Raspberry Pi mediante `sudo raspi-config` → *Interface Options* → *I2C* → *Enable*. Se recomienda agregar el usuario de ejecución al grupo `i2c` para evitar la ejecución con privilegios de superusuario:

```bash
sudo usermod -aG i2c $USER
```