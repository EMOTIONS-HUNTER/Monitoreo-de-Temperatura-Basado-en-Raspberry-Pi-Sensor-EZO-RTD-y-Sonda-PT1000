// Actualización de mock-service.js (que ahora actúa como un api-service real)

async function fetchHistoricalData(sensorType) {
    console.log(`[FETCH] Solicitando datos al backend vía Nginx para: ${sensorType}...`);

    try {
        // Hacemos la petición a la ruta que Nginx está interceptando (/api/...)
        const response = await fetch(`/api/sensors/${sensorType}`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;

    } catch (error) {
        console.error("[ERROR] Fallo al conectar con el backend:", error);
        // Retornar array vacío para evitar que la UI colapse
        return [];
    }
}

async function sendCommand(command) {
    const sensorType = document.getElementById('terminal-sensor-select').value;
    const terminalOutput = document.getElementById('terminal-output');

    // 1. Imprimir el comando enviado en la consola UI
    const timeString = new Date().toLocaleTimeString();
    terminalOutput.innerHTML += `<div><span style="color: #fff;">[${timeString}] TX (${sensorType}):</span> ${command}</div>`;

    // Hacer scroll automático hacia abajo
    terminalOutput.scrollTop = terminalOutput.scrollHeight;

    try {
        // 2. Hacer la petición POST al backend mediante Nginx
        const response = await fetch(`/api/sensors/${sensorType}/command`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            // El cuerpo viaja en formato JSON
            body: JSON.stringify({ command: command })
        });

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const data = await response.json();

        // 3. Imprimir la respuesta simulada del circuito EZO en la UI
        let color = data.response === '*ER' ? '#ff3333' : '#00ffcc';
        terminalOutput.innerHTML += `<div><span style="color: #fff;">[${timeString}] RX (${sensorType}):</span> <span style="color: ${color};">${data.response}</span></div>`;

    } catch (error) {
        console.error("Error enviando comando:", error);
        terminalOutput.innerHTML += `<div><span style="color: #ff3333;">[${timeString}] SYS ERROR: Fallo de bus I2C simulado o servidor desconectado.</span></div>`;
    }

    // Mantener el scroll al final
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

/**
 * Envía un comando de calibración predefinido y sincroniza el select de la consola.
 */
function sendCalibrationCmd(cmd) {
    const sensorSelect = document.getElementById('cal-sensor-select').value;

    // Sincronizar el select de la terminal para que los logs sean coherentes
    document.getElementById('terminal-sensor-select').value = sensorSelect;

    // Reutilizar la función de la consola para enviar la petición POST
    sendCommand(cmd);
}

/**
 * Toma el valor introducido por el usuario y construye el comando (ej. "cal,7.00").
 */
function calibratePoint() {
    const sensorSelect = document.getElementById('cal-sensor-select').value;
    const calValue = document.getElementById('cal-value').value;

    if (!calValue) {
        alert("Por favor, ingresa un valor de referencia para calibrar.");
        return;
    }

    // Sincronizar selectores
    document.getElementById('terminal-sensor-select').value = sensorSelect;

    // Construir el comando Atlas Scientific y enviarlo a la consola
    const fullCommand = `cal,${calValue}`;
    sendCommand(fullCommand);

    // Limpiar el input después de enviar
    document.getElementById('cal-value').value = '';
}

function sendCustomCommand() {
    const input = document.getElementById('custom-command');
    const command = input.value.trim();
    
    if (command !== "") {
        sendCommand(command);
        input.value = ""; // Limpiar el input después de enviar
    }
}