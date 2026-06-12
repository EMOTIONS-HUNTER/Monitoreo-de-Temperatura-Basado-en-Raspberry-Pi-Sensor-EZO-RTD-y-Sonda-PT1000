// export-excel.js

async function handleExportExcel() {
    try {
        console.log("[MOCK] Iniciando generación de reporte Excel...");
        
        // 1. Crear un nuevo libro de trabajo (Workbook) en blanco
        const workbook = XLSX.utils.book_new();

        // Definimos los sensores y el nombre que tendrá cada pestaña en el Excel
        const sensors = [
            { id: 'rtd', sheetName: 'Temperatura_RTD' },
            { id: 'ph', sheetName: 'Sensor_pH' },
            { id: 'do', sheetName: 'Oxigeno_DO' },
            { id: 'ec', sheetName: 'Conductividad_EC' }
        ];

        // 2. Iterar sobre cada sensor, obtener sus datos y crear su hoja
        for (const sensor of sensors) {
            // Reutilizamos el mock de la Fase 4
            const data = await fetchHistoricalData(sensor.id);
            
            // SheetJS convierte automáticamente un array de objetos JSON a una hoja de cálculo
            const worksheet = XLSX.utils.json_to_sheet(data);
            
            // Ajustar el ancho de las columnas para que se lea mejor el Timestamp
            const wscols = [
                { wch: 30 }, // Ancho para la columna Timestamp
                { wch: 15 }, // Ancho para la columna Sensor
                { wch: 15 }  // Ancho para la columna Valor
            ];
            worksheet['!cols'] = wscols;

            // Añadir la hoja al libro de trabajo
            XLSX.utils.book_append_sheet(workbook, worksheet, sensor.sheetName);
        }

        // 3. Forzar la descarga del archivo binario .xlsx
        const fileName = `Reporte_Bioreactor_${new Date().getTime()}.xlsx`;
        XLSX.writeFile(workbook, fileName);
        
        console.log("[EXITO] Archivo Excel multihabitación descargado correctamente.");

    } catch (error) {
        console.error("[ERROR] Fallo al exportar el Excel:", error);
        alert("Hubo un error al generar el Excel. Revisa la consola.");
    }
}