// export-service.js

/**
 * Convierte un array de objetos JSON a formato CSV
 */
function convertToCSV(objArray) {
    const array = typeof objArray !== 'object' ? JSON.parse(objArray) : objArray;
    let str = '';
    
    // Extraer cabeceras (keys del primer objeto)
    const headers = Object.keys(array[0]).join(',');
    str += headers + '\r\n';

    // Rellenar filas
    for (let i = 0; i < array.length; i++) {
        let line = '';
        for (let index in array[i]) {
            if (line != '') line += ',';
            line += array[i][index];
        }
        str += line + '\r\n';
    }
    return str;
}

/**
 * Manejador principal del evento click de los botones
 */
async function handleExport(sensorType) {
    try {
        // 1. Obtener datos (Mock actual, fetch real en el futuro)
        const data = await fetchHistoricalData(sensorType);
        
        // 2. Convertir a CSV
        const csvText = convertToCSV(data);
        
        // 3. Crear un Blob (Objeto de datos binarios)
        const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
        
        // 4. Crear un enlace temporal para forzar la descarga en la laptop
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        
        link.setAttribute("href", url);
        link.setAttribute("download", `export_${sensorType}_${new Date().getTime()}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log(`[EXITO] Archivo CSV descargado para ${sensorType}`);
        
    } catch (error) {
        console.error("[ERROR] Fallo al exportar el CSV:", error);
        alert("Hubo un error al generar el archivo. Revisa la consola.");
    }
}