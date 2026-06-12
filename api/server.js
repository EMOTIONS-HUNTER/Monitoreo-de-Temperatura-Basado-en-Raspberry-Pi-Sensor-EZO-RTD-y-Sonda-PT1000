// api/server.js
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Función auxiliar para simular latencia
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Endpoint principal para obtener datos de los sensores (MOCK)
app.get('/api/sensors/:type', async (req, res) => {
    const sensorType = req.params.type;
    console.log(`[GET] Petición recibida para sensor: ${sensorType}`);

    // Simulación de latencia I2C y procesamiento (400ms)
    await delay(400);

    const data = [];
    const now = new Date();

    // Generamos 60 registros simulados
    for (let i = 60; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - i * 1000).toISOString();

        // Simulación de valores con ruido térmico/químico
        const mockValues = {
            rtd: (25.0 + (Math.random() * 0.1 - 0.05)).toFixed(2),
            ph: (7.2 + (Math.random() * 0.04 - 0.02)).toFixed(2),
            do: (8.5 + (Math.random() * 0.1 - 0.05)).toFixed(2),
            ec: (1050 + (Math.random() * 10 - 5)).toFixed(0)
        };

        if (sensorType === 'all') {
            data.push({
                Timestamp: timestamp,
                Temperatura_C: mockValues.rtd,
                pH: mockValues.ph,
                DO_mgL: mockValues.do,
                EC_uS: mockValues.ec
            });
        } else if (mockValues[sensorType]) {
            data.push({
                Timestamp: timestamp,
                Sensor: sensorType.toUpperCase(),
                Valor: mockValues[sensorType]
            });
        } else {
            return res.status(400).json({ error: "Sensor no válido" });
        }
    }

    res.json(data);
});

// Endpoint DEFINITIVO para comandos Atlas Scientific EZO
app.post('/api/sensors/:type/command', async (req, res) => {
    const sensorType = req.params.type.toUpperCase();
    const rawCommand = req.body.command ? req.body.command.toLowerCase().trim() : '';

    console.log(`[COMANDO] RX: '${rawCommand}' para ${sensorType}`);

    // Dividimos el comando por comas para analizar base y parámetros (ej. "cal,mid,7.00" -> ["cal", "mid", "7.00"])
    const parts = rawCommand.split(',');
    const baseCmd = parts[0];

    let ezoResponse = "";

    // 1. COMANDOS DE ESTADO Y CONFIGURACIÓN GLOBAL (Comunes a todos los EZO)
    if (baseCmd === 'i') {
        await delay(300);
        ezoResponse = `?I,${sensorType},2.12`;
    }
    else if (baseCmd === 'status') {
        await delay(300);
        ezoResponse = `?STATUS,P,5.03`; // P = Power On, 5.03 = Voltaje
    }
    else if (baseCmd === 'sleep') {
        ezoResponse = `[SLEEP MODE ACTIVADO]`;
    }
    else if (baseCmd === 'factory') {
        await delay(800);
        ezoResponse = `*OK`;
    }
    else if (baseCmd === 'find') {
        await delay(300);
        ezoResponse = `*OK`; // Hace parpadear el LED en blanco
    }
    else if (baseCmd === 'led') {
        await delay(300);
        if (parts[1] === '?') ezoResponse = `?LED,1`;
        else ezoResponse = `*OK`;
    }
    else if (baseCmd === 'plock') {
        // Protocol Lock (Evita cambios accidentales de I2C a UART)
        await delay(300);
        if (parts[1] === '?') ezoResponse = `?PLOCK,1`;
        else ezoResponse = `*OK`;
    }
    else if (baseCmd === 'i2c') {
        // Cambio de dirección I2C (ej. i2c,100)
        await delay(300);
        ezoResponse = `*OK`;
    }

    // 2. COMANDO DE LECTURA PRINCIPAL
    else if (baseCmd === 'r') {
        await delay(900); // Latencia real de procesamiento químico/eléctrico
        if (sensorType === 'RTD') ezoResponse = (25.0 + Math.random() * 0.1).toFixed(3);
        if (sensorType === 'PH') ezoResponse = (7.2 + Math.random() * 0.05).toFixed(2);
        if (sensorType === 'DO') ezoResponse = (8.5 + Math.random() * 0.1).toFixed(2);
        if (sensorType === 'EC') ezoResponse = (1050 + Math.random() * 5).toFixed(0);
    }

    // 3. SISTEMA DE CALIBRACIÓN UNIVERSAL
    else if (baseCmd === 'cal') {
        await delay(600);
        if (parts[1] === 'clear') {
            ezoResponse = `*OK`;
        } else if (parts[1] === '?') {
            ezoResponse = `?CAL,1`; // Devuelve puntos calibrados
        } else {
            // Acepta cal,mid,7.00 (pH) | cal,atm (DO) | cal,dry (EC) | cal,t (RTD)
            ezoResponse = `*OK`;
        }
    }

    // 4. COMPENSACIONES AMBIENTALES (Temperatura, Salinidad, Presión)
    else if (baseCmd === 't' || baseCmd === 's' || baseCmd === 'p') {
        await delay(300);
        if (parts[1] === '?') {
            const defaultVals = { 't': '25.0', 's': '0.00', 'p': '101.3' };
            ezoResponse = `?${baseCmd.toUpperCase()},${defaultVals[baseCmd]}`;
        } else {
            ezoResponse = `*OK`;
        }
    }

    // 5. COMANDOS ESPECÍFICOS POR SENSOR
    else {
        await delay(300);

        // --- RTD (Temperatura) ---
        if (sensorType === 'RTD' && baseCmd === 's') {
            // Escala (c=Celsius, k=Kelvin, f=Fahrenheit)
            ezoResponse = parts[1] === '?' ? `?S,C` : `*OK`;
        }

        // --- PH ---
        else if (sensorType === 'PH' && baseCmd === 'slope') {
            // Estado de salud del vidrio de la sonda
            ezoResponse = parts[1] === '?' ? `?Slope,99.7,100.3,-0.89` : `*ER`;
        }

        // --- EC (Conductividad) ---
        else if (sensorType === 'EC') {
            if (baseCmd === 'k') {
                // Constante de la sonda (0.1, 1.0, 10)
                ezoResponse = parts[1] === '?' ? `?K,1.0` : `*OK`;
            } else if (baseCmd === 'tc') {
                // Coeficiente de temperatura
                ezoResponse = parts[1] === '?' ? `?TC,1.90` : `*OK`;
            } else if (baseCmd === 'o') {
                // Habilitar/Deshabilitar parámetros de salida (TDS, Salinidad, Gravedad Específica)
                ezoResponse = parts[1] === '?' ? `?O,EC,TDS,S,SG` : `*OK`;
            } else {
                ezoResponse = `*ER`;
            }
        }

        // Si ninguna regla coincide, el comando no existe en el datasheet
        else {
            ezoResponse = `*ER`;
        }
    }

    res.json({
        success: true,
        sensor: sensorType,
        command: rawCommand,
        response: ezoResponse
    });
});

// --- RUTAS DE GESTIÓN DE ALMACENAMIENTO ---

// Variable global para simular la configuración de escritura del demonio C++
let loggingRateSeconds = 1;

app.post('/api/config/logging', (req, res) => {
    loggingRateSeconds = req.body.rate || 1;
    console.log(`[SISTEMA] Demonio de escritura configurado a: 1 registro cada ${loggingRateSeconds}s`);
    res.json({ success: true, rate: loggingRateSeconds });
});

app.post('/api/history/clear', (req, res) => {
    console.log(`[SISTEMA] Purgado de base de datos histórico solicitado por el usuario.`);
    // En el hardware real, aquí se ejecutaría 'fs.unlink()' o se truncarían los archivos CSV en /logs/
    res.json({ success: true, message: "Archivos de registro truncados correctamente." });
});

app.listen(PORT, () => {
    console.log(`[MOCK SERVER] Backend Node.js corriendo en http://localhost:${PORT}`);
});